import type { ClaimRepository } from "../../services/interfaces";
import type { DbClient } from "./helpers";
import { expectMany, expectOne } from "./helpers";

export function createSupabaseClaimRepository(db: DbClient): ClaimRepository {
  return {
    async getById(organization_id, claim_id) {
      return expectOne(
        db
          .from("claims")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("id", claim_id)
          .maybeSingle(),
      );
    },

    async getByEncounterId(organization_id, encounter_id) {
      return expectOne(
        db
          .from("claims")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("encounter_id", encounter_id)
          .is("archived_at", null)
          .maybeSingle(),
      );
    },

    async listServiceLines(organization_id, claim_id) {
      return expectMany(
        db
          .from("claim_service_lines")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("claim_id", claim_id)
          .is("archived_at", null)
          .order("sequence_number", { ascending: true }),
      );
    },

    async listSubmissions(organization_id, claim_id) {
      return expectMany(
        db
          .from("claim_submissions")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("claim_id", claim_id)
          .is("archived_at", null)
          .order("submission_sequence", { ascending: true }),
      );
    },

    async listStatusInquiries(organization_id, claim_id) {
      return expectMany(
        db
          .from("claim_status_inquiries")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("claim_id", claim_id)
          .is("archived_at", null)
          .order("requested_at", { ascending: false }),
      );
    },

    async listReadyToSubmit(organization_id) {
      const rows = await expectMany<any>(
        db
          .from("claims")
          .select(
            `
            id,
            claim_number,
            date_of_service_from,
            total_charge_amount,
            last_blocker_codes,
            client:clients(first_name,last_name),
            policy:insurance_policies(
              payer:insurance_payers(payer_name)
            )
          `,
          )
          .eq("organization_id", organization_id)
          .eq("claim_status", "ready_to_submit")
          .is("archived_at", null)
          .order("created_at", { ascending: false }),
      );

      return rows.map((row) => ({
        claim_id: String(row.id),
        claim_number: String(row.claim_number || row.id),
        client_name: [row.client?.first_name, row.client?.last_name]
          .filter(Boolean)
          .join(" ")
          .trim() || null,
        payer_name: row.policy?.payer?.payer_name || null,
        date_of_service_from: String(row.date_of_service_from || ""),
        total_charge_amount: Number(row.total_charge_amount || 0),
        readiness_status:
          Array.isArray(row.last_blocker_codes) && row.last_blocker_codes.length > 0
            ? "blocked"
            : "ready",
        blockers: Array.isArray(row.last_blocker_codes) ? row.last_blocker_codes : [],
        warnings: [],
      }));
    },

    async listSubmissionBatches(organization_id) {
      const rows = await expectMany<any>(
        db
          .from("claim_submissions")
          .select(
            `
            id,
            submission_sequence,
            created_at,
            submission_status,
            claim:claims(total_charge_amount)
          `,
          )
          .eq("organization_id", organization_id)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(100),
      );

      return rows.map((row) => ({
        id: String(row.id),
        batch_number: `SUB-${String(row.submission_sequence || 1).padStart(4, "0")}`,
        created_at: String(row.created_at || ""),
        claim_count: 1,
        total_charge_amount: row.claim?.total_charge_amount ?? "0.00",
        status: String(row.submission_status || "queued"),
      }));
    },

    async createClaim(claim, service_lines) {
      const { data: insertedClaim, error: claimError } = await db
        .from("claims")
        .insert(claim)
        .select("*")
        .single();

      if (claimError) throw new Error(claimError.message);

      const claimId = insertedClaim.id;
      const lineRows = service_lines.map((line) => ({ ...line, claim_id: claimId }));

      const { data: insertedLines, error: lineError } = await db
        .from("claim_service_lines")
        .insert(lineRows)
        .select("*");

      if (lineError) throw new Error(lineError.message);

      return {
        claim: insertedClaim,
        service_lines: insertedLines ?? [],
      };
    },
  };
}
