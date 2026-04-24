import type { PaymentRepository } from "../../services/interfaces";
import type { DbClient } from "./helpers";
import { expectOne } from "./helpers";

export function createSupabasePaymentRepository(db: DbClient): PaymentRepository {
  return {
    async findPostingByReference(organization_id, posting_reference) {
      return expectOne(
        db
          .from("payment_postings")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("posting_reference", posting_reference)
          .maybeSingle(),
      );
    },
  };
}
