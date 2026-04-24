import type { EncounterRepository } from "../../services/interfaces";
import type { DbClient } from "./helpers";
import { expectMany, expectOne } from "./helpers";

export function createSupabaseEncounterRepository(db: DbClient): EncounterRepository {
  return {
    async getById(organization_id, encounter_id) {
      return expectOne(
        db
          .from("encounters")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("id", encounter_id)
          .maybeSingle(),
      );
    },

    async getNoteByEncounterId(organization_id, encounter_id) {
      return expectOne(
        db
          .from("encounter_notes")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("encounter_id", encounter_id)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      );
    },

    async listDiagnoses(organization_id, encounter_id) {
      return expectMany(
        db
          .from("encounter_diagnoses")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("encounter_id", encounter_id)
          .is("archived_at", null)
          .order("sequence_number", { ascending: true }),
      );
    },

    async listServiceLines(organization_id, encounter_id) {
      return expectMany(
        db
          .from("encounter_service_lines")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("encounter_id", encounter_id)
          .is("archived_at", null)
          .order("sequence_number", { ascending: true }),
      );
    },
  };
}
