// File: backend/src/repositories/supabase/schedule-repository.ts
import type { ScheduleRepository } from "../../services/interfaces";
import type { DbClient } from "./helpers";
import { buildScheduleDateRange, expectMany, expectOne } from "./helpers";

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
          provider_location_id,
          reason,
          client:clients(first_name,last_name),
          policy:insurance_policies(
            plan_name,
            subscriber:insurance_subscribers(member_id)
          ),
          provider:providers(first_name,last_name,display_name)
        `,
          { count: "exact" },
        )
        .eq("organization_id", request.organization_id)
        .is("archived_at", null)
        .gte("scheduled_start_at", start)
        .lte("scheduled_start_at", end)
        .order("scheduled_start_at", { ascending: true });

      if (request.provider_id) {
        query = query.eq("provider_id", request.provider_id);
      }

      if (request.location_id) {
        query = query.eq("provider_location_id", request.location_id);
      }

      if (request.limit) {
        query = query.limit(request.limit);
      }

      if (request.offset) {
        query = query.range(
          request.offset,
          request.offset + (request.limit ?? 50) - 1,
        );
      }

      const { data, error, count } = await query;
      if (error) {
        throw new Error(error.message);
      }

      const appointmentIds = (data ?? [])
        .map((row: any) => row.id)
        .filter(Boolean);

      const encounters = appointmentIds.length
        ? await expectMany<any>(
            db
              .from("encounters")
              .select(
                `
                id,
                organization_id,
                appointment_id,
                encounter_status,
                service_date,
                required_billing_fields_complete,
                created_at
              `,
              )
              .eq("organization_id", request.organization_id)
              .in("appointment_id", appointmentIds)
              .is("archived_at", null)
              .order("created_at", { ascending: false }),
          )
        : [];

      const encounterByAppointmentId = new Map<string, any>();
      for (const encounter of encounters) {
        if (!encounter?.appointment_id) {
          continue;
        }

        if (!encounterByAppointmentId.has(encounter.appointment_id)) {
          encounterByAppointmentId.set(encounter.appointment_id, encounter);
        }
      }

      const encounterIds = Array.from(encounterByAppointmentId.values())
        .map((encounter) => encounter.id)
        .filter(Boolean);

      const claims = encounterIds.length
        ? await expectMany<any>(
            db
              .from("claims")
              .select("id, encounter_id, claim_status, created_at")
              .eq("organization_id", request.organization_id)
              .in("encounter_id", encounterIds)
              .is("archived_at", null)
              .order("created_at", { ascending: false }),
          )
        : [];

      const claimByEncounterId = new Map<string, any>();
      for (const claim of claims) {
        if (!claim?.encounter_id) {
          continue;
        }

        if (!claimByEncounterId.has(claim.encounter_id)) {
          claimByEncounterId.set(claim.encounter_id, claim);
        }
      }

      const rows = (data ?? []).map((row: any) => {
        const encounter = encounterByAppointmentId.get(row.id) ?? null;
        const claim = encounter ? claimByEncounterId.get(encounter.id) ?? null : null;

        const providerFullName =
          row.provider?.display_name ||
          [row.provider?.first_name, row.provider?.last_name]
            .filter(Boolean)
            .join(" ");

        return {
          appointment_id: row.id,
          organization_id: row.organization_id,
          client_id: row.client_id,
          encounter_id: encounter?.id ?? null,
          scheduled_start_at: row.scheduled_start_at,
          scheduled_end_at: row.scheduled_end_at,
          appointment_status: row.appointment_status,
          appointment_type: row.appointment_type ?? null,
          appointment_reason: row.reason ?? null,
          client_full_name: [row.client?.first_name, row.client?.last_name]
            .filter(Boolean)
            .join(" "),
          provider_id: row.provider_id,
          provider_full_name: providerFullName || "",
          insurance_policy_id: row.insurance_policy_id ?? null,
          payer_name: row.policy?.plan_name ?? null,
          member_id: row.policy?.subscriber?.member_id ?? null,
          eligibility_status: null,
          eligibility_checked_at: null,
          eligibility_stale: false,
          encounter_status: encounter?.encounter_status ?? null,
          note_status: null,
          claim_id: claim?.id ?? null,
          claim_status: claim?.claim_status ?? null,
          client_balance: "0.00",
          open_alert_count: 0,
          open_workqueue_count: 0,
        };
      });

      return {
        total: count ?? rows.length,
        rows,
      };
    },

    async getAppointmentById(organization_id, appointment_id) {
      return expectOne(
        db
          .from("appointments")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("id", appointment_id)
          .is("archived_at", null)
          .maybeSingle(),
      );
    },

    async getEncounterByAppointmentId(organization_id, appointment_id) {
      return expectOne(
        db
          .from("encounters")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("appointment_id", appointment_id)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      );
    },

    async createEncounterForAppointment(args) {
      const appointment = args.appointment as any;
      const scheduledStartAt = String(appointment.scheduled_start_at ?? "");
      const serviceDate = scheduledStartAt.slice(0, 10) || null;

      const created = await expectOne(
        db
          .from("encounters")
          .insert({
            organization_id: args.organization_id,
            appointment_id: appointment.id,
            client_id: appointment.client_id,
            provider_id: appointment.provider_id,
            encounter_status: "scheduled",
            service_date: serviceDate,
            required_billing_fields_complete: false,
            created_by_user_id: args.requested_by_user_id ?? null,
            updated_by_user_id: args.requested_by_user_id ?? null,
          })
          .select("*")
          .single(),
      );

      if (!created) {
        throw new Error("Failed to create encounter");
      }

      return created;
    },

    async setAppointmentEncounterIdIfColumnExists(
      organization_id,
      appointment_id,
      encounter_id,
    ) {
      const { error } = await db
        .from("appointments")
        .update({ encounter_id })
        .eq("organization_id", organization_id)
        .eq("id", appointment_id);

      if (!error) {
        return;
      }

      if (
        error.message.includes("encounter_id") &&
        (error.message.includes("column") ||
          error.message.includes("schema cache"))
      ) {
        return;
      }

      throw new Error(error.message);
    },
  };
}