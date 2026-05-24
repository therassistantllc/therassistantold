import PlaceholderQueueClient from "@/components/billing/PlaceholderQueueClient";

export const metadata = { title: "Resubmission Queue" };

export default function ResubmissionsPage() {
  return (
    <PlaceholderQueueClient
      queueId="resubmission_queue"
      filterUrlNamespace="resubmissions"
      tabs={[
        { id: "ready", label: "Ready to Resubmit" },
        { id: "queued", label: "Queued for Batch" },
        { id: "submitted", label: "Submitted" },
        { id: "blocked", label: "Blocked" },
      ]}
      columns={[
        { id: "client", header: "Client" },
        { id: "claim", header: "Claim #" },
        { id: "freq", header: "Frequency" },
        { id: "payer", header: "Payer" },
        { id: "dos", header: "DOS" },
        { id: "reason", header: "Resubmit reason" },
        { id: "charge", header: "Charge", align: "right" },
        { id: "status", header: "Status" },
      ]}
    />
  );
}
