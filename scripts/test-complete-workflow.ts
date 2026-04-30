#!/usr/bin/env tsx
/**
 * Complete Patient Workflow Test
 * 
 * Demonstrates the full patient journey:
 * Appointment → Encounter → Note → Claim → Submission → Payment
 * 
 * Usage: npx tsx scripts/test-complete-workflow.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

interface WorkflowResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Step 1: Create Appointment
 */
async function createAppointment(patientId: string): Promise<WorkflowResult> {
  console.log("\n📅 Step 1: Creating appointment...");

  const appointmentData = {
    client_id: patientId,
    provider_id: "11111111-1111-1111-1111-111111111111", // Use real provider ID
    appointment_type: "Initial Consultation",
    scheduled_start_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    scheduled_end_at: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(), // +1 hour
  };

  const { data, error } = await supabase
    .from("appointments")
    .insert(appointmentData)
    .select()
    .single();

  if (error) {
    console.error("❌ Failed to create appointment:", error.message);
    return { success: false, error: error.message };
  }

  console.log("✅ Appointment created:", data.id);
  return { success: true, data };
}

/**
 * Step 2: Create Encounter from Appointment
 */
async function createEncounter(params: {
  appointmentId: string;
  patientId: string;
}): Promise<WorkflowResult> {
  console.log("\n🏥 Step 2: Creating encounter...");

  const encounterData = {
    client_id: params.patientId,
    appointment_id: params.appointmentId,
    date_of_service: new Date().toISOString().split("T")[0],
    encounter_status: "open",
    place_of_service_code: "11", // Office
  };

  const { data, error } = await supabase
    .from("encounters")
    .insert(encounterData)
    .select()
    .single();

  if (error) {
    console.error("❌ Failed to create encounter:", error.message);
    return { success: false, error: error.message };
  }

  console.log("✅ Encounter created:", data.id);
  return { success: true, data };
}

/**
 * Step 3: Create and Sign Clinical Note
 */
async function createNote(params: {
  encounterId: string;
  status: string;
}): Promise<WorkflowResult> {
  console.log("\n📝 Step 3: Creating clinical note...");

  const noteData = {
    encounter_id: params.encounterId,
    subjective: "Patient reports improved mood and decreased anxiety symptoms.",
    objective: "Patient alert and oriented x4. Appropriate affect. Good eye contact.",
    assessment: "Depression, recurrent episode, moderate (F33.1)\nGeneralized anxiety disorder (F41.1)",
    plan: "Continue current medications. Follow up in 2 weeks. Crisis plan reviewed.",
    status: params.status,
    signed_at: params.status === "signed" ? new Date().toISOString() : null,
    risk_notes: "Low risk. Safety plan in place.",
    session_summary: "50-minute psychotherapy session focused on cognitive behavioral techniques.",
  };

  const { data, error } = await supabase
    .from("encounter_notes")
    .insert(noteData)
    .select()
    .single();

  if (error) {
    console.error("❌ Failed to create note:", error.message);
    return { success: false, error: error.message };
  }

  console.log(`✅ Note created and ${params.status}:`, data.id);
  return { success: true, data };
}

/**
 * Step 4: Create Claim with Service Lines
 */
async function createClaim(params: {
  encounterId: string;
  status: string;
}): Promise<WorkflowResult> {
  console.log("\n💰 Step 4: Creating claim...");

  // First get encounter details
  const { data: encounter, error: encounterError } = await supabase
    .from("encounters")
    .select("client_id, date_of_service, place_of_service_code")
    .eq("id", params.encounterId)
    .single();

  if (encounterError || !encounter) {
    console.error("❌ Failed to fetch encounter:", encounterError?.message);
    return { success: false, error: encounterError?.message || "Encounter not found" };
  }

  // Get patient's insurance
  const { data: insurance, error: insuranceError } = await supabase
    .from("insurance_policies")
    .select("id, payer_id")
    .eq("client_id", encounter.client_id)
    .eq("policy_type", "primary")
    .eq("active_flag", true)
    .single();

  if (insuranceError || !insurance) {
    console.error("❌ Failed to fetch insurance:", insuranceError?.message);
    return { success: false, error: insuranceError?.message || "No active insurance found" };
  }

  // Create claim
  const claimData = {
    encounter_id: params.encounterId,
    client_id: encounter.client_id,
    payer_id: insurance.payer_id,
    insurance_policy_id: insurance.id,
    claim_status: params.status,
    billed_amount: "150.00",
    date_of_service: encounter.date_of_service,
    place_of_service_code: encounter.place_of_service_code,
  };

  const { data: claim, error: claimError } = await supabase
    .from("claims")
    .insert(claimData)
    .select()
    .single();

  if (claimError) {
    console.error("❌ Failed to create claim:", claimError.message);
    return { success: false, error: claimError.message };
  }

  // Add service line
  const serviceLineData = {
    claim_id: claim.id,
    sequence_number: 1,
    cpt_hcpcs_code: "90834", // Psychotherapy 45 minutes
    units: 1,
    charge_amount: "150.00",
    service_date: encounter.date_of_service,
    place_of_service_code: encounter.place_of_service_code,
  };

  const { error: serviceLineError } = await supabase
    .from("claim_service_lines")
    .insert(serviceLineData);

  if (serviceLineError) {
    console.error("⚠️  Warning: Failed to create service line:", serviceLineError.message);
  }

  console.log("✅ Claim created:", claim.id);
  console.log("   Status:", params.status);
  console.log("   Amount: $150.00");
  return { success: true, data: claim };
}

