/**
 * GET /api/billing/claim-readiness
 *
 * "No Response" worklist: every professional claim submitted to a
 * payer that hasn't come back yet. Drives /billing/claim-readiness
 * (now titled "No Response").
 *
 * Criteria:
 *   - claim_status IN ('submitted', 'accepted_payer')
 *   - archived_at IS NULL
 *   - defer_until IS NULL OR defer_until <= today (auto-resurface)
 *   - ordered by submitted_at ASC (oldest first)
 */
import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";
import { requireBillingAccess } from "@/lib/billing/requireBillingAccess";

type DbRow = Record<string, unknown>;

const text = (value: unknown) => String(value ?? "").trim();
const money = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

function agingDays(submittedAt: string | null): number | null {
  if (!submittedAt) return null;
  const submitted = new Date(submittedAt);
  if (Number.isNaN(submitted.getTime())) return null;
  const today = new Date();
  const ms = today.getTime() - submitted.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Database connection not available" },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const guard = await requireBillingAccess({
      requestedOrganizationId: searchParams.get("organizationId"),
    });
    if (guard instanceof NextResponse) return guard;
    const organizationId = guard.organizationId;

    const today = new Date().toISOString().slice(0, 10);

    const { data: claimRows, error: claimsError } = await (supabase as any)
      .from("professional_claims")
      .select(
        "id, claim_number, claim_status, patient_id, payer_profile_id, total_charge, submitted_at, defer_until, deferred_reason, created_at",
      )
      .eq("organization_id", organizationId)
      .in("claim_status", ["submitted", "accepted_payer"])
      .is("archived_at", null)
      .or(`defer_until.is.null,defer_until.lte.${today}`)
      .order("submitted_at", { ascending: true, nullsFirst: true });

    if (claimsError) throw claimsError;

    const claims = (claimRows ?? []) as DbRow[];
    const claimIds = claims.map((c) => text(c.id)).filter(Boolean);
    const patientIds = [...new Set(claims.map((c) => text(c.patient_id)).filter(Boolean))];
    const payerProfileIds = [
      ...new Set(claims.map((c) => text(c.payer_profile_id)).filter(Boolean)),
    ];

    const [{ data: patients }, { data: payerProfiles }, { data: serviceLines }, { data: notes }] =
      await Promise.all([
        patientIds.length
          ? supabase
              .from("clients")
              .select("id, first_name, last_name")
              .in("id", patientIds)
          : Promise.resolve({ data: [] as DbRow[] }),
        payerProfileIds.length
          ? supabase
              .from("payer_profiles")
              .select("id, payer_name")
              .in("id", payerProfileIds)
          : Promise.resolve({ data: [] as DbRow[] }),
        claimIds.length
          ? supabase
              .from("professional_claim_service_lines")
              .select("claim_id, service_date_from, service_date_to")
              .in("claim_id", claimIds)
          : Promise.resolve({ data: [] as DbRow[] }),
        claimIds.length
          ? (supabase as any)
              .from("claim_notes")
              .select("claim_id, body, created_at")
              .eq("organization_id", organizationId)
              .in("claim_id", claimIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as DbRow[] }),
      ]);

    const patientById = new Map<string, DbRow>(
      ((patients ?? []) as DbRow[]).map((p) => [text(p.id), p]),
    );
    const payerById = new Map<string, DbRow>(
      ((payerProfiles ?? []) as DbRow[]).map((p) => [text(p.id), p]),
    );

    const serviceLinesByClaim = new Map<string, { from: string | null; to: string | null }>();
    for (const line of (serviceLines ?? []) as DbRow[]) {
      const key = text(line.claim_id);
      if (!key) continue;
      const from = (line.service_date_from as string | null) ?? null;
      const to = (line.service_date_to as string | null) ?? null;
      const prior = serviceLinesByClaim.get(key);
      if (!prior) {
        serviceLinesByClaim.set(key, { from, to });
        continue;
      }
      serviceLinesByClaim.set(key, {
        from: prior.from && from ? (prior.from < from ? prior.from : from) : (prior.from ?? from),
        to: prior.to && to ? (prior.to > to ? prior.to : to) : (prior.to ?? to),
      });
    }

    const notesByClaim = new Map<string, DbRow[]>();
    for (const note of (notes ?? []) as DbRow[]) {
      const key = text(note.claim_id);
      if (!key) continue;
      const arr = notesByClaim.get(key) ?? [];
      arr.push(note);
      notesByClaim.set(key, arr);
    }

    const items = claims.map((claim) => {
      const patient = patientById.get(text(claim.patient_id));
      const patientName = patient
        ? [patient.first_name, patient.last_name].map(text).filter(Boolean).join(" ") ||
          "Unknown patient"
        : "Unknown patient";
      const payer = payerById.get(text(claim.payer_profile_id));
      const dates = serviceLinesByClaim.get(text(claim.id)) ?? { from: null, to: null };
      const claimNotes = notesByClaim.get(text(claim.id)) ?? [];
      const latest = claimNotes[0];
      const latestBody = latest ? text(latest.body) : "";
      const excerpt =
        latestBody.length > 120 ? `${latestBody.slice(0, 117)}…` : latestBody || null;
      const submittedAt = (claim.submitted_at as string | null) ?? null;

      return {
        id: text(claim.id),
        claim_number: text(claim.claim_number) || null,
        claim_status: text(claim.claim_status) || null,
        patient_id: text(claim.patient_id) || null,
        patient_name: patientName,
        payer_name: payer ? text(payer.payer_name) || null : null,
        service_date_from: dates.from,
        service_date_to: dates.to,
        submitted_at: submittedAt,
        aging_days: agingDays(submittedAt),
        total_charge: money(claim.total_charge),
        defer_until: (claim.defer_until as string | null) ?? null,
        deferred_reason: (claim.deferred_reason as string | null) ?? null,
        note_count: claimNotes.length,
        latest_note_excerpt: excerpt,
      };
    });

    return NextResponse.json({ success: true, organizationId, items });
  } catch (error) {
    console.error("No Response (claim-readiness) API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load no-response worklist",
      },
      { status: 500 },
    );
  }
}
