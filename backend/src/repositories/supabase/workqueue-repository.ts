import type { WorkqueueRepository } from "../../services/interfaces";
import type { DbClient } from "./helpers";
import { expectMany, expectOne } from "./helpers";

export function createSupabaseWorkqueueRepository(db: DbClient): WorkqueueRepository {
  return {
    async findOpenBySource(organization_id, source_object_type, source_object_id) {
      return expectOne(
        db
          .from("workqueue_items")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("source_object_type", source_object_type)
          .eq("source_object_id", source_object_id)
          .in("status", ["new", "triage", "assigned", "waiting_external", "waiting_internal", "ready"])
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      );
    },

    async create(item) {
      const { data, error } = await db.from("workqueue_items").insert(item).select("*").single();
      if (error) throw new Error(error.message);
      return data;
    },

    async update(item) {
      const { data, error } = await db
        .from("workqueue_items")
        .update(item)
        .eq("organization_id", item.organization_id)
        .eq("id", item.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },

    async listByClaimId(organization_id, claim_id) {
      return expectMany(
        db
          .from("workqueue_items")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("claim_id", claim_id)
          .is("archived_at", null)
          .order("created_at", { ascending: false }),
      );
    },

    async listByEncounterId(organization_id, encounter_id) {
      return expectMany(
        db
          .from("workqueue_items")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("encounter_id", encounter_id)
          .is("archived_at", null)
          .order("created_at", { ascending: false }),
      );
    },
  };
}
