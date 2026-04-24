// File: backend/src/repositories/supabase/ticket-repository.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupportTicketRecord } from "../../../../shared/contracts";
import type { TicketRepository } from "../../services/interfaces";

function orderByNewest<T extends { created_at?: string | null }>(rows: T[] | null | undefined): T[] {
  return [...(rows ?? [])].sort((a, b) => {
    const left = a.created_at ? new Date(a.created_at).getTime() : 0;
    const right = b.created_at ? new Date(b.created_at).getTime() : 0;
    return right - left;
  });
}

export function createSupabaseTicketRepository(
  supabase: SupabaseClient,
): TicketRepository & {
  listByEncounterId(organization_id: string, encounter_id: string): Promise<SupportTicketRecord[]>;
} {
  return {
    async create(ticket: SupportTicketRecord): Promise<SupportTicketRecord> {
      const { data, error } = await supabase
        .from("support_tickets")
        .insert(ticket)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      return data as SupportTicketRecord;
    },

    async listByClaimId(
      organization_id: string,
      claim_id: string,
    ): Promise<SupportTicketRecord[]> {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("organization_id", organization_id)
        .eq("source_object_type", "claim")
        .eq("source_object_id", claim_id)
        .is("archived_at", null);

      if (error) {
        throw error;
      }

      return orderByNewest(data as SupportTicketRecord[]);
    },

    async listByEncounterId(
      organization_id: string,
      encounter_id: string,
    ): Promise<SupportTicketRecord[]> {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("organization_id", organization_id)
        .eq("source_object_type", "encounter")
        .eq("source_object_id", encounter_id)
        .is("archived_at", null);

      if (error) {
        throw error;
      }

      return orderByNewest(data as SupportTicketRecord[]);
    },
  };
}
