import PlaceholderQueueClient from "@/components/billing/PlaceholderQueueClient";

export const metadata = { title: "Partial Denials" };

export default function PartialDenialsPage() {
  return (
    <PlaceholderQueueClient
      queueId="partial_denials"
      filterUrlNamespace="partial_denials"
      tabs={[
        { id: "open", label: "Open" },
        { id: "appealing", label: "Appealing" },
        { id: "recovered", label: "Recovered" },
        { id: "written_off", label: "Written Off" },
      ]}
      columns={[
        { id: "client", header: "Client" },
        { id: "claim", header: "Claim #" },
        { id: "payer", header: "Payer" },
        { id: "dos", header: "DOS" },
        { id: "billed", header: "Billed", align: "right" },
        { id: "paid", header: "Paid", align: "right" },
        { id: "shortfall", header: "Shortfall", align: "right" },
        { id: "carc", header: "CARC / RARC" },
      ]}
      summaryLabels={{ count: "Partial-pay claims", dollars: "Total shortfall" }}
    />
  );
}
