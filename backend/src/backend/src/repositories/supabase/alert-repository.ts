import type { AlertRepository } from "../../services/interfaces";
import type { DbClient } from "./helpers";
import { expectMany } from "./helpers";

export function createSupabaseAlertRepository(db: DbClient): AlertRepository {
  return {
    async listOpenByClaimId(organization_id, claim_id) {
      return expectMany(
        db
          .from("billing_alerts")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("source_object_type", "claim")
          .eq("source_object_id", claim_id)
          .eq("status", "open")
          .is("archived_at", null)
          .order("created_at", { ascending: false }),
      );
    },

    async listOpenByEncounterId(organization_id, encounter_id) {
      return expectMany(
        db
          .from("billing_alerts")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("source_object_type", "encounter")
          .eq("source_object_id", encounter_id)
          .eq("status", "open")
          .is("archived_at", null)
          .order("created_at", { ascending: false }),
      );
    },
  };
}
