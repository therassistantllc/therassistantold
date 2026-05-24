/**
 * POST /api/billing/denials-by-rarc/notes
 *
 * Returns the historical resolution log (claim notes + relevant
 * audit_logs entries) for the set of claims in a RARC group, newest
 * first. Used by the "Historical resolution notes" detail tab.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";
import { requireBillingAccess } from "@/lib/billing/requireBillingAccess";

const text = (v: unknown) => String(v ?? "").trim();

interface Body {
  organizationId?: string;
  claimIds?: string[];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const guard = await requireBillingAccess({
      requestedOrganizationId: body.organizationId ?? null,
    });
    if (guard instanceof NextResponse) return guard;
    const organizationId = guard.organizationId;

    const claimIds = Array.isArray(body.claimIds)
      ? body.claimIds.map(text).filter(Boolean)
      : [];
    if (claimIds.length === 0) {
      return NextResponse.json({ success: true, entries: [] });
    }

    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Database not available" },
        { status: 500 },
      );
    }

    const [{ data: notes }, { data: audits }, { data: claims }] = await Promise.all([
      (supabase as any)
        .from("claim_notes")
        .select("id, claim_id, body, author_display_name, created_at")
        .eq("organization_id", organizationId)
        .in("claim_id", claimIds)
        .order("created_at", { ascending: false })
        .limit(200),
      (supabase as any)
        .from("audit_logs")
        .select("id, claim_id, event_type, event_summary, created_at")
        .eq("organization_id", organizationId)
        .in("claim_id", claimIds)
        .order("created_at", { ascending: false })
        .limit(200),
      (supabase as any)
        .from("professional_claims")
        .select("id, claim_number")
        .eq("organization_id", organizationId)
        .in("id", claimIds),
    ]);

    const numberByClaim = new Map<string, string>(
      ((claims as any[]) ?? []).map((c) => [text(c.id), text(c.claim_number)]),
    );

    type Entry = {
      id: string;
      kind: "note" | "audit";
      claimId: string;
      claimNumber: string;
      author: string;
      body: string;
      createdAt: string;
    };

    const entries: Entry[] = [];
    for (const n of ((notes as any[]) ?? [])) {
      entries.push({
        id: `note-${text(n.id)}`,
        kind: "note",
        claimId: text(n.claim_id),
        claimNumber: numberByClaim.get(text(n.claim_id)) ?? "",
        author: text(n.author_display_name) || "Staff",
        body: text(n.body),
        createdAt: text(n.created_at),
      });
    }
    for (const a of ((audits as any[]) ?? [])) {
      entries.push({
        id: `audit-${text(a.id)}`,
        kind: "audit",
        claimId: text(a.claim_id),
        claimNumber: numberByClaim.get(text(a.claim_id)) ?? "",
        author: text(a.event_type),
        body: text(a.event_summary),
        createdAt: text(a.created_at),
      });
    }

    entries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    return NextResponse.json({ success: true, entries });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
