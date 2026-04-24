import type { ScheduleRepository } from "../../services/interfaces";
import type { DbClient } from "./helpers";
import { buildScheduleDateRange } from "./helpers";

export function createSupabaseScheduleRepository(db: DbClient): ScheduleRepository {
  return {
    async getScheduleDay(request) {
      const { start, end } = buildScheduleDateRange(request.date);

      let query = db
        .from("appointments")
        .select(
          `
          id,
          organization_id,
          client_id,
          scheduled_start_at,
          scheduled_end_at,
          appointment_status,
          appointment_type,
          insurance_policy_id,
          provider_id,
          encounter:encounters(id,note_status),
          client:clients(first_name,last_name),
          claim:claims(id,claim_status),
          policy:insurance_policies(payer_name),
          provider:providers(first_name,last_name)
        `,
          { count: "exact" },
        )
        .eq("organization_id", request.organization_id)
        .gte("scheduled_start_at", start)
        .lte("scheduled_start_at", end)
        .order("scheduled_start_at", { ascending: true });

      if (request.provider_id) query = query.eq("provider_id", request.provider_id);
      if (request.location_id) query = query.eq("provider_location_id", request.location_id);
      if (request.limit) query = query.limit(request.limit);
      if (request.offset) query = query.range(request.offset, (request.offset + (request.limit ?? 50)) - 1);

      const { data, error, count } = await query;
      if (error) throw new Error(error.message);

      const rows = (data ?? []).map((row: any) => ({
        appointment_id: row.id,
        organization_id: row.organization_id,
        client_id: row.client_id,
        encounter_id: row.encounter?.id ?? null,
        scheduled_start_at: row.scheduled_start_at,
        scheduled_end_at: row.scheduled_end_at,
        appointment_status: row.appointment_status,
        appointment_type: row.appointment_type ?? null,
        client_full_name: [row.client?.first_name, row.client?.last_name].filter(Boolean).join(" "),
        provider_id: row.provider_id,
        provider_full_name: [row.provider?.first_name, row.provider?.last_name].filter(Boolean).join(" "),
        insurance_policy_id: row.insurance_policy_id ?? null,
        payer_name: row.policy?.payer_name ?? null,
        eligibility_status: null,
        eligibility_checked_at: null,
        eligibility_stale: false,
        note_status: row.encounter?.note_status ?? null,
        claim_id: row.claim?.id ?? null,
        claim_status: row.claim?.claim_status ?? null,
        client_balance: "0.00",
        open_alert_count: 0,
        open_workqueue_count: 0,
      }));

      return {
        total: count ?? rows.length,
        rows,
      };
    },
  };
}
