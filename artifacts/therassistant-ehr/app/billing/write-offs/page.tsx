import PlaceholderQueueClient from "@/components/billing/PlaceholderQueueClient";

export const metadata = { title: "Write-offs" };

export default function WriteOffsPage() {
  return (
    <PlaceholderQueueClient
      queueId="write_offs"
      filterUrlNamespace="write_offs"
      tabs={[
        { id: "recent", label: "Recent" },
        { id: "reversals", label: "Reversals" },
        { id: "by_reason", label: "By Reason" },
      ]}
      columns={[
        { id: "date", header: "Date" },
        { id: "patient", header: "Patient" },
        { id: "claim", header: "Claim #" },
        { id: "payer", header: "Payer" },
        { id: "reason", header: "Reason" },
        { id: "amount", header: "Amount", align: "right" },
        { id: "posted_by", header: "Posted by" },
        { id: "approved_by", header: "Approved by" },
      ]}
      summaryLabels={{ count: "Write-offs (this period)", dollars: "Write-off $" }}
    />
  );
}