/**
 * Step 5: Submit Claim to Clearinghouse
 */
async function submitClaim(claimId: string): Promise<WorkflowResult> {
  console.log("\n📤 Step 5: Submitting claim to clearinghouse...");

  // Update claim status to submitted
  const { data, error } = await supabase
    .from("claims")
    .update({
      claim_status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", claimId)
    .select()
    .single();

  if (error) {
    console.error("❌ Failed to submit claim:", error.message);
    return { success: false, error: error.message };
  }

  // Create clearinghouse submission record
  const submissionData = {
    claim_id: claimId,
    submission_status: "pending_acceptance",
    submitted_at: new Date().toISOString(),
    clearinghouse_name: "Change Healthcare",
  };

  const { error: submissionError } = await supabase
    .from("clearinghouse_submissions")
    .insert(submissionData);

  if (submissionError) {
    console.error("⚠️  Warning: Failed to create submission record:", submissionError.message);
  }

  console.log("✅ Claim submitted:", claimId);
  return { success: true, data };
}

/**
 * Step 6: Post Payment (Simulating ERA/EFT)
 */
async function postPayment(params: {
  claimId: string;
  amount: number;
}): Promise<WorkflowResult> {
  console.log("\n💵 Step 6: Posting payment...");

  // First get claim details
  const { data: claim, error: claimError } = await supabase
    .from("claims")
    .select("client_id, encounter_id, billed_amount")
    .eq("id", params.claimId)
    .single();

  if (claimError || !claim) {
    console.error("❌ Failed to fetch claim:", claimError?.message);
    return { success: false, error: claimError?.message || "Claim not found" };
  }

  // Create payment record
  const paymentData = {
    claim_id: params.claimId,
    client_id: claim.client_id,
    encounter_id: claim.encounter_id,
    payment_type: "insurance_payment",
    amount: params.amount.toFixed(2),
    payment_date: new Date().toISOString().split("T")[0],
    posted_at: new Date().toISOString(),
    check_number: `ERA${Date.now().toString().slice(-6)}`,
  };

  const { data, error } = await supabase
    .from("payments")
    .insert(paymentData)
    .select()
    .single();

  if (error) {
    console.error("❌ Failed to post payment:", error.message);
    return { success: false, error: error.message };
  }

  // Update claim status to paid
  await supabase
    .from("claims")
    .update({
      claim_status: "paid",
      paid_amount: params.amount.toFixed(2),
    })
    .eq("id", params.claimId);

  console.log("✅ Payment posted:", data.id);
  console.log("   Amount: $" + params.amount.toFixed(2));
  return { success: true, data };
}

/**
 * Main workflow execution
 */
async function runCompleteWorkflow() {
  console.log("🚀 Starting Complete Patient Workflow Test");
  console.log("==========================================");

  // Use existing test patient
  const patientId = "5eb894b2-87ab-48cc-acda-61a998fcb931"; // James Martinez from seed data

  try {
    // Step 1: Create Appointment
    const appointmentResult = await createAppointment(patientId);
    if (!appointmentResult.success) {
      throw new Error("Appointment creation failed");
    }
    const appointment = appointmentResult.data;

    // Step 2: Create Encounter
    const encounterResult = await createEncounter({
      appointmentId: appointment.id,
      patientId: patientId,
    });
    if (!encounterResult.success) {
      throw new Error("Encounter creation failed");
    }
    const encounter = encounterResult.data;

    // Step 3: Create and Sign Note
    const noteResult = await createNote({
      encounterId: encounter.id,
    });
    if (!noteResult.success) {
      throw new Error("Note creation failed");
    }

    // Step 4: Create Claim
    const claimResult = await createClaim({
      encounterId: encounter.id,
    });
    if (!claimResult.success) {
      throw new Error("Claim creation failed");
    }
    const claim = claimResult.data;

    // Step 5: Submit Claim
    const submissionResult = await submitClaim(claim.id);
    if (!submissionResult.success) {
      throw new Error("Claim submission failed");
    }

    // Step 6: Post Payment
    const paymentResult = await postPayment({
      claimId: claim.id,
      amount: 100.00,
    });
    if (!paymentResult.success) {
      throw new Error("Payment posting failed");
    }

    // Success summary
    console.log("\n✅ WORKFLOW COMPLETED SUCCESSFULLY!");
    console.log("====================================");
    console.log("📋 Summary:");
    console.log(`   Patient ID:     ${patientId}`);
    console.log(`   Appointment ID: ${appointment.id}`);
    console.log(`   Encounter ID:   ${encounter.id}`);
    console.log(`   Claim ID:       ${claim.id}`);
    console.log(`   Payment Amount: $100.00`);
    console.log("\n🎯 All steps completed. The system successfully processed:");
    console.log("   1. Appointment scheduled");
    console.log("   2. Encounter created");
    console.log("   3. Clinical note signed");
    console.log("   4. Claim generated");
    console.log("   5. Claim submitted");
    console.log("   6. Payment posted");

  } catch (error) {
    console.error("\n❌ WORKFLOW FAILED");
    console.error("==================");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the workflow
runCompleteWorkflow()
  .then(() => {
    console.log("\n✨ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
