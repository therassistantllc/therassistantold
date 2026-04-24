import type { InsuranceRepository } from "../../services/interfaces";
import type { DbClient } from "./helpers";
import { expectOne } from "./helpers";

export function createSupabaseInsuranceRepository(db: DbClient): InsuranceRepository {
  return {
    async getPrimaryPolicyForEncounter(organization_id, encounter_id) {
      const { data: encounter, error: encounterError } = await db
        .from("encounters")
        .select("client_id")
        .eq("organization_id", organization_id)
        .eq("id", encounter_id)
        .maybeSingle();

      if (encounterError) throw new Error(encounterError.message);
      if (!encounter?.client_id) return null;

      return expectOne(
        db
          .from("insurance_policies")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("client_id", encounter.client_id)
          .eq("is_primary", True)
          .is("archived_at", null)
          .maybeSingle(),
      );
    },

    async getLatestEligibilityForEncounter(organization_id, encounter_id) {
      return expectOne(
        db
          .from("eligibility_checks")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("encounter_id", encounter_id)
          .is("archived_at", null)
          .order("checked_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      );
    },

    async getActiveAuthorizationForEncounter(organization_id, encounter_id) {
      return expectOne(
        db
          .from("authorization_or_referral")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("encounter_id", encounter_id)
          .in("authorization_status", ["approved", "pending", "not_required"])
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      );
    },
  };
}
