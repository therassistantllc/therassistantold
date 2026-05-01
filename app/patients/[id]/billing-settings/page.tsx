// File: app/patients/[id]/billing-settings/page.tsx
"use client";

import { useParams } from "next/navigation";
import ClassicPatientChartResolved from "@/components/patient-chart/ClassicPatientChartResolved";

export default function PatientBillingSettingsPage() {
  const params = useParams<{ id: string }>();
  const patientId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  if (!patientId) {
    return <div>Patient ID not found</div>;
  }

  return <ClassicPatientChartResolved routeSource="patients" patientId={patientId} />;
}
