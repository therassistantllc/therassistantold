import PlaceholderQueueClient from "@/components/billing/PlaceholderQueueClient";

export const metadata = { title: "Adjustments Review" };

export default function AdjustmentsReviewPage() {
  return (
    <PlaceholderQueueClient
      queueId="adjustments_review"
      filterUrlNamespace="adjustments"
      tabs={[
        { id: "needs_review", label: "Needs Review" },
        { id: "approved", label: "Approved" },
        { id: "reversed", label: "Reversed" },
      ]}
      columns={[
        { id: "client", header: "Client" },
        { id: "claim", header: "Claim #" },
        { id: "payer", header: "Payer" },
        { id: "dos", header: "DOS" },
        { id: "type", header: "Adjustment type" },
        { id: "group_reason", header: "Group / reason" },
        { id: "amount", header: "Amount", align: "right" },
        { id: "posted_by", header: "Posted by" },
      ]}
      summaryLabels={{ count: "Adjustments flagged", dollars: "Flagged $" }}
    />
  );
}
