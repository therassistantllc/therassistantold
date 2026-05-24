import PlaceholderQueueClient from "@/components/billing/PlaceholderQueueClient";

export const metadata = { title: "Reconciliation Exceptions" };

export default function ReconciliationExceptionsPage() {
  return (
    <PlaceholderQueueClient
      queueId="reconciliation_exceptions"
      filterUrlNamespace="recon"
      tabs={[
        { id: "open", label: "Open" },
        { id: "investigating", label: "Investigating" },
        { id: "resolved", label: "Resolved" },
      ]}
      columns={[
        { id: "deposit_date", header: "Deposit date" },
        { id: "bank_ref", header: "Bank ref" },
        { id: "bank_amount", header: "Bank $", align: "right" },
        { id: "ehr_amount", header: "EHR $", align: "right" },
        { id: "variance", header: "Variance", align: "right" },
        { id: "type", header: "Exception type" },
        { id: "assigned", header: "Assigned to" },
        { id: "status", header: "Status" },
      ]}
      summaryLabels={{ count: "Open exceptions", dollars: "Variance $" }}
    />
  );
}
