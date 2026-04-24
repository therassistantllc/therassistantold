// File: backend/src/repositories/supabase/insurance-repository.ts
import type { InsuranceRepository } from "../../services/interfaces";
import type { DbClient } from "./helpers";
import { expectMany, expectOne } from "./helpers";

export function createSupabaseInsuranceRepository(db: DbClient): InsuranceRepository {
  return {
    async getPrimaryPolicyForEncounter(organization_id, encounter_id) {
      const encounter = await expectOne<any>(
        db
          .from("encounters")
          .select("id, organization_id, appointment_id, client_id")
          .eq("organization_id", organization_id)
          .eq("id", encounter_id)
          .is("archived_at", null)
          .maybeSingle(),
      );

      if (!encounter) {
        return null;
      }

      const appointment = await expectOne<any>(
        db
          .from("appointments")
          .select(
            `
            id,
            organization_id,
            insurance_policy_id,
            policy:insurance_policies(
              id,
              organization_id,
              client_id,
              subscriber_id,
              payer_id,
              priority,
              plan_name,
              policy_number,
              effective_date,
              termination_date,
              copay_amount,
              coinsurance_percent,
              deductible_amount,
              out_of_pocket_max,
              active_flag,
              legacy_availity_plan_code,
              created_at,
              updated_at,
              created_by_user_id,
              updated_by_user_id,
              archived_at,
              subscriber:insurance_subscribers(
                id,
                first_name,
                last_name,
                member_id,
                relationship_to_client,
                date_of_birth
              ),
              payer:insurance_payers(
                id,
                payer_name,
                payer_id,
                payer_category,
                claims_address,
                remit_address,
                eligibility_endpoint
              )
            )
          `,
          )
          .eq("organization_id", organization_id)
          .eq("id", encounter.appointment_id)
          .is("archived_at", null)
          .maybeSingle(),
      );

      if (appointment?.policy) {
        const policy = appointment.policy;
        return {
          ...policy,
          payer_name: policy.payer?.payer_name ?? policy.plan_name ?? null,
          payer_external_id: policy.payer?.payer_id ?? null,
          member_id: policy.subscriber?.member_id ?? null,
          subscriber_first_name: policy.subscriber?.first_name ?? null,
          subscriber_last_name: policy.subscriber?.last_name ?? null,
          relationship_to_client: policy.subscriber?.relationship_to_client ?? null,
        };
      }

      const fallbackPolicies = await expectMany<any>(
        db
          .from("insurance_policies")
          .select(
            `
            id,
            organization_id,
            client_id,
            subscriber_id,
            payer_id,
            priority,
            plan_name,
            policy_number,
            effective_date,
            termination_date,
            copay_amount,
            coinsurance_percent,
            deductible_amount,
            out_of_pocket_max,
            active_flag,
            legacy_availity_plan_code,
            created_at,
            updated_at,
            created_by_user_id,
            updated_by_user_id,
            archived_at,
            subscriber:insurance_subscribers(
              id,
              first_name,
              last_name,
              member_id,
              relationship_to_client,
              date_of_birth
            ),
            payer:insurance_payers(
              id,
              payer_name,
              payer_id,
              payer_category,
              claims_address,
              remit_address,
              eligibility_endpoint
            )
          `,
          )
          .eq("organization_id", organization_id)
          .eq("client_id", encounter.client_id)
          .eq("active_flag", true)
          .is("archived_at", null)
          .order("priority", { ascending: true }),
      );

      const first = fallbackPolicies[0];
      if (!first) {
        return null;
      }

      return {
        ...first,
        payer_name: first.payer?.payer_name ?? first.plan_name ?? null,
        payer_external_id: first.payer?.payer_id ?? null,
        member_id: first.subscriber?.member_id ?? null,
        subscriber_first_name: first.subscriber?.first_name ?? null,
        subscriber_last_name: first.subscriber?.last_name ?? null,
        relationship_to_client: first.subscriber?.relationship_to_client ?? null,
      };
    },

    async getLatestEligibilityForEncounter(organization_id, encounter_id) {
      const encounter = await expectOne<any>(
        db
          .from("encounters")
          .select("id, organization_id, appointment_id, client_id")
          .eq("organization_id", organization_id)
          .eq("id", encounter_id)
          .is("archived_at", null)
          .maybeSingle(),
      );

      if (!encounter) {
        return null;
      }

      const policy = await this.getPrimaryPolicyForEncounter(organization_id, encounter_id);
      if (!policy) {
        return null;
      }

      const eligibility = await expectOne<any>(
        db
          .from("eligibility_checks")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("client_id", encounter.client_id)
          .eq("insurance_policy_id", policy.id)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      );

      return eligibility;
    },

    async getActiveAuthorizationForEncounter(_organization_id, _encounter_id) {
      return null;
    },
  };
}