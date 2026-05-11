import { createServerSupabaseAdminClient } from "@/lib/supabase/server";

export interface RouteAgingProfessionalClaimsInput {
  organizationId: string;
  agingDays?: number;
  now?: string;
}

export interface RouteAgingProfessionalClaimsResult {
  ok: boolean;
  reviewed: number;
  created: number;
  skipped: number;
  errors: Array<{ field: string; message: string }>;
}

type ClaimRow = {
  id: string;
  patient_id: string | null;
  claim_number: string | null;
  patient_account_number: string | null;
  claim_status: string;
  updated_at: string | null;
};

function cutoffIso(days: number, now?: string) {
  const base = now ? new Date(now) : new Date();
  return new Date(base.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function claimLabel(claim: ClaimRow) {
  return claim.claim_number || claim.patient_account_number || claim.id;
}

async function hasOpenNoResponseItem(organizationId: string, claimId: string) {
  const supabase = createServerSupabaseAdminClient();
  if (!supabase) throw new Error("Database connection not available");

  const { data, error } = await supabase
    .from("workqueue_items")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("source_object_type", "professional_claim")
    .eq("source_object_id", claimId)
    .eq("work_type", "no_response")
    .in("status", ["open", "in_progress", "blocked"])
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data?.id);
}

async function hasPostSubmissionResponse(claimId: string) {
  const supabase = createServerSupabaseAdminClient();
  if (!supabase) throw new Error("Database connection not available");

  const { data: batchLinks, error: linkError } = await supabase
    .from("edi_batch_claims")
    .select("edi_batch_id")
    .eq("claim_id", claimId);

  if (linkError) throw new Error(linkError.message);
  const batchIds = (batchLinks ?? []).map((row: { edi_batch_id: string }) => row.edi_batch_id);
  if (batchIds.length === 0) return false;

  const { data: acknowledgements, error: ackError } = await supabase
    .from("edi_acknowledgements")
    .select("id")
    .in("edi_batch_id", batchIds)
    .in("acknowledgement_type", ["999", "277CA", "835"])
    .limit(1);

  if (ackError) throw new Error(ackError.message);
  return Boolean(acknowledgements && acknowledgements.length > 0);
}

export async function routeAgingProfessionalClaimsToWorkqueue(
  input: RouteAgingProfessionalClaimsInput
): Promise<RouteAgingProfessionalClaimsResult> {
  const supabase = createServerSupabaseAdminClient();
  if (!supabase) {
    return {
      ok: false,
      reviewed: 0,
      created: 0,
      skipped: 0,
      errors: [{ field: "system", message: "Database connection not available" }],
    };
  }

  const agingDays = input.agingDays ?? 7;
  const cutoff = cutoffIso(agingDays, input.now);
  const now = input.now ?? new Date().toISOString();

  const { data: claims, error: claimError } = await supabase
    .from("professional_claims")
    .select("id, patient_id, claim_number, patient_account_number, claim_status, updated_at")
    .eq("organization_id", input.organizationId)
    .eq("claim_status", "submitted")
    .lt("updated_at", cutoff)
    .order("updated_at", { ascending: true })
    .limit(250);

  if (claimError) {
    return {
      ok: false,
      reviewed: 0,
      created: 0,
      skipped: 0,
      errors: [{ field: "professional_claims", message: claimError.message }],
    };
  }

  let created = 0;
  let skipped = 0;
  const errors: Array<{ field: string; message: string }> = [];
  const rows = (claims ?? []) as ClaimRow[];

  for (const claim of rows) {
    try {
      if (await hasOpenNoResponseItem(input.organizationId, claim.id)) {
        skipped += 1;
        continue;
      }

      if (await hasPostSubmissionResponse(claim.id)) {
        skipped += 1;
        continue;
      }

      const { error: insertError } = await supabase.from("workqueue_items").insert({
        organization_id: input.organizationId,
        title: `No response received - claim ${claimLabel(claim)}`,
        description:
          "Professional claim remains submitted with no recorded 999, 277CA, or ERA response after the configured aging threshold. Review clearinghouse status and follow up.",
        work_type: "no_response",
        status: "open",
        priority: "high",
        source_object_type: "professional_claim",
        source_object_id: claim.id,
        client_id: claim.patient_id,
        claim_id: claim.id,
        context_payload: {
          claim_status: claim.claim_status,
          claim_number: claim.claim_number,
          patient_account_number: claim.patient_account_number,
          aging_days: agingDays,
          cutoff,
          last_updated_at: claim.updated_at,
        },
        created_at: now,
        updated_at: now,
      });

      if (insertError) throw new Error(insertError.message);
      created += 1;
    } catch (error) {
      errors.push({
        field: claim.id,
        message: error instanceof Error ? error.message : "Failed to create aging workqueue item",
      });
    }
  }

  return {
    ok: errors.length === 0,
    reviewed: rows.length,
    created,
    skipped,
    errors,
  };
}
