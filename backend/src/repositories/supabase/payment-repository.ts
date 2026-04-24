import type { PaymentRepository } from "../../services/interfaces";
import type { DbClient } from "./helpers";
import { expectMany, expectOne } from "./helpers";

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

    async listUnpostedPayments(organization_id) {
      const rows = await expectMany<any>(
        db
          .from("payment_import_items")
          .select(
            `
            id,
            payment_import_status,
            payment_date,
            net_amount,
            unapplied_amount,
            batch:payment_import_batches(import_source, imported_at),
            payer:insurance_payers(payer_name),
            client:clients(first_name,last_name)
          `,
          )
          .eq("organization_id", organization_id)
          .is("archived_at", null)
          .neq("payment_import_status", "posted")
          .order("created_at", { ascending: false })
          .limit(200),
      );

      return rows.map((row) => ({
        id: String(row.id),
        source_type: row.batch?.import_source || "import",
        payer_name: row.payer?.payer_name || null,
        patient_name:
          [row.client?.first_name, row.client?.last_name].filter(Boolean).join(" ").trim() ||
          null,
        received_at: row.payment_date || row.batch?.imported_at || null,
        amount: row.unapplied_amount ?? row.net_amount ?? 0,
        status: row.payment_import_status || "imported",
      }));
    },
  };
}
