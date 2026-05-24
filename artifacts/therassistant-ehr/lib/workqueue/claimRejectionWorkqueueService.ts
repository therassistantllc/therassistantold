import { createServerSupabaseAdminClient } from "@/lib/supabase/server";
import {
  loadRejection277CaAutoRouteSettings,
  pickAutoRouteForRejection277Ca,
  type Rejection277CaTabId,
} from "@/lib/billing/rejections277ca";

type RejectionSource = "999" | "277CA";

const FAR_FUTURE_ISO = "9999-12-31T00:00:00.000Z";

type ParsedStcEntry = {
  category?: string | null;
  status?: string | null;
  entity?: string | null;
};

function extractStcEntries(parsed: Record<string, unknown> | null | undefined): ParsedStcEntry[] {
  if (!parsed) return [];
  const raw = (parsed as { stcStatuses?: unknown }).stcStatuses;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
    .map((e) => ({
      category: typeof e.category === "string" ? e.category : null,
      status: typeof e.status === "string" ? e.status : null,
      entity: typeof e.entity === "string" ? e.entity : null,
    }));
}

function pickStringField(
  parsed: Record<string, unknown> | null | undefined,
  keys: string[],
): string | null {
  if (!parsed) return null;
  for (const k of keys) {
    const v = (parsed as Record<string, unknown>)[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export interface RouteRejectedClaimsInput {
  organizationId: string;
  acknowledgementId: string;
  batchId: string;
  claimIds: string[];
  source: RejectionSource;
  outcome: "rejected" | "partial";
  parsedContent?: Record<string, unknown> | null;
}

export interface RouteRejectedClaimsResult {
  ok: boolean;
  created: number;
  skipped: number;
  autoRouted: number;
  errors: Array<{ field: string; message: string }>;
}

type ClaimRow = {
  id: string;
  patient_id: string | null;
  claim_number: string | null;
  patient_account_number: string | null;
  claim_status: string;
};

function workTypeForSource(source: RejectionSource) {
  return source === "999" ? "clearinghouse_rejection" : "payer_rejection";
}

function titleForSource(source: RejectionSource, claim: ClaimRow) {
  const claimLabel = claim.claim_number || claim.patient_account_number || claim.id;
  return source === "999"
    ? `999 clearinghouse rejection - claim ${claimLabel}`
    : `277CA payer rejection - claim ${claimLabel}`;
}

async function hasOpenWorkqueueItem(params: {
  organizationId: string;
  claimId: string;
  workType: string;
}) {
  const supabase = createServerSupabaseAdminClient();
  if (!supabase) throw new Error("Database connection not available");

  const { data, error } = await supabase
    .from("workqueue_items")
    .select("id")
    .eq("organization_id", params.organizationId)
    .eq("source_object_type", "professional_claim")
    .eq("source_object_id", params.claimId)
    .eq("work_type", params.workType)
    .in("status", ["open", "in_progress", "blocked"])
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data?.id);
}

export async function routeRejectedClaimsToWorkqueue(
  input: RouteRejectedClaimsInput
): Promise<RouteRejectedClaimsResult> {
  const supabase = createServerSupabaseAdminClient();
  if (!supabase) {
    return {
      ok: false,
      created: 0,
      skipped: 0,
      autoRouted: 0,
      errors: [{ field: "system", message: "Database connection not available" }],
    };
  }

  if (!input.claimIds.length) {
    return { ok: true, created: 0, skipped: 0, autoRouted: 0, errors: [] };
  }

  const workType = workTypeForSource(input.source);
  const { data: claims, error: claimError } = await supabase
    .from("professional_claims")
    .select("id, patient_id, claim_number, patient_account_number, claim_status")
    .eq("organization_id", input.organizationId)
    .in("id", input.claimIds);

  if (claimError) {
    return {
      ok: false,
      created: 0,
      skipped: 0,
      autoRouted: 0,
      errors: [{ field: "professional_claims", message: claimError.message }],
    };
  }

  let created = 0;
  let skipped = 0;
  let autoRouted = 0;
  const errors: Array<{ field: string; message: string }> = [];
  const now = new Date().toISOString();

  // Per-org auto-routing config (277CA only). Default is "on", so a
  // freshly-arrived rejection that's obviously an eligibility or
  // credentialing issue gets deferred immediately instead of waiting
  // for a biller to click "Route to …".
  const autoRouteSettings =
    input.source === "277CA"
      ? await loadRejection277CaAutoRouteSettings(supabase, input.organizationId)
      : null;

  // Classify once at the batch level. The current 277CA parser only emits
  // batch-level STC entries (no per-claim breakdown), so every claim in
  // this batch shares the same auto-route decision.
  let autoRouteDecision: ReturnType<typeof pickAutoRouteForRejection277Ca> = null;
  if (input.source === "277CA" && autoRouteSettings?.enabled) {
    const stcEntries = extractStcEntries(input.parsedContent ?? null);
    const message = pickStringField(input.parsedContent ?? null, [
      "rejection_reason",
      "status_message",
      "message",
      "free_form_message",
    ]);
    const decision = pickAutoRouteForRejection277Ca({
      stcEntries,
      message,
      categoryCode: pickStringField(input.parsedContent ?? null, [
        "category_code",
        "stc_category_code",
      ]),
      statusCode: pickStringField(input.parsedContent ?? null, [
        "status_code",
        "stc_status_code",
      ]),
      entityCode: pickStringField(input.parsedContent ?? null, [
        "entity_code",
        "stc_entity_code",
      ]),
    });
    if (
      (decision?.tab === "invalid_member" && autoRouteSettings.routeInvalidMember) ||
      (decision?.tab === "invalid_provider" && autoRouteSettings.routeInvalidProvider)
    ) {
      autoRouteDecision = decision;
    }
  }

  for (const claim of (claims ?? []) as ClaimRow[]) {
    try {
      const exists = await hasOpenWorkqueueItem({
        organizationId: input.organizationId,
        claimId: claim.id,
        workType,
      });

      if (exists) {
        skipped += 1;
        continue;
      }

      const baseContext: Record<string, unknown> = {
        source: input.source,
        outcome: input.outcome,
        acknowledgement_id: input.acknowledgementId,
        edi_batch_id: input.batchId,
        claim_status: claim.claim_status,
        claim_number: claim.claim_number,
        patient_account_number: claim.patient_account_number,
        parsed_content: input.parsedContent ?? {},
      };

      if (autoRouteDecision) {
        baseContext.auto_routed = true;
        baseContext.auto_routed_tab = autoRouteDecision.tab as Rejection277CaTabId;
        baseContext.auto_routed_reason = autoRouteDecision.reason;
        baseContext.auto_routed_at = now;
      }

      const insertRow: Record<string, unknown> = {
        organization_id: input.organizationId,
        title: titleForSource(input.source, claim),
        description:
          input.source === "999"
            ? "The clearinghouse 999 acknowledgement rejected this claim batch. Review the acknowledgement details and correct the claim before rebilling."
            : "The 277CA acknowledgement rejected this claim at the clearinghouse/payer acceptance stage. Review the STC details and correct the claim before rebilling.",
        work_type: workType,
        status: "open",
        priority: "high",
        source_object_type: "professional_claim",
        source_object_id: claim.id,
        client_id: claim.patient_id,
        professional_claim_id: claim.id,
        context_payload: baseContext,
        created_at: now,
        updated_at: now,
      };

      // Auto-routed items stay visible in the 277CA queue (status=open,
      // not archived) so the biller can override. We mark them with
      // deferred_until + defer_reason, matching what the manual
      // "Route to eligibility / enrollment" action produces.
      if (autoRouteDecision) {
        insertRow.deferred_until = FAR_FUTURE_ISO;
        insertRow.defer_reason = autoRouteDecision.reason;
      }

      const { error: insertError } = await (supabase as unknown as {
        from: (t: string) => { insert: (r: Record<string, unknown>) => Promise<{ error: { message: string } | null }> };
      })
        .from("workqueue_items")
        .insert(insertRow);

      if (insertError) throw new Error(insertError.message);
      created += 1;
      if (autoRouteDecision) autoRouted += 1;
    } catch (error) {
      errors.push({
        field: claim.id,
        message: error instanceof Error ? error.message : "Failed to create rejection workqueue item",
      });
    }
  }

  return { ok: errors.length === 0, created, skipped, autoRouted, errors };
}
