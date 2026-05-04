// File: lib/dashboard/homeData.ts
import { canonicalSeed } from "@/lib/canonical-ehr/seed";

type DashboardRole =
  | "admin_biller"
  | "clinician"
  | "credentialing"
  | "owner_executive";

export function getHomeDashboardData() {
  return {
    appointments: canonicalSeed.appointments ?? [],
    claims: canonicalSeed.claims ?? [],
    workqueueItems: canonicalSeed.workqueue_items ?? [],
    eligibilityChecks: canonicalSeed.eligibility_checks ?? [],
    supportTickets: canonicalSeed.support_tickets ?? [],
  };
}

export function buildHomeDashboardPayload(role: string) {
  const safeRole = normalizeRole(role);
  const data = getHomeDashboardData();

  return {
    role: safeRole,
    organization: {
      id: "demo-org",
      name: "Demo Organization",
    },

    commandBarMetrics: [
      {
        key: "today_schedule",
        label: "Today",
        value: data.appointments.length,
        href: "/scheduling",
      },
      {
        key: "patients",
        label: "Patients",
        value: canonicalSeed.patients?.length ?? 0,
        href: "/patients",
      },
      {
        key: "encounters",
        label: "Encounters",
        value: canonicalSeed.encounters?.length ?? 0,
        href: "/encounters",
      },
      {
        key: "workqueue",
        label: "Workqueue",
        value: data.workqueueItems.length,
        href: "/billing/workqueue",
      },
      {
        key: "claims",
        label: "Claims",
        value: data.claims.length,
        href: "/claims",
      },
      {
        key: "eligibility",
        label: "Eligibility",
        value: data.eligibilityChecks.length,
        href: "/insurance/eligibility",
      },
      {
        key: "tickets",
        label: "Tickets",
        value: data.supportTickets.length,
        href: "/tickets",
      },
    ],

    todaySchedule: data.appointments,
    revenueCycleSnapshot: buildRevenueCycleSnapshot(data.claims),
    claimsNeedingAttention: data.claims,
    documentationQueue: canonicalSeed.encounters ?? [],
    eligibilityWatchlist: data.eligibilityChecks,
    patientBalanceQueue: [],
    tickets: data.supportTickets,
    credentialingTasks: [],
    clearinghouseActivity: [],
  };
}

function normalizeRole(role: string): DashboardRole {
  if (
    role === "admin_biller" ||
    role === "clinician" ||
    role === "credentialing" ||
    role === "owner_executive"
  ) {
    return role;
  }

  return "admin_biller";
}

function buildRevenueCycleSnapshot(claims: any[]) {
  const totalCharges = claims.reduce((sum, claim) => {
    const amount =
      Number(claim.total_charge_amount) ||
      Number(claim.totalChargeAmount) ||
      Number(claim.charge_amount) ||
      0;

    return sum + amount;
  }, 0);

  return [
    {
      key: "total_charges",
      label: "Total charges",
      value: totalCharges,
      href: "/claims",
    },
    {
      key: "open_claims",
      label: "Open claims",
      value: claims.length,
      href: "/claims",
    },
    {
      key: "payment_imports",
      label: "Payment imports",
      value: 0,
      href: "/billing/payment-imports",
    },
  ];
}