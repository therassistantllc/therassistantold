import PlaceholderQueueClient from "@/components/billing/PlaceholderQueueClient";

export const metadata = { title: "Medical Necessity" };

export default function MedicalNecessityPage() {
  return (
    <PlaceholderQueueClient
      queueId="medical_necessity"
      filterUrlNamespace="med_nec"
      tabs={[
        { id: "open", label: "Open" },
        { id: "records_gathered", label: "Records Gathered" },
        { id: "appeal_sent", label: "Appeal Sent" },
        { id: "decided", label: "Decided" },
      ]}
      columns={[
        { id: "client", header: "Client" },
        { id: "claim", header: "Claim #" },
        { id: "payer", header: "Payer" },
        { id: "dx", header: "Primary Dx" },
        { id: "cpt", header: "CPT" },
        { id: "dos", header: "DOS" },
        { id: "denial_code", header: "Denial code" },
        { id: "charge", header: "Charge", align: "right" },
      ]}
    />
  );
}
