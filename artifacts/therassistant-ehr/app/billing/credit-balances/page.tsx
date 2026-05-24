import PlaceholderQueueClient from "@/components/billing/PlaceholderQueueClient";

export const metadata = { title: "Credit Balances" };

export default function CreditBalancesPage() {
  return (
    <PlaceholderQueueClient
      queueId="credit_balances"
      filterUrlNamespace="credit_balances"
      tabs={[
        { id: "patient", label: "Patient Credits" },
        { id: "payer", label: "Payer Credits" },
        { id: "needs_refund", label: "Needs Refund" },
        { id: "transfer_pending", label: "Transfer Pending" },
        { id: "resolved", label: "Resolved" },
      ]}
      columns={[
        { id: "holder", header: "Patient / Payer" },
        { id: "account", header: "Account / Claim" },
        { id: "balance", header: "Credit $", align: "right" },
        { id: "since", header: "Outstanding since" },
        { id: "age", header: "Age (days)", align: "right" },
        { id: "proposed_action", header: "Proposed action" },
        { id: "assigned", header: "Assigned to" },
      ]}
      summaryLabels={{ count: "Accounts with credit", dollars: "Credit $" }}
    />
  );
}
