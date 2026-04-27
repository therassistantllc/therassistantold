// File: lib/dashboard/homeData.ts
export interface HomeDashboardPayload {
  role: string;
  organization: { id?: string; name?: string };
  commandBarMetrics: Array<{ key: string; label: string; value: number | string; href: string }>;
  todaySchedule: Array<any>;
  revenueCycleSnapshot: Array<any>;
  claimsNeedingAttention: Array<any>;
  documentationQueue: Array<any>;
  eligibilityWatchlist: Array<any>;
  patientBalanceQueue: Array<any>;
  tickets: Array<any>;
  credentialingTasks: Array<any>;
  clearinghouseActivity: Array<any>;
}

export function buildHomeDashboardPayload(role: string): HomeDashboardPayload {
  return {
    role,
    organization: {
      id: "11111111-1111-1111-1111-111111111111",
      name: "Therassistant Demo Org",
    },
    commandBarMetrics: [
      { key: "appointments_today", label: "Appointments Today", value: 9, href: "/scheduling" },
      { key: "missing_notes", label: "Missing Notes", value: 3, href: "/encounters?status=missing_note" },
      { key: "eligibility_not_checked", label: "Eligibility Not Checked", value: 4, href: "/scheduling?filter=eligibility_not_checked" },
      { key: "claims_needing_action", label: "Claims Needing Action", value: 6, href: "/billing/claims?queue=denied" },
      { key: "open_tickets", label: "Open Tickets", value: 5, href: "/tickets?status=open" },
      { key: "patient_balances", label: "Patient Balances", value: 8, href: "/billing/ar" },
      { key: "credentialing_due", label: "Credentialing Due", value: 2, href: "/credentialing/tasks?status=due" },
    ],
    todaySchedule: [
      {
        id: "apt-1",
        time: "9:00 AM",
        clientName: "Sarah Johnson",
        provider: "Test Provider, LCSW",
        appointmentType: "Telehealth",
        eligibilityLabel: "Active",
        eligibilitySeverity: "low",
        balanceLabel: "$25 due",
        noteStatus: "Missing note",
        patientId: "5eb894b2-87ab-48cc-acda-61a998fcb931",
      },
      {
        id: "apt-2",
        time: "10:00 AM",
        clientName: "Marcus Lee",
        provider: "Test Provider, LCSW",
        appointmentType: "In-person",
        eligibilityLabel: "Not Checked",
        eligibilitySeverity: "medium",
        balanceLabel: "$0",
        noteStatus: "Ready",
        patientId: "pt-1002",
      },
    ],
    revenueCycleSnapshot: [
      { label: "Total A/R", value: "$18,420", href: "/billing" },
      { label: "Insurance A/R", value: "$12,100", href: "/billing?queue=pending_payer" },
      { label: "Patient A/R", value: "$6,320", href: "/billing?queue=patient_balance" },
      { label: "Denied Claims", value: "7", href: "/billing?queue=denied" },
      { label: "Rejected Claims", value: "3", href: "/billing?queue=rejected" },
      { label: "Claims >30/60/90", value: "14 / 8 / 3", href: "/billing?queue=aging" },
      { label: "Unposted ERAs", value: "4", href: "/billing?queue=era_not_posted" },
    ],
    claimsNeedingAttention: [
      { id: "clm-1003", client: "Dana Patel", payer: "Optum", dos: "2026-03-18", amount: "$175", reason: "Denied - medical necessity review", queue: "Denied" },
      { id: "clm-1002", client: "Marcus Lee", payer: "BCBS", dos: "2026-04-03", amount: "$200", reason: "Rejected - missing claim data", queue: "Rejected" },
    ],
    documentationQueue: [
      { id: "enc-1", title: "Sarah Johnson • 2026-04-24", status: "Completed appointment missing note", patientId: "5eb894b2-87ab-48cc-acda-61a998fcb931" },
      { id: "enc-2", title: "Marcus Lee • 2026-04-24", status: "Draft note unsigned", patientId: "pt-1002" },
    ],
    eligibilityWatchlist: [
      { id: "elig-1", patient: "Marcus Lee", reason: "Eligibility not checked in 30+ days", patientId: "pt-1002" },
      { id: "elig-2", patient: "Olivia Tran", reason: "Missing subscriber ID", patientId: "pt-1010" },
    ],
    patientBalanceQueue: [
      { id: "bal-1", patient: "Olivia Tran", balance: "$175", reason: "Old patient balance", patientId: "pt-1010" },
      { id: "bal-2", patient: "Sarah Johnson", balance: "$25", reason: "Unpaid copay today", patientId: "5eb894b2-87ab-48cc-acda-61a998fcb931" },
    ],
    tickets: [
      { id: "tic-1", title: "Claim routed to biller for BCBS rejection", severity: "high", status: "Open" },
      { id: "tic-2", title: "Client message about statement discrepancy", severity: "medium", status: "Unread" },
    ],
    credentialingTasks: [
      { id: "cred-1", title: "CAQH attestation due for Test Provider", dueAt: "2026-04-30", severity: "high" },
      { id: "cred-2", title: "Payer application follow-up", dueAt: "2026-05-02", severity: "medium" },
    ],
    clearinghouseActivity: [
      { id: "tx-1", title: "271 Eligibility Response", detail: "Sarah Johnson • Active coverage returned", severity: "low", patientId: "5eb894b2-87ab-48cc-acda-61a998fcb931" },
      { id: "tx-2", title: "277 Claim Status", detail: "Dana Patel • Denied", severity: "high", claimId: "clm-1003", patientId: "pt-1003" },
    ],
  };
}
