import PlaceholderQueueClient from "@/components/billing/PlaceholderQueueClient";

export const metadata = { title: "Audit Queue" };

export default function AuditQueuePage() {
  return (
    <PlaceholderQueueClient
      queueId="audit_queue"
      filterUrlNamespace="audit"
      tabs={[
        { id: "pre_bill", label: "Pre-bill" },
        { id: "post_payment", label: "Post-payment" },
        { id: "in_progress", label: "In Progress" },
        { id: "complete", label: "Complete" },
      ]}
      columns={[
        { id: "selected", header: "Selected on" },
        { id: "client", header: "Client" },
        { id: "claim", header: "Claim #" },
        { id: "payer", header: "Payer" },
        { id: "dos", header: "DOS" },
        { id: "audit_type", header: "Audit type" },
        { id: "auditor", header: "Auditor" },
        { id: "status", header: "Status" },
      ]}
    />
  );
}
