import type { TicketRepository } from "../../services/interfaces";
import type { DbClient } from "./helpers";
import { expectMany } from "./helpers";

export function createSupabaseTicketRepository(db: DbClient): TicketRepository {
  return {
    async listByClaimId(organization_id, claim_id) {
      return expectMany(
        db
          .from("support_tickets")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("source_object_type", "claim")
          .eq("source_object_id", claim_id)
          .is("archived_at", null)
          .order("created_at", { ascending: false }),
      );
    },
  };
}
