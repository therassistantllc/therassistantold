import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";

function generateUuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Auto-generate workqueue items based on system state
 * - eligibility_needed: appointments with no eligibility or stale eligibility
 * - ready_to_bill: encounters without claims
 * - no_response: submitted claims without responses
 * - rejected: rejected claims
 * - era_missing: claims missing ERA responses
 */
export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 500 }
      );
    }

    const now = new Date().toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const itemsCreated = [];

    // 1. Find appointments needing eligibility checks
    const { data: appointmentsNeedingEligibility } = await supabase
      .from("appointment_eligibility_status")
      .select("appointment_id, patient_id, eligibility_status, last_checked_at")
      .in("eligibility_status", ["no_policy", "not_checked", "stale"])
      .is("archived_at", null);

    if (appointmentsNeedingEligibility) {
      for (const apt of appointmentsNeedingEligibility) {
        // Check if workqueue item already exists
        const { data: existing } = await supabase
          .from("workqueue_items")
          .select("id")
          .eq("appointment_id", apt.appointment_id)
          .eq("work_type", "eligibility_needed")
          .eq("work_status", "queued")
          .maybeSingle();

        if (!existing) {
          const payload = {
            id: generateUuid(),
            title: `Eligibility check needed - ${apt.eligibility_status}`,
            work_type: "eligibility_needed",
            work_status: "queued",
            priority: "medium",
            source_object_type: "appointment",
            source_object_id: apt.appointment_id,
            patient_id: apt.patient_id,
            appointment_id: apt.appointment_id,
            created_at: now,
            updated_at: now,
          };

          const { data: created } = await supabase
            .from("workqueue_items")
            .insert(payload)
            .select()
            .single();

          if (created) {
            itemsCreated.push(created);
          }
        }
      }
    }

    // 2. Find encounters without claims (ready to bill)
    const { data: encountersWithoutClaims } = await supabase
      .from("encounters")
      .select("id, patient_id, organization_id, encounter_status")
      .eq("encounter_status", "signed")
      .is("archived_at", null);

    if (encountersWithoutClaims) {
      for (const encounter of encountersWithoutClaims) {
        // Check if claim exists
        const { data: claim } = await supabase
          .from("claims")
          .select("id")
          .eq("encounter_id", encounter.id)
          .is("archived_at", null)
          .maybeSingle();

        if (!claim) {
          // Check if workqueue item already exists
          const { data: existing } = await supabase
            .from("workqueue_items")
            .select("id")
            .eq("encounter_id", encounter.id)
            .eq("work_type", "ready_to_bill")
            .eq("work_status", "queued")
            .maybeSingle();

          if (!existing) {
            const payload = {
              id: generateUuid(),
              title: `Encounter ready to bill - no claim created`,
              work_type: "ready_to_bill",
              work_status: "queued",
              priority: "high",
              source_object_type: "encounter",
              source_object_id: encounter.id,
              patient_id: encounter.patient_id,
              encounter_id: encounter.id,
              organization_id: encounter.organization_id,
              created_at: now,
              updated_at: now,
            };

            const { data: created } = await supabase
              .from("workqueue_items")
              .insert(payload)
              .select()
              .single();

            if (created) {
              itemsCreated.push(created);
            }
          }
        }
      }
    }

    // 3. Find submitted claims without responses (no_response)
    const { data: claimsWithoutResponse } = await supabase
      .from("claims")
      .select("id, patient_id, encounter_id, organization_id, claim_status, updated_at")
      .eq("claim_status", "submitted")
      .lt("updated_at", thirtyDaysAgo)
      .is("archived_at", null);

    if (claimsWithoutResponse) {
      for (const claim of claimsWithoutResponse) {
        // Check if workqueue item already exists
        const { data: existing } = await supabase
          .from("workqueue_items")
          .select("id")
          .eq("claim_id", claim.id)
          .eq("work_type", "no_response")
          .eq("work_status", "queued")
          .maybeSingle();

        if (!existing) {
          const payload = {
            id: generateUuid(),
            title: `Claim submitted over 30 days ago - no response`,
            work_type: "no_response",
            work_status: "queued",
            priority: "high",
            source_object_type: "claim",
            source_object_id: claim.id,
            patient_id: claim.patient_id,
            encounter_id: claim.encounter_id,
            claim_id: claim.id,
            organization_id: claim.organization_id,
            created_at: now,
            updated_at: now,
          };

          const { data: created } = await supabase
            .from("workqueue_items")
            .insert(payload)
            .select()
            .single();

          if (created) {
            itemsCreated.push(created);
          }
        }
      }
    }

    // 4. Find rejected claims
    const { data: rejectedClaims } = await supabase
      .from("claims")
      .select("id, patient_id, encounter_id, organization_id, claim_status")
      .eq("claim_status", "rejected")
      .is("archived_at", null);

    if (rejectedClaims) {
      for (const claim of rejectedClaims) {
        // Check if workqueue item already exists
        const { data: existing } = await supabase
          .from("workqueue_items")
          .select("id")
          .eq("claim_id", claim.id)
          .eq("work_type", "rejected")
          .eq("work_status", "queued")
          .maybeSingle();

        if (!existing) {
          const payload = {
            id: generateUuid(),
            title: `Claim rejected - needs review`,
            work_type: "rejected",
            work_status: "queued",
            priority: "high",
            source_object_type: "claim",
            source_object_id: claim.id,
            patient_id: claim.patient_id,
            encounter_id: claim.encounter_id,
            claim_id: claim.id,
            organization_id: claim.organization_id,
            created_at: now,
            updated_at: now,
          };

          const { data: created } = await supabase
            .from("workqueue_items")
            .insert(payload)
            .select()
            .single();

          if (created) {
            itemsCreated.push(created);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Workqueue sync completed`,
      itemsCreated: itemsCreated.length,
      items: itemsCreated,
    });
  } catch (error) {
    console.error("Workqueue sync error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Workqueue sync failed",
      },
      { status: 500 }
    );
  }
}
