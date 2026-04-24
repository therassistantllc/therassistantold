// File: backend/src/repositories/supabase/workqueue-repository.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkqueueItemRecord } from "../../../../shared/contracts";
import type { WorkqueueRepository } from "../../services/interfaces";

const OPEN_STATUSES = ["open", "in_progress", "blocked"] as const;

function orderByNewest<T extends { created_at?: string | null }>(rows: T[] | null | undefined): T[] {
  return [...(rows ?? [])].sort((a, b) => {
    const left = a.created_at ? new Date(a.created_at).getTime() : 0;
    const right = b.created_at ? new Date(b.created_at).getTime() : 0;
    return right - left;
  });
}

export function createSupabaseWorkqueueRepository(
  supabase: SupabaseClient,
): WorkqueueRepository {
  return {
    async findOpenBySource(
      organization_id: string,
      source_object_type: "encounter" | "claim",
      source_object_id: string,
    ): Promise<WorkqueueItemRecord | null> {
      const { data, error } = await supabase
        .from("workqueue_items")
        .select("*")
        .eq("organization_id", organization_id)
        .eq("source_object_type", source_object_type)
        .eq("source_object_id", source_object_id)
        .in("status", [...OPEN_STATUSES])
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return (data as WorkqueueItemRecord | null) ?? null;
    },

    async create(item: WorkqueueItemRecord): Promise<WorkqueueItemRecord> {
      const { data, error } = await supabase
        .from("workqueue_items")
        .insert(item)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      return data as WorkqueueItemRecord;
    },

    async update(item: WorkqueueItemRecord): Promise<WorkqueueItemRecord> {
      const { data, error } = await supabase
        .from("workqueue_items")
        .update(item)
        .eq("organization_id", item.organization_id)
        .eq("id", item.id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      return data as WorkqueueItemRecord;
    },

    async listByClaimId(
      organization_id: string,
      claim_id: string,
    ): Promise<WorkqueueItemRecord[]> {
      const { data, error } = await supabase
        .from("workqueue_items")
        .select("*")
        .eq("organization_id", organization_id)
        .eq("claim_id", claim_id)
        .is("archived_at", null);

      if (error) {
        throw error;
      }

      return orderByNewest(data as WorkqueueItemRecord[]);
    },

    async listByEncounterId(
      organization_id: string,
      encounter_id: string,
    ): Promise<WorkqueueItemRecord[]> {
      const { data, error } = await supabase
        .from("workqueue_items")
        .select("*")
        .eq("organization_id", organization_id)
        .eq("encounter_id", encounter_id)
        .is("archived_at", null);

      if (error) {
        throw error;
      }

      return orderByNewest(data as WorkqueueItemRecord[]);
    },
  };
}
