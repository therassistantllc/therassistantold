/**
 * Workflow Actions
 * 
 * Core workflow functions that power the patient journey:
 * Appointment → Encounter → Note → Claim → Submission → Payment
 * 
 * These functions can be used in:
 * - API endpoints
 * - Server actions
 * - Test scripts
 * - Background jobs
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Types
export interface CreateAppointmentParams {
  patientId: string;
  providerId: string;
  appointmentType: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  notes?: string;
}

export interface CreateEncounterParams {
  appointmentId: string;
  patientId: string;
  dateOfService?: string;
  placeOfServiceCode?: string;
}

export interface CreateNoteParams {
  encounterId: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  status: "draft" | "signed";
  riskNotes?: string;
  sessionSummary?: string;
}

export interface CreateClaimParams {
  encounterId: string;
  status?: string;
}

export interface PostPaymentParams {
  claimId: string;
  amount: number;
  paymentType?: "insurance_payment" | "patient_payment";
  checkNumber?: string;
}

/**
 * Create a new appointment
 */
export async function createAppointment(
  supabase: SupabaseClient<Database>,
  params: CreateAppointmentParams
) {
  const { data, error } = await supabase
    .from("appointments")
    .insert({
      client_id: params.patientId,
      provider_id: params.providerId,
      appointment_type: params.appointmentType,
      scheduled_start_at: params.scheduledStartAt,
      scheduled_end_at: params.scheduledEndAt,
      status: "scheduled",
      notes: params.notes,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create appointment: ${error.message}`);
  return data;
}

/**
 * Create encounter from appointment
 */
export async function createEncounter(
  supabase: SupabaseClient<Database>,
  params: CreateEncounterParams
) {
  const { data, error } = await supabase
    .from("encounters")
    .insert({
      client_id: params.patientId,
      appointment_id: params.appointmentId,
      date_of_service: params.dateOfService || new Date().toISOString().split("T")[0],
      encounter_status: "open",
      place_of_service_code: params.placeOfServiceCode || "11", // Default: Office
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create encounter: ${error.message}`);
  return data;
}

/**
 * Create clinical note
 */
export async function createNote(
  supabase: SupabaseClient<Database>,
  params: CreateNoteParams
) {
  const { data, error } = await supabase
    .from("encounter_notes")
    .insert({
      encounter_id: params.encounterId,
      subjective: params.subjective,
      objective: params.objective,
      assessment: params.assessment,
      plan: params.plan,
      status: params.status,
      signed_at: params.status === "signed" ? new Date().toISOString() : null,
      risk_notes: params.riskNotes,
      session_summary: params.sessionSummary,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create note: ${error.message}`);
  return data;
}

/**
 * Create claim with service lines
 */
export async function createClaim(
  supabase: SupabaseClient<Database>,
  params: CreateClaimParams
) {
  // Get encounter details
  const { data: encounter, error: encounterError } = await supabase
    .from("encounters")
    .select("client_id, date_of_service, place_of_service_code")
    .eq("id", params.encounterId)
    .single();

  if (encounterError) throw new Error(`Failed to fetch encounter: ${encounterError.message}`);
  if (!encounter) throw new Error("Encounter not found");

  // Get active insurance
  const { data: insurance, error: insuranceError } = await supabase
    .from("insurance_policies")
    .select("id, payer_id")
    .eq("client_id", encounter.client_id)
    .eq("policy_type", "primary")
    .eq("active_flag", true)
    .maybeSingle();

  if (insuranceError) throw new Error(`Failed to fetch insurance: ${insuranceError.message}`);
  if (!insurance) throw new Error("No active insurance found for patient");

  // Create claim
  const { data: claim, error: claimError } = await supabase
    .from("claims")
    .insert({
      encounter_id: params.encounterId,
      client_id: encounter.client_id,
      payer_id: insurance.payer_id,
      insurance_policy_id: insurance.id,
      claim_status: params.status || "ready_to_submit",
      billed_amount: "0.00", // Will be updated when service lines added
      date_of_service: encounter.date_of_service,
      place_of_service_code: encounter.place_of_service_code,
    })
    .select()
    .single();

  if (claimError) throw new Error(`Failed to create claim: ${claimError.message}`);
  return claim;
}

/**
 * Submit claim to clearinghouse
 */
export async function submitClaim(
  supabase: SupabaseClient<Database>,
  claimId: string
) {
  // Update claim status
  const { data, error } = await supabase
    .from("claims")
    .update({
      claim_status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", claimId)
    .select()
    .single();

  if (error) throw new Error(`Failed to submit claim: ${error.message}`);

  // Create submission record
  await supabase.from("clearinghouse_submissions").insert({
    claim_id: claimId,
    submission_status: "pending_acceptance",
    submitted_at: new Date().toISOString(),
    clearinghouse_name: "Change Healthcare",
  });

  return data;
}

/**
 * Post payment to claim
 */
export async function postPayment(
  supabase: SupabaseClient<Database>,
  params: PostPaymentParams
) {
  // Get claim details
  const { data: claim, error: claimError } = await supabase
    .from("claims")
    .select("client_id, encounter_id, billed_amount")
    .eq("id", params.claimId)
    .single();

  if (claimError) throw new Error(`Failed to fetch claim: ${claimError.message}`);
  if (!claim) throw new Error("Claim not found");

  // Create payment
  const { data, error } = await supabase
    .from("payments")
    .insert({
      claim_id: params.claimId,
      client_id: claim.client_id,
      encounter_id: claim.encounter_id,
      payment_type: params.paymentType || "insurance_payment",
      amount: params.amount.toFixed(2),
      payment_date: new Date().toISOString().split("T")[0],
      posted_at: new Date().toISOString(),
      check_number: params.checkNumber,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to post payment: ${error.message}`);

  // Update claim with payment amount
  await supabase
    .from("claims")
    .update({
      paid_amount: params.amount.toFixed(2),
      claim_status: "paid",
    })
    .eq("id", params.claimId);

  return data;
}

/**
 * Complete workflow: Execute all steps in sequence
 */
export async function executeCompleteWorkflow(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  providerId: string
) {
  // Step 1: Create appointment
  const appointment = await createAppointment(supabase, {
    patientId,
    providerId,
    appointmentType: "Initial Consultation",
    scheduledStartAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    scheduledEndAt: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
  });

  // Step 2: Create encounter
  const encounter = await createEncounter(supabase, {
    appointmentId: appointment.id,
    patientId,
  });

  // Step 3: Create note
  const note = await createNote(supabase, {
    encounterId: encounter.id,
    status: "signed",
    subjective: "Patient reports improved symptoms.",
    objective: "Patient appears stable.",
    assessment: "Condition improving.",
    plan: "Continue current treatment.",
  });

  // Step 4: Create claim
  const claim = await createClaim(supabase, {
    encounterId: encounter.id,
    status: "ready_to_submit",
  });

  // Step 5: Submit claim
  await submitClaim(supabase, claim.id);

  // Step 6: Post payment
  const payment = await postPayment(supabase, {
    claimId: claim.id,
    amount: 100.0,
  });

  return {
    appointment,
    encounter,
    note,
    claim,
    payment,
  };
}
