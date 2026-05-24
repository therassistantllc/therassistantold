import PlaceholderQueueClient from "@/components/billing/PlaceholderQueueClient";

export const metadata = { title: "Bad Debt Review" };

export default function BadDebtReviewPage() {
  return (
    <PlaceholderQueueClient
      queueId="bad_debt_review"
      filterUrlNamespace="bad_debt"
      tabs={[
        { id: "proposed", label: "Proposed" },
        { id: "approved", label: "Approved" },
        { id: "denied", label: "Denied" },
        { id: "written_off", label: "Written Off" },
      ]}
      columns={[
        { id: "patient", header: "Patient" },
        { id: "guarantor", header: "Guarantor" },
        { id: "balance", header: "Balance", align: "right" },
        { id: "oldest_dos", header: "Oldest DOS" },
        { id: "statements_sent", header: "Statements sent", align: "right" },
        { id: "last_payment", header: "Last payment" },
        { id: "proposed_by", header: "Proposed by" },
        { id: "supervisor", header: "Supervisor" },
      ]}
      summaryLabels={{ count: "Proposed write-offs", dollars: "Proposed $" }}
    />
  );
}
