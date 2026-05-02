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
 * Covers: eligibility, billing readiness, claim lifecycle, payments, mailroom, VCC, check-ins
 * Implements idempotent duplicate prevention
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

    // Helper function to check for existing workqueue item
    async function hasExistingItem(sourceId: string, workType: string) {
      if (!supabase) return false;
      const { data } = await supabase
        .from("workqueue_items")
        .select("id")
        .eq("source_object_id", sourceId)
        .eq("work_type", workType)
        .in("work_status", ["queued", "in_progress"])
        .maybeSingle();
      return !!data;
    }

    // 1. ELIGIBILITY: Find checks that are not_checked or stale
    const { data: eligibilityChecks } = await supabase
      .from("eligibility_checks")
      .select("id, appointment_id, patient_id, organization_id, eligibility_status, checked_at")
      .or(`eligibility_status.eq.not_checked,checked_at.lt.${thirtyDaysAgo}`)
      .is("archived_at", null);

    if (eligibilityChecks) {
      for (const check of eligibilityChecks) {
        if (await hasExistingItem(check.id, "eligibility_needed")) continue;

        const payload = {
          id: generateUuid(),
          organization_id: check.organization_id,
          title: `Eligibility check needed - ${check.eligibility_status || "stale"}`,
          work_type: "eligibility_needed",
          work_status: "queued",
          priority: "medium",
          source_object_type: "eligibility_check",
          source_object_id: check.id,
          patient_id: check.patient_id,
          appointment_id: check.appointment_id,
          created_at: now,
          updated_at: now,
        };

        const { data: created } = await supabase
          .from("workqueue_items")
          .insert(payload)
          .select()
          .single();

        if (created) itemsCreated.push(created);
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

        if (!claim && !(await hasExistingItem(encounter.id, "ready_to_bill"))) {
          const payload = {
            id: generateUuid(),
            organization_id: encounter.organization_id,
            title: `Encounter ready to bill - no claim created`,
            work_type: "ready_to_bill",
            work_status: "queued",
            priority: "high",
            source_object_type: "encounter",
            source_object_id: encounter.id,
            patient_id: encounter.patient_id,
            encounter_id: encounter.id,
            created_at: now,
            updated_at: now,
          };

          const { data: created } = await supabase
            .from("workqueue_items")
            .insert(payload)
            .select()
            .single();

          if (created) itemsCreated.push(created);
        }
      }
    }

    // 3. Find submitted claims without responses (no_response)
    const { data: claimsWithoutResponse } = await supabase
      .from("claims")
      .select("id, patient_id, encounter_id, claim_id, organization_id, claim_status, updated_at")
      .eq("claim_status", "submitted")
      .lt("updated_at", thirtyDaysAgo)
      .is("archived_at", null);

    if (claimsWithoutResponse) {
      for (const claim of claimsWithoutResponse) {
        if (await hasExistingItem(claim.id, "no_response")) continue;

        const payload = {
          id: generateUuid(),
          organization_id: claim.organization_id,
          title: `Claim submitted over 30 days ago - no response`,
          work_type: "no_response",
          work_status: "queued",
          priority: "high",
          source_object_type: "claim",
          source_object_id: claim.id,
          patient_id: claim.patient_id,
          encounter_id: claim.encounter_id,
          claim_id: claim.claim_id,
          created_at: now,
          updated_at: now,
        };

        const { data: created } = await supabase
          .from("workqueue_items")
          .insert(payload)
          .select()
          .single();

        if (created) itemsCreated.push(created);
      }
    }

    // 4. Find denied or rejected claims
    const { data: deniedClaims } = await supabase
      .from("claims")
      .select("id, patient_id, encounter_id, claim_id, organization_id, claim_status")
      .in("claim_status", ["denied", "rejected"])
      .is("archived_at", null);

    if (deniedClaims) {
      for (const claim of deniedClaims) {
        if (await hasExistingItem(claim.id, "denial_followup")) continue;

        const payload = {
          id: generateUuid(),
          organization_id: claim.organization_id,
          title: `Claim ${claim.claim_status} - needs review`,
          work_type: "denial_followup",
          work_status: "queued",
          priority: "high",
          source_object_type: "claim",
          source_object_id: claim.id,
          patient_id: claim.patient_id,
          encounter_id: claim.encounter_id,
          claim_id: claim.claim_id,
          created_at: now,
          updated_at: now,
        };

        const { data: created } = await supabase
          .from("workqueue_items")
          .insert(payload)
          .select()
          .single();

        if (created) itemsCreated.push(created);
      }
    }

    // 5. Find payment imports ready for posting
    const { data: paymentImports } = await supabase
      .from("payment_import_items")
      .select("id, patient_id, claim_id, organization_id")
      .eq("posting_ready", true)
      .is("archived_at", null);

    if (paymentImports) {
      for (const paymentItem of paymentImports) {
        // Check if payment_posting already exists
        const { data: posting } = await supabase
          .from("payment_postings")
          .select("id")
          .eq("payment_import_item_id", paymentItem.id)
          .maybeSingle();

        if (!posting && !(await hasExistingItem(paymentItem.id, "payment_posting_needed"))) {
          const payload = {
            id: generateUuid(),
            organization_id: paymentItem.organization_id,
            title: `Payment ready to post`,
            work_type: "payment_posting_needed",
            work_status: "queued",
            priority: "medium",
            source_object_type: "payment_import_item",
            source_object_id: paymentItem.id,
            patient_id: paymentItem.patient_id,
            claim_id: paymentItem.claim_id,
            created_at: now,
            updated_at: now,
          };

          const { data: created } = await supabase
            .from("workqueue_items")
            .insert(payload)
            .select()
            .single();

          if (created) itemsCreated.push(created);
        }
      }
    }

    // 6. Find mailroom items needing review
    const { data: mailroomItems } = await supabase
      .from("mailroom_items")
      .select("id, organization_id, patient_id")
      .eq("status", "needs_review")
      .is("archived_at", null);

    if (mailroomItems) {
      for (const item of mailroomItems) {
        if (await hasExistingItem(item.id, "mailroom")) continue;

        const payload = {
          id: generateUuid(),
          organization_id: item.organization_id,
          title: `Document needs review and filing`,
          work_type: "mailroom",
          work_status: "queued",
          priority: "medium",
          source_object_type: "mailroom_item",
          source_object_id: item.id,
          patient_id: item.patient_id,
          created_at: now,
          updated_at: now,
        };

        const { data: created } = await supabase
          .from("workqueue_items")
          .insert(payload)
          .select()
          .single();

        if (created) itemsCreated.push(created);
      }
    }

    // 7. Find VCC payments pending processing
    const { data: vccPayments } = await supabase
      .from("vcc_payments")
      .select("id, organization_id, patient_id, claim_id")
      .eq("status", "pending")
      .is("archived_at", null);

    if (vccPayments) {
      for (const vcc of vccPayments) {
        if (await hasExistingItem(vcc.id, "vcc_processing")) continue;

        const payload = {
          id: generateUuid(),
          organization_id: vcc.organization_id,
          title: `VCC payment pending processing`,
          work_type: "vcc_processing",
          work_status: "queued",
          priority: "high",
          source_object_type: "vcc_payment",
          source_object_id: vcc.id,
          patient_id: vcc.patient_id,
          claim_id: vcc.claim_id,
          created_at: now,
          updated_at: now,
        };

        const { data: created } = await supabase
          .from("workqueue_items")
          .insert(payload)
          .select()
          .single();

        if (created) itemsCreated.push(created);
      }
    }

    // 8. Find patient check-ins submitted
    const { data: checkins } = await supabase
      .from("patient_checkins")
      .select("id, organization_id, patient_id, appointment_id")
      .eq("status", "submitted")
      .is("archived_at", null);

    if (checkins) {
      for (const checkin of checkins) {
        if (await hasExistingItem(checkin.id, "checkin_review")) continue;

        const payload = {
          id: generateUuid(),
          organization_id: checkin.organization_id,
          title: `Patient check-in submitted - needs review`,
          work_type: "checkin_review",
          work_status: "queued",
          priority: "medium",
          source_object_type: "patient_checkin",
          source_object_id: checkin.id,
          patient_id: checkin.patient_id,
          appointment_id: checkin.appointment_id,
          created_at: now,
          updated_at: now,
        };

        const { data: created } = await supabase
          .from("workqueue_items")
          .insert(payload)
          .select()
          .single();

        if (created) itemsCreated.push(created);
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
