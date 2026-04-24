import type { ClientRepository } from "../../services/interfaces";
import type { DbClient } from "./helpers";
import { expectOne } from "./helpers";

export function createSupabaseClientRepository(db: DbClient): ClientRepository {
  return {
    async getById(organization_id, client_id) {
      return expectOne(
        db
          .from("clients")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("id", client_id)
          .maybeSingle(),
      );
    },

    async getBillingSnapshot(organization_id, client_id) {
      const { data: claimRows, error } = await db
        .from("claims")
        .select("remaining_insurance_balance,remaining_patient_balance")
        .eq("organization_id", organization_id)
        .eq("client_id", client_id)
        .is("archived_at", null);

      if (error) throw new Error(error.message);

      const insurance = (claimRows ?? []).reduce(
        (sum: number, row: any) => sum + Number(row.remaining_insurance_balance ?? "0"),
        0,
      );
      const patient = (claimRows ?? []).reduce(
        (sum: number, row: any) => sum + Number(row.remaining_patient_balance ?? "0"),
        0,
      );

      return {
        organization_id,
        client_id,
        client_balance: patient.toFixed(2),
        payer_balance: insurance.toFixed(2),
        total_open_claim_balance: (insurance + patient).toFixed(2),
        total_open_alert_count: 0,
        total_open_workqueue_count: 0,
        last_payment_posted_at: null,
      };
    },
  };
}
