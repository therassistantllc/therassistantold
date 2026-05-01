"use client";

import { useMemo, useState, type ReactNode } from "react";
import type {
  CanonicalEhrState,
  CanonicalView,
  Claim,
  ID,
  SupportTicket,
  WorkqueueType,
} from "@/lib/canonical-ehr/types";
import { canonicalSeed } from "@/lib/canonical-ehr/seed";
import {
  addAddendum,
  checkEligibilityForAppointment,
  createClaimFromEncounter,
  getEncounterReadiness,
  importEraAndPostPayment,
  patientName,
  payerName,
  routeToBiller,
  scrubWorkqueueItem,
  setClaimStatus,
  signClinicalNote,
  startEncounterFromAppointment,
  submitClaim,
  userName,
} from "@/lib/canonical-ehr/model";

interface CanonicalEhrAppProps {
  initialView?: CanonicalView;
  patientId?: ID;
  encounterId?: ID;
  claimId?: ID;
  queueFilter?: WorkqueueType | "all";
}

type NoticeTone = "success" | "warning" | "info";

type Notice = {
  tone: NoticeTone;
  message: string;
};

const pageTitle: Record<CanonicalView, string> = {
  dashboard: "Command Center",
  scheduling: "Scheduling",
  patients: "Patients",
  "patient-chart": "Patient Chart",
  encounters: "Encounters",
  "encounter-workspace": "Encounter Workspace",
  claims: "Claims",
  payments: "Payments",
  workqueue: "Workqueue",
  schema: "Schema",
};

const workqueueFilters: Array<{ label: string; value: WorkqueueType | "all" }> = [
  { label: "All", value: "all" },
  { label: "Documentation Holds", value: "documentation_hold" },
  { label: "Ready to Bill", value: "ready_to_bill" },
  { label: "Biller Review", value: "biller_review" },
  { label: "Eligibility", value: "eligibility_issue" },
  { label: "Rejections", value: "rejection" },
  { label: "Denials", value: "denial" },
  { label: "Patient Balance", value: "patient_balance" },
  { label: "No Response", value: "no_response" },
  { label: "Appeals", value: "appeal_needed" },
  { label: "Auth Needed", value: "authorization_needed" },
  { label: "Underpayment", value: "underpayment" },
];

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(value);
}

function shortDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function shortDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`));
}

function statusTone(value: string): "neutral" | "good" | "warn" | "danger" | "info" | "purple" {
  if (["paid", "accepted", "active", "resolved", "signed", "ready", "ready_to_bill", "completed"].includes(value)) return "good";
  if (["denied", "rejected", "error", "voided", "no_show"].includes(value)) return "danger";
  if (["hold", "documentation_hold", "in_progress", "draft", "submitted", "scheduled"].includes(value)) return "warn";
  if (["biller_review", "appealed", "waiting"].includes(value)) return "purple";
  return "info";
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`te-panel ${className}`}>{children}</section>;
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "danger" | "info" | "purple" }) {
  return <span className={`te-badge te-badge-${tone}`}>{children}</span>;
}

function Button({
  children,
  onClick,
  tone = "default",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "default" | "primary" | "good" | "warn" | "danger";
  disabled?: boolean;
}) {
  return (
    <button type="button" className={`te-button te-button-${tone}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="te-field">
      <div className="te-field-label">{label}</div>
      <div className="te-field-value">{value}</div>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="te-empty">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

