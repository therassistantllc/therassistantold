"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { fetchClaimDetailFromApi } from "@/lib/api/canonical";
import { Claim } from "@/lib/types/claim";
import ClaimHeader from "./components/ClaimHeader";
import ClaimOverviewCard from "./components/ClaimOverviewCard";
import PatientInfoCard from "./components/PatientInfoCard";
import InsuranceInfoCard from "./components/InsuranceInfoCard";
import DiagnosisTable from "./components/DiagnosisTable";
import ServiceLineTable from "./components/ServiceLineTable";
import FinancialSummary from "./components/FinancialSummary";
import ClaimNotesPanel from "./components/ClaimNotesPanel";
import ClaimTimeline from "./components/ClaimTimeline";
import StickyClaimSidebar from "./components/StickyClaimSidebar";

interface ClaimDetailsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function ClaimDetailsPage({ params }: ClaimDetailsPageProps) {
  const router = useRouter();
  const { id } = React.use(params);
  const [claim, setClaim] = React.useState<Claim | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void fetchClaimDetailFromApi(id)
      .then((data) => {
        if (!active) return;
        setClaim(data);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load claim");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading claim...</p>
        </div>
      </div>
    );
  }

  if (error || !claim) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="max-w-md rounded-lg border border-red-200 bg-white p-6 text-center">
          <h1 className="text-xl font-semibold text-gray-900">Unable to load claim</h1>
          <p className="mt-2 text-sm text-red-700">{error || "Claim not found."}</p>
          <button
            type="button"
            onClick={() => router.push("/billing/ready-to-submit")}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Back to Claims
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ClaimHeader claim={claim} />
      
      <div className="max-w-[1800px] mx-auto px-6 py-6">
        <div className="flex gap-6">
          {/* Main Content */}
          <div className="flex-1 space-y-6">
            {/* Claim Overview */}
            <ClaimOverviewCard claim={claim} />
            
            {/* Patient Information */}
            <PatientInfoCard patient={claim.patient} />
            
            {/* Insurance Information */}
            <InsuranceInfoCard 
              primaryInsurance={claim.primary_insurance}
              secondaryInsurance={claim.secondary_insurance}
            />
            
            {/* Diagnosis Codes */}
            <DiagnosisTable diagnosisCodes={claim.diagnosis_codes} />
            
            {/* Service Lines */}
            <ServiceLineTable 
              serviceLines={claim.service_lines}
              diagnosisCodes={claim.diagnosis_codes}
            />
            
            {/* Financial Summary */}
            <FinancialSummary claim={claim} />
            
            {/* Claim Notes & Activity */}
            <ClaimNotesPanel notes={claim.notes} claimId={claim.id} />
            
            {/* Claim History Timeline */}
            <ClaimTimeline history={claim.history} />
          </div>
          
          {/* Sticky Sidebar */}
          <StickyClaimSidebar claim={claim} />
        </div>
      </div>
    </div>
  );
}
