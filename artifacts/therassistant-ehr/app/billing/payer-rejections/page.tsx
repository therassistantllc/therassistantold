import PlaceholderQueueClient from "@/components/billing/PlaceholderQueueClient";

export const metadata = { title: "Payer Rejections" };

export default function PayerRejectionsPage() {
  return (
    <PlaceholderQueueClient
      queueId="payer_rejections"
      filterUrlNamespace="payer_rejections"
      tabs={[
        { id: "new", label: "New" },
        { id: "in_review", label: "In Review" },
        { id: "fixed_pending", label: "Fixed — Pending Resubmit" },
        { id: "resubmitted", label: "Resubmitted" },
      ]}
      columns={[
        { id: "client", header: "Client" },
        { id: "claim", header: "Claim #" },
        { id: "payer", header: "Payer" },
        { id: "dos", header: "DOS" },
        { id: "reason", header: "Rejection reason" },
        { id: "received", header: "Received" },
        { id: "charge", header: "Charge", align: "right" },
        { id: "status", header: "Status" },
      ]}
    />
  );
}
