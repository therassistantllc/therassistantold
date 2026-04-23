"use client";

import { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import DataTable, { Column } from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  insurance: string;
  lastVisit: string;
  nextVisit: string;
  status: string;
}

export default function PatientsPage() {
  const [searchTerm, setSearchTerm] = useState("");

  // Mock patient data
  const mockPatients: Patient[] = [
    {
      id: "PAT-001",
      firstName: "Sarah",
      lastName: "Johnson",
      dob: "1990-05-15",
      phone: "(303) 555-0123",
      insurance: "Anthem BCBS",
      lastVisit: "2026-04-15",
      nextVisit: "2026-04-29",
      status: "active"
    },
    {
      id: "PAT-002",
      firstName: "Michael",
      lastName: "Smith",
      dob: "1985-08-22",
      phone: "(303) 555-0456",
      insurance: "UnitedHealthcare",
      lastVisit: "2026-04-18",
      nextVisit: "2026-05-02",
      status: "active"
    },
    {
      id: "PAT-003",
      firstName: "Emily",
      lastName: "Davis",
      dob: "1995-03-10",
      phone: "(303) 555-0789",
      insurance: "Cigna",
      lastVisit: "2026-04-12",
      nextVisit: "2026-04-26",
      status: "active"
    },
    {
      id: "PAT-004",
      firstName: "James",
      lastName: "Wilson",
      dob: "1978-11-30",
      phone: "(303) 555-1234",
      insurance: "Aetna",
      lastVisit: "2026-04-10",
      nextVisit: "",
      status: "inactive"
    },
    {
      id: "PAT-005",
      firstName: "Jennifer",
      lastName: "Martinez",
      dob: "1992-07-18",
      phone: "(303) 555-5678",
      insurance: "Colorado Medicaid",
      lastVisit: "2026-04-20",
      nextVisit: "2026-05-04",
      status: "active"
    }
  ];

  const columns: Column<Patient>[] = [
    {
      header: "Patient ID",
      accessor: "id",
      cell: (row) => (
        <a href={`/patients/${row.id}`} className="text-blue-600 hover:text-blue-700 font-mono font-medium">
          {row.id}
        </a>
      )
    },
    { 
      header: "Name", 
      accessor: "firstName",
      cell: (row) => (
        <a href={`/patients/${row.id}`} className="font-medium text-gray-900 hover:text-blue-600">
          {row.lastName}, {row.firstName}
        </a>
      )
    },
    { header: "Date of Birth", accessor: "dob" },
    { header: "Phone", accessor: "phone" },
    { header: "Insurance", accessor: "insurance" },
    { header: "Last Visit", accessor: "lastVisit" },
    { 
      header: "Next Visit", 
      accessor: "nextVisit",
      cell: (row) => row.nextVisit || <span className="text-gray-400">Not scheduled</span>
    },
    {
      header: "Status",
      accessor: "status",
      cell: (row) => (
        <StatusBadge
          status={row.status.toUpperCase()}
          variant={row.status === "active" ? "success" : "default"}
          size="sm"
        />
      )
    }
  ];

  const filteredPatients = mockPatients.filter(patient => {
    const searchLower = searchTerm.toLowerCase();
    return (
      patient.id.toLowerCase().includes(searchLower) ||
      patient.firstName.toLowerCase().includes(searchLower) ||
      patient.lastName.toLowerCase().includes(searchLower) ||
      patient.phone.includes(searchTerm) ||
      patient.insurance.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <PageHeader
          title="Patients"
          subtitle={`${filteredPatients.length} patient${filteredPatients.length !== 1 ? 's' : ''} found`}
          actions={
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
              + Add Patient
            </button>
          }
        />

        {/* Search Bar */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by name, ID, phone, or insurance..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">
              Filters
            </button>
            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">
              Export
            </button>
          </div>
        </div>

        {/* Patients Table */}
        <DataTable
          columns={columns}
          data={filteredPatients}
          selectable
          onSelectionChange={(selected) => console.log("Selected patients:", selected)}
        />
      </div>
    </div>
  );
}
