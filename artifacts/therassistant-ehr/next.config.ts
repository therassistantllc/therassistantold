import type { NextConfig } from "next";

/**
 * Legacy billing queue routes — all redirect to the unified
 * /billing/claims workspace (Task #771: workflow-centric IA).
 *
 * Source = legacy /billing/<queue> route
 * Target = /billing/claims?tab=<lifecycle>&filter=<chip>
 *
 * The five lifecycle tabs are: needs_attention, submitted, denials,
 * follow_up, resolutions. The filter chip ids are defined in
 * components/billing/ClaimsWorkspace.tsx.
 *
 * Patient-balance, payments, and ERA routes are NOT redirected — they
 * live under the Payments and Patient Balances nav items and still
 * own their own UIs.
 *
 * The detail route /billing/claims/[claimId] is excluded (it's the
 * per-claim drill-in for the new workspace, not a legacy queue).
 */
const claimRedirects: Array<{ from: string; tab: string; filter?: string }> = [
  // ── Needs Attention ──────────────────────────────────────────────
  { from: "/billing/charge-capture", tab: "needs_attention" },
  { from: "/billing/documentation-pending", tab: "needs_attention" },
  { from: "/billing/eligibility-issues", tab: "needs_attention" },
  { from: "/billing/authorization-required", tab: "needs_attention" },
  { from: "/billing/provider-enrollment-issues", tab: "needs_attention" },
  { from: "/billing/claim-build-errors", tab: "needs_attention" },
  { from: "/billing/claim-hold", tab: "needs_attention" },
  { from: "/billing/ready-to-generate", tab: "needs_attention" },
  { from: "/billing/duplicate-claim-review", tab: "needs_attention" },
  { from: "/billing/no-response", tab: "needs_attention", filter: "no_payer_response" },
  { from: "/billing/claim-readiness", tab: "needs_attention", filter: "no_payer_response" },
  { from: "/billing/rejections-999", tab: "needs_attention", filter: "no_999" },
  { from: "/billing/rejections-277ca", tab: "needs_attention", filter: "no_277ca" },
  { from: "/billing/claim-edit-dashboard", tab: "needs_attention", filter: "no_277ca" },
  { from: "/billing/timely-filing", tab: "needs_attention", filter: "timely_filing" },
  { from: "/billing/fax-queue", tab: "needs_attention" },
  { from: "/billing/adjustments-review", tab: "needs_attention" },
  // ── Submitted ────────────────────────────────────────────────────
  { from: "/billing/837p-batches", tab: "submitted" },
  { from: "/billing/batches", tab: "submitted" },
  { from: "/billing/submitted-claims", tab: "submitted" },
  { from: "/billing/payer-received", tab: "submitted" },
  { from: "/billing/transmission-failures", tab: "submitted" },
  // ── Denials ──────────────────────────────────────────────────────
  { from: "/billing/denials-by-carc", tab: "denials" },
  { from: "/billing/denials-by-rarc", tab: "denials" },
  { from: "/billing/claim-submission", tab: "denials" },
  { from: "/billing/partial-denials", tab: "denials" },
  { from: "/billing/medical-necessity", tab: "denials" },
  { from: "/billing/medical-review", tab: "denials" },
  { from: "/billing/aging", tab: "denials" },
  { from: "/billing/payer-rejections", tab: "denials" },
  { from: "/billing/underpayments", tab: "denials" },
  // ── Follow-Up ────────────────────────────────────────────────────
  { from: "/billing/appeals", tab: "follow_up" },
  { from: "/billing/corrected-claims", tab: "follow_up" },
  { from: "/billing/resubmissions", tab: "follow_up" },
  { from: "/billing/cob-issues", tab: "follow_up" },
  { from: "/billing/secondary-billing", tab: "follow_up" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "*.janeway.replit.dev",
    "*.replit.dev",
    "*.repl.co",
  ],
  async redirects() {
    return claimRedirects.map(({ from, tab, filter }) => {
      const qs = new URLSearchParams();
      qs.set("tab", tab);
      if (filter) qs.set("filter", filter);
      return {
        source: from,
        destination: `/billing/claims?${qs.toString()}`,
        permanent: false,
      };
    });
  },
};

export default nextConfig;
