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
