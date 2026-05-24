import PlaceholderQueueClient from "@/components/billing/PlaceholderQueueClient";

export const metadata = { title: "Compliance Holds" };

export default function ComplianceHoldsPage() {
  return (
    <PlaceholderQueueClient
      queueId="compliance_holds"
      filterUrlNamespace="comp_holds"
      tabs={[
        { id: "active", label: "Active Holds" },
        { id: "under_review", label: "Under Review" },
        { id: "released", label: "Released" },
      ]}
      columns={[
        { id: "placed", header: "Placed" },
        { id: "client", header: "Client" },
        { id: "claim", header: "Claim #" },
        { id: "provider", header: "Rendering provider" },
        { id: "reason", header: "Hold reason" },
        { id: "charge", header: "Charge", align: "right" },
        { id: "placed_by", header: "Placed by" },
        { id: "status", header: "Status" },
      ]}
    />
  );
}