export default function CanonicalEhrApp({
  initialView = "dashboard",
  patientId,
  encounterId,
  claimId,
  queueFilter = "all",
}: CanonicalEhrAppProps) {
  const [state, setState] = useState<CanonicalEhrState>(canonicalSeed);
  const [view, setView] = useState<CanonicalView>(initialView);
  const [selectedPatientId, setSelectedPatientId] = useState<ID>(patientId ?? canonicalSeed.patients[0]?.id ?? "");
  const [selectedEncounterId, setSelectedEncounterId] = useState<ID>(encounterId ?? canonicalSeed.encounters[0]?.id ?? "");
  const [selectedClaimId, setSelectedClaimId] = useState<ID>(claimId ?? canonicalSeed.claims[0]?.id ?? "");
  const [activeQueueFilter, setActiveQueueFilter] = useState<WorkqueueType | "all">(queueFilter);
  const [notice, setNotice] = useState<Notice>({
    tone: "info",
    message: "Use the workflow cards below: appointment first, encounter as source of truth, billing through workqueue.",
  });
  const [ticketCategory, setTicketCategory] = useState<SupportTicket["category"]>("billing");
  const [ticketPriority, setTicketPriority] = useState<SupportTicket["priority"]>("normal");
  const [ticketMessage, setTicketMessage] = useState("Please review this encounter before claim creation.");
  const [addendumMessage, setAddendumMessage] = useState("Addendum: ");

  const selectedPatient = state.patients.find((item) => item.id === selectedPatientId) ?? state.patients[0];
  const selectedEncounter = state.encounters.find((item) => item.id === selectedEncounterId) ?? state.encounters[0];
  const selectedClaim = state.claims.find((item) => item.id === selectedClaimId) ?? state.claims[0] ?? null;

  const metrics = useMemo(() => {
    const today = "2026-04-28";
    return {
      appointmentsToday: state.appointments.filter((item) => item.scheduled_start.startsWith(today)).length,
      openWorkqueue: state.workqueue_items.filter((item) => ["open", "in_progress", "deferred"].includes(item.status)).length,
      readyToBill: state.encounters.filter((item) => item.encounter_status === "ready_to_bill").length,
      documentationHolds: state.workqueue_items.filter((item) => item.queue_type === "documentation_hold" && item.status === "open").length,
      charges: state.claims.reduce((sum, item) => sum + item.total_charge_amount, 0),
      paid: state.claims.reduce((sum, item) => sum + item.total_paid_amount, 0),
      tickets: state.support_tickets.filter((item) => ["open", "waiting"].includes(item.status)).length,
    };
  }, [state]);

  const dashboardAppointments = state.appointments.slice(0, 4);
  const filteredQueue = state.workqueue_items.filter((item) => activeQueueFilter === "all" || item.queue_type === activeQueueFilter);
  const openQueue = state.workqueue_items.filter((item) => ["open", "in_progress", "deferred"].includes(item.status));
  const claimsByEncounter = new Map(state.claims.map((claim) => [claim.encounter_id, claim]));
  const patientEncounters = selectedPatient ? state.encounters.filter((encounter) => encounter.patient_id === selectedPatient.id) : [];
  const selectedReadiness = selectedEncounter ? getEncounterReadiness(state, selectedEncounter.id) : null;

  function mutate(next: CanonicalEhrState, message: string, tone: NoticeTone = "success") {
    setState(next);
    setNotice({ tone, message });
  }

  function chooseEncounter(encounterId: ID) {
    setSelectedEncounterId(encounterId);
    setView("encounter-workspace");
  }

  function choosePatient(patientIdToSelect: ID) {
    setSelectedPatientId(patientIdToSelect);
    setView("patient-chart");
  }

  function chooseClaim(claimIdToSelect: ID) {
    setSelectedClaimId(claimIdToSelect);
    setView("claims");
  }

  function applyCheckEligibility(appointmentId: ID) {
    mutate(checkEligibilityForAppointment(state, appointmentId), "Eligibility checked and stored as a 270/271 record.");
  }

  function applyStartEncounter(appointmentId: ID) {
    const next = startEncounterFromAppointment(state, appointmentId);
    const encounter = next.encounters.find((item) => item.appointment_id === appointmentId);
    if (encounter) setSelectedEncounterId(encounter.id);
    mutate(next, "Encounter created from appointment. Documentation hold added to workqueue.");
    setView("encounter-workspace");
  }

  function applySignNote(encounterIdToSign: ID) {
    mutate(signClinicalNote(state, encounterIdToSign), "Note signed and locked. Readiness checks ran automatically.");
  }

  function applyRouteToBiller(encounterIdToRoute: ID) {
    mutate(routeToBiller(state, encounterIdToRoute, ticketCategory, ticketPriority, ticketMessage), "Biller review ticket created and linked to this chart.");
    setActiveQueueFilter("biller_review");
    setView("workqueue");
  }

  function applyAddendum(encounterIdToAmend: ID) {
    mutate(addAddendum(state, encounterIdToAmend, addendumMessage), "Addendum added to signed documentation.");
    setAddendumMessage("Addendum: ");
  }

  function applyScrub(itemId: ID) {
    mutate(scrubWorkqueueItem(state, itemId), "Billing scrub passed. Claim creation is now available.");
  }

  function applyCreateClaim(encounterIdForClaim: ID) {
    const next = createClaimFromEncounter(state, encounterIdForClaim);
    const createdClaim = next.claims.find((claim) => claim.encounter_id === encounterIdForClaim);
    if (createdClaim) setSelectedClaimId(createdClaim.id);
    mutate(next, "837P draft claim created from encounter service lines.");
    setView("claims");
  }

  function applySubmitClaim(claim: Claim) {
    mutate(submitClaim(state, claim.id), "837P submitted. Acknowledgment event added.");
  }

  function applyClaimStatus(claim: Claim, status: Claim["claim_status"]) {
    mutate(setClaimStatus(state, claim.id, status), `Claim moved to ${status}.`);
  }

  function applyEra(claim: Claim) {
    mutate(importEraAndPostPayment(state, claim.id), "835 ERA imported and payment posted.");
    setView("payments");
  }

  function renderDashboard() {
    return (
      <div className="te-page-stack">
        <section className="te-hero">
          <div>
            <div className="te-eyebrow">Colorado behavioral health EHR + RCM</div>
            <h1>Command Center</h1>
            <p>See today's appointments, start encounters, finish notes, and move clean work to billing.</p>
          </div>
          <div className="te-hero-actions">
            <Button tone="primary" onClick={() => setView("scheduling")}>Start at Scheduling</Button>
            <Button onClick={() => setView("workqueue")}>Open Workqueue</Button>
          </div>
        </section>

        <section className="te-metric-grid">
          <Panel className="te-metric"><span>Appointments Today</span><strong>{metrics.appointmentsToday}</strong></Panel>
          <Panel className="te-metric"><span>Documentation Holds</span><strong>{metrics.documentationHolds}</strong></Panel>
          <Panel className="te-metric"><span>Ready to Bill</span><strong>{metrics.readyToBill}</strong></Panel>
          <Panel className="te-metric"><span>Open Tickets</span><strong>{metrics.tickets}</strong></Panel>
        </section>

        <section className="te-dashboard-grid">
          <Panel className="te-main-panel">
            <div className="te-panel-header">
              <div>
                <h2>Today's Schedule</h2>
                <p>Primary clinician workflow. Each card has one obvious next action.</p>
              </div>
              <Button onClick={() => setView("scheduling")}>View All</Button>
            </div>
            <div className="te-card-list">
              {dashboardAppointments.map((appointment) => {
                const encounter = state.encounters.find((item) => item.appointment_id === appointment.id) ?? null;
                const patient = patientName(state, appointment.patient_id);
                const clinician = userName(state, appointment.clinician_id);
                const eligibility = appointment.eligibility_check_id ? "Eligibility active" : "Eligibility missing";
                return (
                  <article key={appointment.id} className="te-appointment-card">
                    <div className="te-card-top">
                      <div>
                        <h3>{patient}</h3>
                        <p>{shortDateTime(appointment.scheduled_start)} · {appointment.appointment_type}</p>
                        <p>{clinician}</p>
                      </div>
                      <Badge tone={statusTone(appointment.status)}>{appointment.status.replaceAll("_", " ")}</Badge>
                    </div>
                    <div className="te-chip-row">
                      <Badge tone={appointment.eligibility_check_id ? "good" : "warn"}>{eligibility}</Badge>
                      <Badge tone={encounter ? statusTone(encounter.documentation_status) : "neutral"}>
                        {encounter ? `Documentation ${encounter.documentation_status}` : "No encounter yet"}
                      </Badge>
                    </div>
                    <div className="te-action-row">
                      <Button onClick={() => applyCheckEligibility(appointment.id)}>Check Eligibility</Button>
                      {encounter ? (
                        <Button tone="primary" onClick={() => chooseEncounter(encounter.id)}>Resume Encounter</Button>
                      ) : (
                        <Button tone="primary" onClick={() => applyStartEncounter(appointment.id)}>Start Encounter</Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </Panel>

          <aside className="te-side-stack">
            <Panel>
              <div className="te-panel-header compact">
                <div>
                  <h2>Needs Attention</h2>
                  <p>Revenue cycle blockers.</p>
                </div>
              </div>
              <div className="te-card-list compact">
                {openQueue.slice(0, 4).map((item) => (
                  <button key={item.id} type="button" className="te-attention-card" onClick={() => setView("workqueue")}>
                    <Badge tone={statusTone(item.queue_type)}>{item.queue_type.replaceAll("_", " ")}</Badge>
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </button>
                ))}
                {openQueue.length === 0 ? <EmptyState title="No open workqueue items" detail="Clean encounters can proceed to billing." /> : null}
              </div>
            </Panel>

            <Panel>
              <div className="te-panel-header compact">
                <div>
                  <h2>Revenue Snapshot</h2>
                  <p>Secondary overview.</p>
                </div>
              </div>
              <div className="te-mini-grid">
                <Field label="Claim charges" value={currency(metrics.charges)} />
                <Field label="Paid" value={currency(metrics.paid)} />
                <Field label="Open queue" value={metrics.openWorkqueue} />
                <Field label="Ready" value={metrics.readyToBill} />
              </div>
            </Panel>
          </aside>
        </section>
      </div>
    );
  }

  function renderScheduling() {
    return (
      <Panel>
        <div className="te-panel-header">
          <div>
            <h2>Scheduling</h2>
            <p>Appointments are calendar objects. Encounters are created from completed or checked-in appointments.</p>
          </div>
        </div>
        <div className="te-card-list">
          {state.appointments.map((appointment) => {
            const encounter = state.encounters.find((item) => item.appointment_id === appointment.id) ?? null;
            return (
              <article key={appointment.id} className="te-row-card">
                <div>
                  <div className="te-row-title">{patientName(state, appointment.patient_id)} · {appointment.appointment_type}</div>
                  <p>{shortDateTime(appointment.scheduled_start)} with {userName(state, appointment.clinician_id)}</p>
                  <div className="te-chip-row">
                    <Badge tone={statusTone(appointment.status)}>{appointment.status}</Badge>
                    <Badge tone={appointment.eligibility_check_id ? "good" : "warn"}>
                      {appointment.eligibility_check_id ? "Eligibility checked" : "Eligibility missing"}
                    </Badge>
                    <Badge tone={encounter ? "good" : "neutral"}>{encounter ? "Encounter exists" : "No encounter"}</Badge>
                  </div>
                </div>
                <div className="te-action-row">
                  <Button onClick={() => applyCheckEligibility(appointment.id)}>Check Eligibility</Button>
                  {encounter ? <Button tone="primary" onClick={() => chooseEncounter(encounter.id)}>Open Encounter</Button> : <Button tone="primary" onClick={() => applyStartEncounter(appointment.id)}>Start Encounter</Button>}
                </div>
              </article>
            );
          })}
        </div>
      </Panel>
    );
  }

  function renderPatients() {
    return (
      <section className="te-dashboard-grid">
        <Panel>
          <div className="te-panel-header">
            <div>
              <h2>Patients</h2>
              <p>Patients and clients are one canonical record.</p>
            </div>
          </div>
          <div className="te-card-list">
            {state.patients.map((patient) => (
              <button key={patient.id} type="button" className={`te-patient-card ${patient.id === selectedPatientId ? "active" : ""}`} onClick={() => choosePatient(patient.id)}>
                <div>
                  <strong>{patient.preferred_name || patient.first_name} {patient.last_name}</strong>
                  <span>{patient.pronouns} · {patient.dob} · {patient.status}</span>
                </div>
                <Badge tone={statusTone(patient.status)}>{patient.status}</Badge>
              </button>
            ))}
          </div>
        </Panel>
        <Panel>
          {selectedPatient ? (
            <>
              <div className="te-panel-header">
                <div>
                  <h2>{selectedPatient.preferred_name || selectedPatient.first_name} {selectedPatient.last_name}</h2>
                  <p>{selectedPatient.phone} · {selectedPatient.email}</p>
                </div>
                <Badge tone={statusTone(selectedPatient.status)}>{selectedPatient.status}</Badge>
              </div>
              <div className="te-mini-grid">
                <Field label="DOB" value={selectedPatient.dob} />
                <Field label="Pronouns" value={selectedPatient.pronouns} />
                <Field label="Address" value={`${selectedPatient.address_line1}, ${selectedPatient.city}, ${selectedPatient.state}`} />
                <Field label="Emergency" value={`${selectedPatient.emergency_contact_name} · ${selectedPatient.emergency_contact_phone}`} />
              </div>
              <h3 className="te-section-label">Encounters</h3>
              <div className="te-card-list compact">
                {patientEncounters.map((encounter) => (
                  <button key={encounter.id} className="te-attention-card" type="button" onClick={() => chooseEncounter(encounter.id)}>
                    <Badge tone={statusTone(encounter.encounter_status)}>{encounter.encounter_status}</Badge>
                    <strong>{shortDate(encounter.date_of_service)} · {encounter.duration_minutes} min</strong>
                    <span>{encounter.medical_necessity_summary}</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </Panel>
      </section>
    );
  }

  function renderEncounters() {
    return (
      <section className="te-dashboard-grid">
        <Panel>
          <div className="te-panel-header">
            <div>
              <h2>Encounters</h2>
              <p>The encounter is the clinical and billing source of truth.</p>
            </div>
          </div>
          <div className="te-card-list">
            {state.encounters.map((encounter) => (
              <button key={encounter.id} className={`te-patient-card ${encounter.id === selectedEncounterId ? "active" : ""}`} type="button" onClick={() => chooseEncounter(encounter.id)}>
                <div>
                  <strong>{patientName(state, encounter.patient_id)}</strong>
                  <span>{shortDate(encounter.date_of_service)} · {encounter.duration_minutes} min · POS {encounter.place_of_service_code}</span>
                </div>
                <Badge tone={statusTone(encounter.encounter_status)}>{encounter.encounter_status}</Badge>
              </button>
            ))}
          </div>
        </Panel>
        {renderEncounterWorkspace()}
      </section>
    );
  }

  function renderEncounterWorkspace() {
    const encounter = selectedEncounter;
    if (!encounter) return <Panel><EmptyState title="No encounter selected" detail="Choose an encounter from the list." /></Panel>;

    const note = state.clinical_notes.find((item) => item.encounter_id === encounter.id) ?? null;
    const diagnoses = state.encounter_diagnoses.filter((item) => item.encounter_id === encounter.id);
    const serviceLines = state.encounter_service_lines.filter((item) => item.encounter_id === encounter.id);
    const readiness = getEncounterReadiness(state, encounter.id);
    const claim = claimsByEncounter.get(encounter.id) ?? null;
    const workItems = state.workqueue_items.filter((item) => item.encounter_id === encounter.id);

    return (
      <div className="te-page-stack">
        <Panel className="te-encounter-hero">
          <div className="te-card-top">
            <div>
              <div className="te-eyebrow">Encounter workspace</div>
              <h2>{patientName(state, encounter.patient_id)}</h2>
              <p>{shortDate(encounter.date_of_service)} · {encounter.duration_minutes} minutes · {encounter.service_location}</p>
            </div>
            <div className="te-chip-row">
              <Badge tone={statusTone(encounter.encounter_status)}>{encounter.encounter_status}</Badge>
              <Badge tone={statusTone(encounter.documentation_status)}>{encounter.documentation_status}</Badge>
              <Badge tone={statusTone(encounter.billing_status)}>{encounter.billing_status}</Badge>
            </div>
          </div>
          <div className="te-action-row">
            <Button tone="good" onClick={() => applySignNote(encounter.id)} disabled={Boolean(note?.locked)}>Sign Note + Auto-route</Button>
            <Button onClick={() => applyRouteToBiller(encounter.id)}>Route to Biller</Button>
            <Button tone="primary" onClick={() => applyCreateClaim(encounter.id)} disabled={!readiness.passed || Boolean(claim)}>Create Claim</Button>
          </div>
        </Panel>

        <section className="te-dashboard-grid">
          <Panel>
            <div className="te-panel-header">
              <div>
                <h2>Clinical Documentation</h2>
                <p>Signed notes lock. Addendums preserve history.</p>
              </div>
              <Badge tone={note?.locked ? "good" : "warn"}>{note?.locked ? "Signed + locked" : "Draft"}</Badge>
            </div>
            {note ? (
              <div className="te-note-grid">
                <Field label="Subjective / Data" value={note.subjective} />
                <Field label="Assessment" value={note.assessment} />
                <Field label="Plan" value={note.plan} />
                <Field label="Risk" value={note.risk_assessment} />
                <Field label="Progress toward goals" value={note.progress_toward_goals} />
                <Field label="Next steps" value={note.next_steps} />
              </div>
            ) : <EmptyState title="No note yet" detail="Create a clinical note for this encounter." />}
            <div className="te-form-row">
              <textarea className="te-textarea" value={addendumMessage} onChange={(event) => setAddendumMessage(event.target.value)} />
              <Button onClick={() => applyAddendum(encounter.id)} disabled={!note?.locked}>Add Addendum</Button>
            </div>
          </Panel>

          <Panel>
            <div className="te-panel-header">
              <div>
                <h2>Billing Readiness</h2>
                <p>Automatic checks before the claim can be generated.</p>
              </div>
              <Badge tone={readiness.passed ? "good" : "warn"}>{readiness.passed ? "Passed" : "Blocked"}</Badge>
            </div>
            <div className="te-card-list compact">
              {readiness.checks.map((check) => (
                <div key={check.key} className="te-check-row">
                  <span className={`te-check-dot ${check.passed ? "passed" : "blocked"}`}>{check.passed ? "✓" : "!"}</span>
                  <div>
                    <strong>{check.label}</strong>
                    <p>{check.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="te-dashboard-grid">
          <Panel>
            <div className="te-panel-header compact"><h2>Diagnoses + Service Lines</h2></div>
            <div className="te-card-list compact">
              {diagnoses.map((diagnosis) => (
                <div key={diagnosis.id} className="te-row-card slim">
                  <strong>{diagnosis.diagnosis_order === 1 ? "A" : diagnosis.diagnosis_order} · {diagnosis.diagnosis_code}</strong>
                  <span>{diagnosis.diagnosis_description}</span>
                </div>
              ))}
              {serviceLines.map((line) => (
                <div key={line.id} className="te-row-card slim">
                  <strong>{line.procedure_code} · {line.minutes} minutes · {currency(line.charge_amount)}</strong>
                  <span>Pointer {line.diagnosis_pointer} · {line.documentation_support_status}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <div className="te-panel-header compact"><h2>Linked Workqueue</h2></div>
            <div className="te-card-list compact">
              {workItems.length > 0 ? workItems.map((item) => (
                <div key={item.id} className="te-row-card slim">
                  <div className="te-card-top">
                    <strong>{item.title}</strong>
                    <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                  </div>
                  <span>{item.description}</span>
                </div>
              )) : <EmptyState title="No queue items" detail="This encounter has no open blockers." />}
            </div>
          </Panel>
        </section>

        <Panel>
          <div className="te-panel-header">
            <div>
              <h2>Route to Biller</h2>
              <p>Create a linked support ticket with a clinician message.</p>
            </div>
          </div>
          <div className="te-form-grid">
            <label>
              Category
              <select value={ticketCategory} onChange={(event) => setTicketCategory(event.target.value as SupportTicket["category"])}>
                <option value="billing">Billing</option>
                <option value="documentation">Documentation</option>
                <option value="eligibility">Eligibility</option>
                <option value="payer">Payer</option>
                <option value="coding">Coding</option>
                <option value="claim_status">Claim status</option>
              </select>
            </label>
            <label>
              Priority
              <select value={ticketPriority} onChange={(event) => setTicketPriority(event.target.value as SupportTicket["priority"])}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label className="span-2">
              Message
              <textarea className="te-textarea" value={ticketMessage} onChange={(event) => setTicketMessage(event.target.value)} />
            </label>
          </div>
          <div className="te-action-row">
            <Button tone="primary" onClick={() => applyRouteToBiller(encounter.id)}>Create Workqueue Ticket</Button>
          </div>
        </Panel>
      </div>
    );
  }

  function renderClaims() {
    return (
      <section className="te-dashboard-grid">
        <Panel>
          <div className="te-panel-header">
            <div>
              <h2>Claims</h2>
              <p>Claims are generated from encounters, not hand-created in isolation.</p>
            </div>
          </div>
          <div className="te-card-list">
            {state.claims.map((claim) => (
              <button key={claim.id} className={`te-patient-card ${claim.id === selectedClaimId ? "active" : ""}`} type="button" onClick={() => chooseClaim(claim.id)}>
                <div>
                  <strong>{claim.claim_number}</strong>
                  <span>{patientName(state, claim.patient_id)} · {payerName(state, claim.payer_id)} · {currency(claim.total_charge_amount)}</span>
                </div>
                <Badge tone={statusTone(claim.claim_status)}>{claim.claim_status}</Badge>
              </button>
            ))}
          </div>
        </Panel>
        <Panel>
          {selectedClaim ? (
            <>
              <div className="te-panel-header">
                <div>
                  <h2>{selectedClaim.claim_number}</h2>
                  <p>{patientName(state, selectedClaim.patient_id)} · {payerName(state, selectedClaim.payer_id)}</p>
                </div>
                <Badge tone={statusTone(selectedClaim.claim_status)}>{selectedClaim.claim_status}</Badge>
              </div>
              <div className="te-mini-grid">
                <Field label="Charge" value={currency(selectedClaim.total_charge_amount)} />
                <Field label="Paid" value={currency(selectedClaim.total_paid_amount)} />
                <Field label="Adjustment" value={currency(selectedClaim.total_adjustment_amount)} />
                <Field label="Patient responsibility" value={currency(selectedClaim.patient_responsibility_amount)} />
              </div>
              <div className="te-action-row">
                <Button tone="primary" onClick={() => applySubmitClaim(selectedClaim)} disabled={selectedClaim.claim_status !== "draft" && selectedClaim.claim_status !== "ready"}>Submit 837P</Button>
                <Button onClick={() => applyClaimStatus(selectedClaim, "accepted")}>Mark Accepted</Button>
                <Button tone="danger" onClick={() => applyClaimStatus(selectedClaim, "denied")}>Mark Denied</Button>
                <Button tone="good" onClick={() => applyEra(selectedClaim)}>Post ERA</Button>
              </div>
            </>
          ) : <EmptyState title="No claim selected" detail="Create a claim from a ready encounter." />}
        </Panel>
      </section>
    );
  }

  function renderWorkqueue() {
    return (
      <Panel>
        <div className="te-panel-header">
          <div>
            <h2>Unified Workqueue</h2>
            <p>No disconnected denial/rejection pages. Everything is filtered from one queue model.</p>
          </div>
        </div>
        <div className="te-filter-row">
          {workqueueFilters.map((filter) => (
            <button key={filter.value} type="button" className={`te-filter ${activeQueueFilter === filter.value ? "active" : ""}`} onClick={() => setActiveQueueFilter(filter.value)}>
              {filter.label}
            </button>
          ))}
        </div>
        <div className="te-card-list">
          {filteredQueue.map((item) => (
            <article key={item.id} className="te-row-card">
              <div>
                <div className="te-card-top">
                  <div>
                    <div className="te-row-title">{item.title}</div>
                    <p>{item.description}</p>
                  </div>
                  <div className="te-chip-row">
                    <Badge tone={statusTone(item.queue_type)}>{item.queue_type.replaceAll("_", " ")}</Badge>
                    <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                  </div>
                </div>
                <p>{item.encounter_id ? `Chart linked: ${patientName(state, state.encounters.find((encounter) => encounter.id === item.encounter_id)?.patient_id ?? null)}` : "No chart linked"}</p>
              </div>
              <div className="te-action-row">
                {item.encounter_id ? <Button onClick={() => chooseEncounter(item.encounter_id as ID)}>Open Chart</Button> : null}
                <Button tone="good" onClick={() => applyScrub(item.id)} disabled={item.status === "resolved" || item.status === "closed"}>Scrub / Resolve</Button>
                {item.encounter_id ? <Button tone="primary" onClick={() => applyCreateClaim(item.encounter_id as ID)}>Create Claim</Button> : null}
              </div>
            </article>
          ))}
        </div>
      </Panel>
    );
  }

  function renderPayments() {
    const eraClaims = state.era_claim_payments;
    return (
      <Panel>
        <div className="te-panel-header">
          <div>
            <h2>Payments / 835 ERA</h2>
            <p>ERA files post to claim payments and line payments.</p>
          </div>
        </div>
        <div className="te-card-list">
          {eraClaims.length ? eraClaims.map((payment) => (
            <article key={payment.id} className="te-row-card">
              <div>
                <div className="te-row-title">ERA payment · {payment.payer_claim_control_number}</div>
                <p>Billed {currency(payment.billed_amount)} · Paid {currency(payment.paid_amount)} · Patient Resp {currency(payment.patient_responsibility_amount)}</p>
              </div>
              <Badge tone={payment.posted ? "good" : "warn"}>{payment.posted ? "posted" : "unposted"}</Badge>
            </article>
          )) : <EmptyState title="No ERA posted yet" detail="Open a claim and click Post ERA." />}
        </div>
      </Panel>
    );
  }

  function renderSchema() {
    const tables = [
      "organizations", "users", "patients", "payers", "insurance_policies", "eligibility_checks", "appointments", "encounters",
      "clinical_notes", "encounter_diagnoses", "encounter_service_lines", "treatment_plans", "claims", "claim_service_lines",
      "claim_submissions", "claim_status_events", "era_files", "workqueue_items", "support_tickets", "audit_logs",
    ];
    return (
      <Panel>
        <div className="te-panel-header">
          <div>
            <h2>Canonical Schema</h2>
            <p>Each UI page reads the same model. No page invents its own data shape.</p>
          </div>
        </div>
        <div className="te-schema-grid">
          {tables.map((table) => <div key={table} className="te-schema-chip">{table}</div>)}
        </div>
      </Panel>
    );
  }

  function renderCurrentView() {
    if (view === "dashboard") return renderDashboard();
    if (view === "scheduling") return renderScheduling();
    if (view === "patients" || view === "patient-chart") return renderPatients();
    if (view === "encounters") return renderEncounters();
    if (view === "encounter-workspace") return renderEncounterWorkspace();
    if (view === "claims") return renderClaims();
    if (view === "payments") return renderPayments();
    if (view === "workqueue") return renderWorkqueue();
    return renderSchema();
  }

  return (
    <main className="te-app">
      <div className="te-page-header">
        <div>
          <div className="te-eyebrow">Canonical workflow spine</div>
          <h1>{pageTitle[view]}</h1>
        </div>
        <div className={`te-notice te-notice-${notice.tone}`}>{notice.message}</div>
      </div>
      {renderCurrentView()}
    </main>
  );
}
