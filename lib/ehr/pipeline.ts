import { SupabaseClient } from "@supabase/supabase-js";
import { PipelineResult } from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function minutesBetween(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return Math.round(diff / 60000);
}

export async function startEncounterFromAppointment(
  supabase: SupabaseClient,
  appointmentId: string
): Promise<PipelineResult> {
  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .single();

  if (appointmentError || !appointment) {
    return { ok: false, appointmentId, message: "Appointment not found." };
  }

  const { data: existing } = await supabase
    .from("encounters")
    .select("*")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  if (existing) {
    return {
      ok: true,
      appointmentId,
      encounterId: existing.id,
      message: "Existing encounter opened for this appointment.",
    };
  }

  const start = appointment.scheduled_start ?? nowIso();
  const end = appointment.scheduled_end ?? null;
  const duration = minutesBetween(start, end) || 53;

  const { data: encounter, error: encounterError } = await supabase
    .from("encounters")
    .insert({
      organization_id: appointment.organization_id,
      patient_id: appointment.patient_id,
      appointment_id: appointment.id,
      clinician_id: appointment.clinician_id,
      date_of_service: start.slice(0, 10),
      start_time: start,
      end_time: end,
      duration_minutes: duration,
      place_of_service_code: appointment.location_type === "telehealth" ? "10" : "11",
      service_location: appointment.location_type === "telehealth" ? "Telehealth - client in Colorado" : "Office",
      encounter_status: "draft",
      documentation_status: "not_started",
      billing_status: "hold",
      created_at: nowIso(),
      updated_at: nowIso(),
    })
    .select("*")
    .single();

  if (encounterError || !encounter) {
    return { ok: false, appointmentId, message: encounterError?.message ?? "Could not create encounter." };
  }

  await supabase.from("appointments").update({ status: "completed", updated_at: nowIso() }).eq("id", appointmentId);

  await supabase.from("clinical_notes").insert({
    encounter_id: encounter.id,
    note_type: "progress",
    note_format: "dap",
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
    interventions: "",
    client_response: "",
    risk_assessment: "",
    progress_toward_goals: "",
    next_steps: "",
    locked: false,
    created_at: nowIso(),
    updated_at: nowIso(),
  });

  await supabase.from("encounter_diagnoses").insert({
    encounter_id: encounter.id,
    diagnosis_code: appointment.default_diagnosis_code ?? "F41.1",
    diagnosis_description: appointment.default_diagnosis_description ?? "Generalized anxiety disorder",
    diagnosis_order: 1,
    is_primary: true,
  });

  await supabase.from("encounter_service_lines").insert({
    encounter_id: encounter.id,
    code_type: "CPT",
    procedure_code: appointment.default_procedure_code ?? "90837",
    units: 1,
    minutes: duration,
    charge_amount: appointment.default_charge_amount ?? 165,
    diagnosis_pointer: "A",
    documentation_support_status: "needs_review",
    billing_status: "hold",
    created_at: nowIso(),
    updated_at: nowIso(),
  });

  await supabase.from("audit_logs").insert({
    organization_id: appointment.organization_id,
    patient_id: appointment.patient_id,
    appointment_id: appointment.id,
    encounter_id: encounter.id,
    event_type: "encounter_created_from_appointment",
    event_summary: "Encounter created from completed appointment.",
    created_at: nowIso(),
  });

  return {
    ok: true,
    appointmentId,
    encounterId: encounter.id,
    message: "Encounter created from appointment.",
  };
}

