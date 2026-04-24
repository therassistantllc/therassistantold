// File: backend/src/repositories/supabase/client-repository.ts
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
          .is("archived_at", null)
          .maybeSingle(),
      );
    },

    async getBillingSnapshot(_organization_id, client_id) {
      return {
        client_id,
        insurance_balance: "0.00",
        patient_balance: "0.00",
        total_balance: "0.00",
        unposted_amount: "0.00",
      };
    },
  };
}