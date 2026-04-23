// Mock Claim Data Generator
import { Claim, ClaimStatus, ServiceLine, DiagnosisCode, ClaimNote, ClaimHistoryEvent, ClaimAlert } from "../types/claim";

export function getMockClaim(claimId: string): Claim {
  return {
    id: claimId,
    claim_number: `CLM-2026-${claimId.slice(0, 8).toUpperCase()}`,
    original_claim_number: undefined,
    frequency_type: "1",
    status: "submitted",
    source: "manual",
    priority: "routine",
    
    submission_date: "2026-04-15",
    dos_from: "2026-04-10",
    dos_to: "2026-04-10",
    created_at: "2026-04-12T10:30:00Z",
    updated_at: "2026-04-15T14:22:00Z",
    last_activity: "2026-04-15T14:22:00Z",
    
    patient: {
      id: "pat-001",
      first_name: "Sarah",
      last_name: "Johnson",
      dob: "1985-06-15",
      sex: "F",
      address: {
        street: "1234 Main Street",
        city: "Denver",
        state: "CO",
        zip: "80202"
      },
      phone: "(303) 555-0123",
      email: "sarah.johnson@example.com",
      relationship_to_subscriber: "self",
      marital_status: "married",
      employment_status: "employed",
      student_status: "none"
    },
    
    primary_insurance: {
      id: "ins-001",
      payer_name: "Anthem Blue Cross Blue Shield of Colorado",
      payer_id: "54771",
      member_id: "ABC123456789",
      group_number: "GRP987654",
      policy_holder_name: "Sarah Johnson",
      policy_holder_relationship: "self",
      plan_type: "PPO",
      effective_date: "2026-01-01",
      copay: 25,
      coinsurance: 20,
      deductible: 1500,
      eligibility_status: "active",
      eligibility_last_verified: "2026-04-12"
    },
    
    billing_provider: {
      id: "prov-001",
      npi: "1234567890",
      name: "Mountain View Behavioral Health",
      taxonomy_code: "103T00000X",
      ein: "84-1234567",
      address: {
        street: "5678 Healthcare Blvd, Suite 200",
        city: "Denver",
        state: "CO",
        zip: "80203"
      }
    },
    
    rendering_provider: {
      id: "prov-002",
      npi: "9876543210",
      name: "Dr. Emily Martinez, LCSW",
      taxonomy_code: "103T00000X"
    },
    
    diagnosis_codes: [
      {
        id: "dx-1",
        priority: 1,
        code: "F32.1",
        description: "Major depressive disorder, single episode, moderate",
        active: true,
        present_on_claim: true
      },
      {
        id: "dx-2",
        priority: 2,
        code: "F41.1",
        description: "Generalized anxiety disorder",
        active: true,
        present_on_claim: true
      },
      {
        id: "dx-3",
        priority: 3,
        code: "Z63.0",
        description: "Problems in relationship with spouse or partner",
        active: true,
        present_on_claim: true
      }
    ],
    
    service_lines: [
      {
        id: "line-1",
        dos_from: "2026-04-10",
        dos_to: "2026-04-10",
        place_of_service: "02",
        cpt_code: "90834",
        modifier_1: "95",
        diagnosis_pointers: ["A", "B"],
        units: 1,
        charge_amount: 150.00,
        allowed_amount: 135.00,
        rendering_provider_npi: "9876543210",
        authorization_number: "AUTH20260410001",
        claim_line_status: "submitted",
        claim_line_balance: 135.00
      },
      {
        id: "line-2",
        dos_from: "2026-04-10",
        dos_to: "2026-04-10",
        place_of_service: "02",
        cpt_code: "90791",
        modifier_1: "95",
        diagnosis_pointers: ["A", "B", "C"],
        units: 1,
        charge_amount: 200.00,
        allowed_amount: 180.00,
        rendering_provider_npi: "9876543210",
        authorization_number: "AUTH20260410001",
        claim_line_status: "submitted",
        claim_line_balance: 180.00
      }
    ],
    
    authorization_number: "AUTH20260410001",
    
    total_charges: 350.00,
    total_allowed_amount: 315.00,
    remaining_insurance_balance: 315.00,
    remaining_patient_balance: 0,
    
    assigned_biller_id: "user-001",
    assigned_biller_name: "Jessica Kim",
    aging_bucket: "0-30",
    open_tickets: 0,
    
    notes: [
      {
        id: "note-1",
        user_id: "user-001",
        user_name: "Jessica Kim",
        timestamp: "2026-04-15T14:22:00Z",
        note: "Claim submitted via Office Ally clearinghouse. Awaiting acknowledgment.",
        note_type: "internal"
      },
      {
        id: "note-2",
        user_id: "user-001",
        user_name: "Jessica Kim",
        timestamp: "2026-04-12T11:15:00Z",
        note: "Called Anthem to verify authorization. Auth# AUTH20260410001 confirmed active.",
        note_type: "payer_call"
      }
    ],
    
    history: [
      {
        id: "hist-1",
        timestamp: "2026-04-15T14:22:00Z",
        event_type: "submitted",
        description: "Claim submitted to clearinghouse",
        user_id: "user-001",
        user_name: "Jessica Kim"
      },
      {
        id: "hist-2",
        timestamp: "2026-04-12T10:30:00Z",
        event_type: "created",
        description: "Claim created",
        user_id: "user-001",
        user_name: "Jessica Kim"
      }
    ],
    
    alerts: [
      {
        id: "alert-1",
        type: "era_not_posted",
        severity: "info",
        message: "ERA not yet posted for this claim"
      }
    ]
  };
}

export function getMockClaimList(): Claim[] {
  return [
    getMockClaim("claim-001"),
    getMockClaim("claim-002"),
    getMockClaim("claim-003")
  ];
}
