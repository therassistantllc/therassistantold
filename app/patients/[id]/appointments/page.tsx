"use client";

import { useParams } from "next/navigation";
import TabNavigation from "@/components/ui/TabNavigation";
import DataTable, { Column } from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";

interface Appointment {
  id: string;
  date: string;
  time: string;
  provider: string;
  type: string;
  status: string;
  duration: number;
}

export default function PatientAppointmentsPage() {
  const params = useParams();
  const patientId = params.id as string;

  const tabs = [
    { id: "overview", label: "Overview", href: `/patients/${patientId}` },
    { id: "demographics", label: "Demographics", href: `/patients/${patientId}/demographics` },
    { id: "insurance", label: "Insurance", href: `/patients/${patientId}/insurance` },
    { id: "appointments", label: "Appointments", href: `/patients/${patientId}/appointments` },
    { id: "notes", label: "Notes", href: `/patients/${patientId}/notes` },
    { id: "claims", label: "Claims", href: `/patients/${patientId}/claims` },
    { id: "balances", label: "Balances", href: `/patients/${patientId}/balances` },
    { id: "documents", label: "Documents", href: `/patients/${patientId}/documents` },
    { id: "communications", label: "Communications", href: `/patients/${patientId}/communications` },
    { id: "tasks", label: "Tasks", href: `/patients/${patientId}/tasks` }
  ];

  const mockAppointments: Appointment[] = [
    { id: "APT-001", date: "2026-04-25", time: "10:00 AM", provider: "Dr. Chen", type: "Psychotherapy", status: "scheduled", duration: 60 },
    { id: "APT-002", date: "2026-04-15", time: "10:00 AM", provider: "Dr. Chen", type: "Psychotherapy", status: "completed", duration: 60 },
    { id: "APT-003", date: "2026-04-08", time: "10:00 AM", provider: "Dr. Chen", type: "Psychotherapy", status: "completed", duration: 60 },
  ];

  const columns: Column<Appointment>[] = [
    { header: "Date", accessor: "date" },
    { header: "Time", accessor: "time" },
    { header: "Provider", accessor: "provider" },
    { header: "Type", accessor: "type" },
    { 
      header: "Duration", 
      accessor: "duration",
      cell: (row) => `${row.duration} min`
    },
    {
      header: "Status",
      accessor: "status",
      cell: (row) => (
        <StatusBadge
          status={row.status.toUpperCase()}
          variant={row.status === "completed" ? "success" : row.status === "scheduled" ? "info" : "default"}
          size="sm"
        />
      )
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1800px] mx-auto px-6">
          <TabNavigation tabs={tabs} activeTab="appointments" />
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Appointment History</h2>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Schedule New
          </button>
        </div>
        
        <DataTable columns={columns} data={mockAppointments} />
      </div>
    </div>
  );
}
