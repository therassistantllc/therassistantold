import PlaceholderQueueClient from "@/components/billing/PlaceholderQueueClient";

export const metadata = { title: "Unposted Payments" };

export default function UnpostedPaymentsPage() {
  return (
    <PlaceholderQueueClient
      queueId="unposted_payments"
      filterUrlNamespace="unposted"
      tabs={[
        { id: "all", label: "All" },
        { id: "ach", label: "ACH / Lockbox" },
        { id: "check", label: "Check" },
        { id: "card", label: "Card / VCC" },
        { id: "patient", label: "Patient" },
      ]}
      columns={[
        { id: "received", header: "Received" },
        { id: "source", header: "Source" },
        { id: "reference", header: "Reference #" },
        { id: "payer_payor", header: "Payer / Payor" },
        { id: "amount", header: "Amount", align: "right" },
        { id: "age", header: "Age (days)", align: "right" },
        { id: "assigned", header: "Assigned to" },
        { id: "status", header: "Status" },
      ]}
      summaryLabels={{ count: "Unposted payments", dollars: "Unposted $" }}
    />
  );
}
