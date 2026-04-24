import type {
  ClaimRecord,
  ClientRecord,
  EncounterRecord,
  DiagnosisRecord,
  ServiceLineRecord,
  InsurancePolicyRecord,
} from "../../../shared/contracts";

/**
 * Mock claim data for development/testing
 * Returns sample claims for placeholder UUIDs used in frontend
 */

const MOCK_ORGANIZATION_ID = "00000000-0000-0000-0000-000000000000";

const mockClients: Record<string, ClientRecord> = {
  "client-1": {
    id: "client-1",
    organization_id: MOCK_ORGANIZATION_ID,
    first_name: "Sarah",
    last_name: "Johnson",
    date_of_birth: "1990-05-15",
    sex: "F",
    email: "sarah.johnson@example.com",
    phone_home: "(555) 123-4567",
    address_line_1: "123 Main St",
    address_city: "Denver",
    address_state: "CO",
    address_postal_code: "80202",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
};

const mockEncounters: Record<string, EncounterRecord> = {
  "encounter-1": {
    id: "encounter-1",
    organization_id: MOCK_ORGANIZATION_ID,
    client_id: "client-1",
    provider_id: "provider-1",
    encounter_date: "2026-04-20",
    encounter_type: "individual_therapy",
    status: "completed",
    created_at: "2026-04-20T10:00:00Z",
    updated_at: "2026-04-20T11:00:00Z",
  },
};

const mockInsurancePolicies: Record<string, InsurancePolicyRecord> = {
  "policy-1": {
    id: "policy-1",
    organization_id: MOCK_ORGANIZATION_ID,
    client_id: "client-1",
    payer_id: "payer-anthem",
    payer_name: "Anthem BCBS",
    policy_number: "ABC123456789",
    group_number: "GRP001",
    priority: "primary",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
};

const mockDiagnoses: Record<string, DiagnosisRecord[]> = {
  "encounter-1": [
    {
      id: "dx-1",
      organization_id: MOCK_ORGANIZATION_ID,
      encounter_id: "encounter-1",
      diagnosis_code: "F32.1",
      diagnosis_description: "Major depressive disorder, single episode, moderate",
      diagnosis_order: 1,
      created_at: "2026-04-20T10:00:00Z",
      updated_at: "2026-04-20T10:00:00Z",
    },
  ],
};

const mockServiceLines: Record<string, ServiceLineRecord[]> = {
  "11111111-1111-1111-1111-111111111111": [
    {
      id: "sl-1",
      organization_id: MOCK_ORGANIZATION_ID,
      claim_id: "11111111-1111-1111-1111-111111111111",
      service_date: "2026-04-20",
      cpt_hcpcs_code: "90834",
      modifier_1: null,
      modifier_2: null,
      modifier_3: null,
      modifier_4: null,
      units: 1,
      charge_amount: 150.0,
      diagnosis_pointers: ["A"],
      claim_line_status: "submitted",
      created_at: "2026-04-20T11:00:00Z",
      updated_at: "2026-04-20T11:00:00Z",
    },
  ],
  "22222222-2222-2222-2222-222222222222": [
    {
      id: "sl-2",
      organization_id: MOCK_ORGANIZATION_ID,
      claim_id: "22222222-2222-2222-2222-222222222222",
      service_date: "2026-04-19",
      cpt_hcpcs_code: "90837",
      modifier_1: null,
      modifier_2: null,
      modifier_3: null,
      modifier_4: null,
      units: 1,
      charge_amount: 200.0,
      diagnosis_pointers: ["A"],
      claim_line_status: "submitted",
      created_at: "2026-04-19T11:00:00Z",
      updated_at: "2026-04-19T11:00:00Z",
    },
  ],
  "33333333-3333-3333-3333-333333333333": [
    {
      id: "sl-3",
      organization_id: MOCK_ORGANIZATION_ID,
      claim_id: "33333333-3333-3333-3333-333333333333",
      service_date: "2026-04-18",
      cpt_hcpcs_code: "90834",
      modifier_1: null,
      modifier_2: null,
      modifier_3: null,
      modifier_4: null,
      units: 1,
      charge_amount: 150.0,
      diagnosis_pointers: ["A"],
      claim_line_status: "paid",
      allowed_amount: 120.0,
      paid_amount: 120.0,
      created_at: "2026-04-18T11:00:00Z",
      updated_at: "2026-04-18T11:00:00Z",
    },
  ],
};

export const mockClaims: Record<string, ClaimRecord> = {
  "11111111-1111-1111-1111-111111111111": {
    id: "11111111-1111-1111-1111-111111111111",
    organization_id: MOCK_ORGANIZATION_ID,
    client_id: "client-1",
    encounter_id: "encounter-1",
    insurance_policy_id: "policy-1",
    claim_number: "CLM-2024-0045",
    claim_status: "submitted",
    date_of_service_from: "2026-04-20",
    date_of_service_to: "2026-04-20",
    place_of_service: "11",
    total_charge_amount: 150.0,
    submitted_at: "2026-04-21T09:00:00Z",
    created_at: "2026-04-20T11:00:00Z",
    updated_at: "2026-04-21T09:00:00Z",
  },
  "22222222-2222-2222-2222-222222222222": {
    id: "22222222-2222-2222-2222-222222222222",
    organization_id: MOCK_ORGANIZATION_ID,
    client_id: "client-1",
    encounter_id: "encounter-1",
    insurance_policy_id: "policy-1",
    claim_number: "CLM-2024-0044",
    claim_status: "submitted",
    date_of_service_from: "2026-04-19",
    date_of_service_to: "2026-04-19",
    place_of_service: "11",
    total_charge_amount: 200.0,
    submitted_at: "2026-04-20T09:00:00Z",
    created_at: "2026-04-19T11:00:00Z",
    updated_at: "2026-04-20T09:00:00Z",
  },
  "33333333-3333-3333-3333-333333333333": {
    id: "33333333-3333-3333-3333-333333333333",
    organization_id: MOCK_ORGANIZATION_ID,
    client_id: "client-1",
    encounter_id: "encounter-1",
    insurance_policy_id: "policy-1",
    claim_number: "CLM-2024-0043",
    claim_status: "paid",
    date_of_service_from: "2026-04-18",
    date_of_service_to: "2026-04-18",
    place_of_service: "11",
    total_charge_amount: 150.0,
    total_allowed_amount: 120.0,
    total_paid_amount: 120.0,
    submitted_at: "2026-04-19T09:00:00Z",
    paid_at: "2026-04-22T14:00:00Z",
    created_at: "2026-04-18T11:00:00Z",
    updated_at: "2026-04-22T14:00:00Z",
  },
};

export function getMockClaimData(claimId: string) {
  const claim = mockClaims[claimId];
  if (!claim) return null;

  return {
    claim,
    client: mockClients[claim.client_id] || null,
    encounter: mockEncounters[claim.encounter_id] || null,
    insurance_policy: mockInsurancePolicies[claim.insurance_policy_id] || null,
    diagnoses: mockDiagnoses[claim.encounter_id] || [],
    service_lines: mockServiceLines[claimId] || [],
  };
}