export async function signClinicalNote(
  supabase: SupabaseClient,
  encounterId: string,
  signedBy: string,
  noteFields: Record<string, string>
): Promise<PipelineResult> {
  const { data: encounter, error: encounterError } = await supabase
    .from("encounters")
    .select("*")
    .eq("id", encounterId)
    .single();

  if (encounterError || !encounter) {
    return { ok: false, encounterId, message: "Encounter not found." };
  }

  const { data: note, error: noteError } = await supabase
    .from("clinical_notes")
    .select("*")
    .eq("encounter_id", encounterId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (noteError) {
    return { ok: false, encounterId, message: noteError.message };
  }

  const payload = {
    note_type: noteFields.note_type || note?.note_type || "progress",
    note_format: noteFields.note_format || note?.note_format || "dap",
    subjective: noteFields.subjective || note?.subjective || "Client participated in session.",
    objective: noteFields.objective || note?.objective || "Client was alert and oriented.",
    assessment: noteFields.assessment || note?.assessment || "Symptoms remain clinically significant but stable.",
    plan: noteFields.plan || note?.plan || "Continue treatment plan and review progress next session.",
    interventions: noteFields.interventions || note?.interventions || "CBT, supportive therapy, grounding skills.",
    client_response: noteFields.client_response || note?.client_response || "Client was engaged and receptive.",
    risk_assessment:
      noteFields.risk_assessment ||
      note?.risk_assessment ||
      "Denied suicidal ideation, homicidal ideation, intent, or plan.",
    progress_toward_goals:
      noteFields.progress_toward_goals || note?.progress_toward_goals || "Progress noted toward active goals.",
    next_steps: noteFields.next_steps || note?.next_steps || "Continue weekly outpatient therapy.",
    signed_by: signedBy,
    signed_at: nowIso(),
    locked: true,
    updated_at: nowIso(),
  };

  let noteId = note?.id as string | undefined;

  if (noteId) {
    const { error } = await supabase.from("clinical_notes").update(payload).eq("id", noteId);
    if (error) return { ok: false, encounterId, noteId, message: error.message };
  } else {
    const { data: inserted, error } = await supabase
      .from("clinical_notes")
      .insert({ encounter_id: encounterId, ...payload, created_at: nowIso() })
      .select("*")
      .single();
    if (error || !inserted) return { ok: false, encounterId, message: error?.message ?? "Could not create note." };
    noteId = inserted.id;
  }

  const readiness = await evaluateEncounterReadiness(supabase, encounterId);

  const encounterUpdate =
    readiness.missing.length === 0
      ? { encounter_status: "ready_to_bill", documentation_status: "signed", billing_status: "ready", updated_at: nowIso() }
      : { encounter_status: "in_review", documentation_status: "addendum_needed", billing_status: "hold", updated_at: nowIso() };

  await supabase.from("encounters").update(encounterUpdate).eq("id", encounterId);

  const queueType = readiness.missing.length === 0 ? "ready_to_bill" : "documentation_hold";
  const priority = readiness.missing.length === 0 ? "normal" : "high";

  const { data: queueItem } = await supabase
    .from("workqueue_items")
    .upsert(
      {
        organization_id: encounter.organization_id,
        patient_id: encounter.patient_id,
        appointment_id: encounter.appointment_id,
        encounter_id: encounterId,
        queue_type: queueType,
        ticket_type: queueType,
        priority,
        status: "open",
        title: readiness.missing.length === 0 ? "Encounter ready for billing scrub" : "Documentation hold",
        description:
          readiness.missing.length === 0
            ? "Signed documentation, diagnosis, service line, eligibility, and payer data passed readiness checks."
            : `Missing: ${readiness.missing.join(", ")}`,
        source: "system",
        updated_at: nowIso(),
      },
      { onConflict: "encounter_id,queue_type" }
    )
    .select("*")
    .maybeSingle();

  await supabase.from("audit_logs").insert({
    organization_id: encounter.organization_id,
    patient_id: encounter.patient_id,
    appointment_id: encounter.appointment_id,
    encounter_id: encounterId,
    clinical_note_id: noteId,
    workqueue_item_id: queueItem?.id,
    event_type: "clinical_note_signed",
    event_summary: readiness.missing.length === 0 ? "Note signed and routed to billing workqueue." : "Note signed but readiness failed.",
    event_metadata: { missing: readiness.missing },
    created_at: nowIso(),
  });

  return {
    ok: readiness.missing.length === 0,
    encounterId,
    noteId,
    workqueueItemId: queueItem?.id,
    missing: readiness.missing,
    message:
      readiness.missing.length === 0
        ? "Note signed and encounter routed to billing workqueue."
        : "Note signed, but encounter is on documentation hold.",
  };
}

export async function evaluateEncounterReadiness(
  supabase: SupabaseClient,
  encounterId: string
): Promise<{ missing: string[] }> {
  const missing: string[] = [];

  const { data: encounter } = await supabase.from("encounters").select("*").eq("id", encounterId).single();
  const { data: note } = await supabase
    .from("clinical_notes")
    .select("*")
    .eq("encounter_id", encounterId)
    .eq("locked", true)
    .maybeSingle();
  const { data: diagnoses } = await supabase.from("encounter_diagnoses").select("*").eq("encounter_id", encounterId);
  const { data: serviceLines } = await supabase.from("encounter_service_lines").select("*").eq("encounter_id", encounterId);
  const { data: policies } = encounter?.patient_id
    ? await supabase.from("insurance_policies").select("*").eq("patient_id", encounter.patient_id).eq("priority", 1).limit(1)
    : { data: [] as Record<string, unknown>[] };

  if (!encounter) missing.push("encounter");
  if (!note) missing.push("signed clinical note");
  if (!diagnoses || diagnoses.length === 0) missing.push("diagnosis");
  if (!serviceLines || serviceLines.length === 0) missing.push("service line");
  if (!policies || policies.length === 0) missing.push("primary insurance policy");
  if (!encounter?.duration_minutes || encounter.duration_minutes < 16) missing.push("billable duration");

  return { missing };
}

export async function routeEncounterToBiller(
  supabase: SupabaseClient,
  encounterId: string,
  message: string,
  ticketType: string,
  priority: string,
  createdBy: string
): Promise<PipelineResult> {
  const { data: encounter } = await supabase.from("encounters").select("*").eq("id", encounterId).single();

  if (!encounter) {
    return { ok: false, encounterId, message: "Encounter not found." };
  }

  const { data: item, error } = await supabase
    .from("workqueue_items")
    .insert({
      organization_id: encounter.organization_id,
      patient_id: encounter.patient_id,
      appointment_id: encounter.appointment_id,
      encounter_id: encounterId,
      queue_type: "billing_review",
      ticket_type: ticketType || "billing_question",
      priority: priority || "normal",
      status: "open",
      title: "Clinician routed encounter to billing",
      description: message || "Please review this encounter before billing.",
      source: "clinician",
      assigned_role: "biller",
      created_by: createdBy,
      created_at: nowIso(),
      updated_at: nowIso(),
    })
    .select("*")
    .single();

  if (error || !item) {
    return { ok: false, encounterId, message: error?.message ?? "Could not create workqueue ticket." };
  }

  await supabase.from("audit_logs").insert({
    organization_id: encounter.organization_id,
    patient_id: encounter.patient_id,
    appointment_id: encounter.appointment_id,
    encounter_id: encounterId,
    workqueue_item_id: item.id,
    event_type: "clinician_routed_to_biller",
    event_summary: message,
    created_at: nowIso(),
  });

  return { ok: true, encounterId, workqueueItemId: item.id, message: "Billing ticket created." };
}

export async function scrubEncounterForClaim(
  supabase: SupabaseClient,
  encounterId: string,
  scrubbedBy: string
): Promise<PipelineResult> {
  const readiness = await evaluateEncounterReadiness(supabase, encounterId);
  if (readiness.missing.length > 0) {
    return {
      ok: false,
      encounterId,
      missing: readiness.missing,
      message: `Cannot scrub. Missing: ${readiness.missing.join(", ")}`,
    };
  }

  const { data: encounter } = await supabase.from("encounters").select("*").eq("id", encounterId).single();
  if (!encounter) return { ok: false, encounterId, message: "Encounter not found." };

  await supabase
    .from("encounters")
    .update({ billing_status: "scrubbed", updated_at: nowIso() })
    .eq("id", encounterId);

  await supabase
    .from("encounter_service_lines")
    .update({ documentation_support_status: "supported", billing_status: "ready", updated_at: nowIso() })
    .eq("encounter_id", encounterId);

  await supabase
    .from("workqueue_items")
    .update({ status: "resolved", resolved_at: nowIso(), resolved_by: scrubbedBy, updated_at: nowIso() })
    .eq("encounter_id", encounterId)
    .eq("queue_type", "ready_to_bill");

  await supabase.from("audit_logs").insert({
    organization_id: encounter.organization_id,
    patient_id: encounter.patient_id,
    appointment_id: encounter.appointment_id,
    encounter_id: encounterId,
    event_type: "billing_scrub_passed",
    event_summary: "Billing scrub passed. Claim may be created.",
    created_at: nowIso(),
  });

  return { ok: true, encounterId, message: "Billing scrub passed." };
}

export async function createClaimFromEncounter(
  supabase: SupabaseClient,
  encounterId: string
): Promise<PipelineResult> {
  const { data: encounter } = await supabase.from("encounters").select("*").eq("id", encounterId).single();
  if (!encounter) return { ok: false, encounterId, message: "Encounter not found." };

  if (encounter.billing_status !== "scrubbed" && encounter.billing_status !== "ready") {
    return { ok: false, encounterId, message: "Encounter must be scrubbed or ready before claim creation." };
  }

  const { data: existing } = await supabase.from("claims").select("*").eq("encounter_id", encounterId).maybeSingle();
  if (existing) {
    return { ok: true, encounterId, claimId: existing.id, message: "Existing claim opened." };
  }

  const { data: policy } = await supabase
    .from("insurance_policies")
    .select("*, payers(*)")
    .eq("patient_id", encounter.patient_id)
    .eq("priority", 1)
    .limit(1)
    .maybeSingle();

  const { data: lines } = await supabase.from("encounter_service_lines").select("*").eq("encounter_id", encounterId);
  const total = (lines ?? []).reduce((sum, line) => sum + Number(line.charge_amount ?? 0), 0);

  const claimNumber = `CLM-${Date.now().toString().slice(-8)}`;

  const { data: claim, error } = await supabase
    .from("claims")
    .insert({
      organization_id: encounter.organization_id,
      patient_id: encounter.patient_id,
      encounter_id: encounterId,
      payer_id: policy?.payer_id ?? null,
      insurance_policy_id: policy?.id ?? null,
      claim_number: claimNumber,
      claim_type: "837P",
      claim_status: "draft",
      total_charge_amount: total,
      total_paid_amount: 0,
      total_adjustment_amount: 0,
      patient_responsibility_amount: 0,
      created_at: nowIso(),
      updated_at: nowIso(),
    })
    .select("*")
    .single();

  if (error || !claim) return { ok: false, encounterId, message: error?.message ?? "Could not create claim." };

  let lineNumber = 1;
  for (const line of lines ?? []) {
    await supabase.from("claim_service_lines").insert({
      claim_id: claim.id,
      encounter_service_line_id: line.id,
      line_number: lineNumber++,
      procedure_code: line.procedure_code,
      modifiers: [line.modifier_1, line.modifier_2, line.modifier_3, line.modifier_4].filter(Boolean),
      units: line.units,
      charge_amount: line.charge_amount,
      service_date: encounter.date_of_service ?? todayIso(),
      place_of_service_code: encounter.place_of_service_code ?? "11",
      line_status: "draft",
    });
  }

  await supabase.from("encounters").update({ billing_status: "claim_created", updated_at: nowIso() }).eq("id", encounterId);

  await supabase.from("audit_logs").insert({
    organization_id: encounter.organization_id,
    patient_id: encounter.patient_id,
    appointment_id: encounter.appointment_id,
    encounter_id: encounterId,
    claim_id: claim.id,
    event_type: "claim_created_from_encounter",
    event_summary: `Claim ${claimNumber} created from encounter.`,
    created_at: nowIso(),
  });

  return { ok: true, encounterId, claimId: claim.id, message: "Claim created from encounter." };
}

export async function submitClaim(
  supabase: SupabaseClient,
  claimId: string,
  submittedBy: string
): Promise<PipelineResult> {
  const { data: claim } = await supabase.from("claims").select("*").eq("id", claimId).single();
  if (!claim) return { ok: false, claimId, message: "Claim not found." } as PipelineResult;

  await supabase
    .from("claims")
    .update({
      claim_status: "submitted",
      submission_date: nowIso(),
      clearinghouse_trace_id: `TRACE-${Date.now()}`,
      updated_at: nowIso(),
    })
    .eq("id", claimId);

  await supabase.from("claim_submissions").insert({
    claim_id: claimId,
    transaction_type: "837P",
    submission_method: "manual",
    control_number: `837P-${Date.now()}`,
    edi_payload: "MOCK 837P PAYLOAD - replace with clearinghouse integration",
    response_status: "submitted",
    submitted_at: nowIso(),
    submitted_by: submittedBy,
  });

  await supabase.from("claim_status_events").insert({
    claim_id: claimId,
    source: "clearinghouse",
    transaction_type: "837P",
    status_code: "SUBMITTED",
    status_description: "Claim submitted to clearinghouse.",
    event_at: nowIso(),
    raw_event: { mock: true },
  });

  return { ok: true, claimId, message: "Claim submitted." } as PipelineResult;
}
