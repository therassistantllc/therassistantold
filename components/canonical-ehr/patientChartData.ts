export type PatientChartTab =
  | "profile"
  | "documents"
  | "billing-settings"
  | "patient-billing"
  | "portal"
  | "cards"
  | "authorizations";

export type DocumentStatus = "draft" | "signed" | "uploaded" | "current" | "expired";
export type TransactionType = "charge" | "insurance_payment" | "patient_payment" | "adjustment" | "statement";
export type AuthorizationStatus = "active" | "expiring" | "expired" | "not_required";

export interface PatientIdentity {
  id: string;
  internalId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  preferredName: string;
  dob: string;
  age: number;
  genderIdentity: string;
  pronouns: string;
  sexAtBirth: string;
  ssnLast4?: string;
  status: "active" | "inactive" | "prospective" | "discharged";
  assignedClinician: string;
  location: string;
  referralSource: string;
}

export interface PatientContact {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  guarantorName: string;
  guarantorRelationship: string;
  guarantorPhone: string;
}

export interface ChartDocument {
  id: string;
  type: string;
  dateOfService: string;
  status: DocumentStatus;
  author: string;
  title: string;
  summary: string;
  locked: boolean;
  source: "clinical_note" | "uploaded_file" | "signed_form" | "treatment_plan";
}

export interface InsurancePolicy {
  id: string;
  priority: "Primary" | "Secondary";
  payerName: string;
  payerType: string;
  memberId: string;
  groupNumber: string;
  subscriberName: string;
  subscriberDob: string;
  subscriberRelationship: string;
  effectiveDate: string;
  terminationDate?: string;
  status: "active" | "inactive" | "unknown";
}

export interface Authorization {
  id: string;
  payerName: string;
  authorizationNumber: string;
  serviceCodes: string[];
  startDate: string;
  endDate: string;
  unitsAuthorized: number;
  unitsUsed: number;
  status: AuthorizationStatus;
}

export interface BillingSettings {
  copayReference: number;
  privatePayRate: number;
  slidingScaleAdjustment: number;
  billingNotes: string[];
  policies: InsurancePolicy[];
  authorizations: Authorization[];
}

export interface PatientTransaction {
  id: string;
  type: TransactionType;
  date: string;
  description: string;
  amount: number;
  insurancePortion: number;
  patientPortion: number;
  balanceAfter: number;
  linkedDateOfService?: string;
  linkedClaimNumber?: string;
}

export interface Statement {
  id: string;
  date: string;
  amount: number;
  status: "draft" | "sent" | "paid" | "void";
}

export interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expiration: string;
  status: "active" | "expired";
  autopay: boolean;
}

export interface PortalAccess {
  enabled: boolean;
  inviteStatus: "not_invited" | "invited" | "active" | "disabled";
  lastLogin?: string;
  sharedDocuments: string[];
  messagingEnabled: boolean;
}

export interface PatientChartRecord {
  identity: PatientIdentity;
  contact: PatientContact;
  documents: ChartDocument[];
  billingSettings: BillingSettings;
  transactions: PatientTransaction[];
  statements: Statement[];
  paymentMethods: PaymentMethod[];
  portal: PortalAccess;
}

export const patientChartRecords: PatientChartRecord[] = [
  {
    identity: {
      id: "pat_avery_morgan",
      internalId: "CO-BH-1042",
      firstName: "Avery",
      middleName: "Jordan",
      lastName: "Morgan",
      preferredName: "Avery",
      dob: "1998-07-14",
      age: 27,
      genderIdentity: "Nonbinary",
      pronouns: "they/them",
      sexAtBirth: "F",
      ssnLast4: "2147",
      status: "active",
      assignedClinician: "Lena Ortiz, LPC",
      location: "Denver Telehealth",
      referralSource: "Primary Care Partners"
    },
    contact: {
      addressLine1: "1430 N Clarkson St",
      addressLine2: "Apt 4B",
      city: "Denver",
      state: "CO",
      zip: "80218",
      phone: "(720) 555-0142",
      email: "avery.morgan@example.com",
      emergencyContactName: "Morgan Reed",
      emergencyContactPhone: "(720) 555-9871",
      guarantorName: "Self",
      guarantorRelationship: "Self",
      guarantorPhone: "(720) 555-0142"
    },
    documents: [
      {
        id: "doc_501",
        type: "Progress Note",
        dateOfService: "2026-04-28",
        status: "draft",
        author: "Lena Ortiz, LPC",
        title: "90837 Progress Note",
        summary: "Draft note in progress for telehealth psychotherapy encounter.",
        locked: false,
        source: "clinical_note"
      },
      {
        id: "doc_500",
        type: "Progress Note",
        dateOfService: "2026-04-22",
        status: "signed",
        author: "Lena Ortiz, LPC",
        title: "90834 Progress Note",
        summary: "CBT session addressing panic symptoms, workplace stressors, and grounding skills. No current SI/HI.",
        locked: true,
        source: "clinical_note"
      },
      {
        id: "doc_401",
        type: "Treatment Plan",
        dateOfService: "2026-01-08",
        status: "current",
        author: "Lena Ortiz, LPC",
        title: "Active Treatment Plan",
        summary: "Goals for reducing panic frequency and improving social connection.",
        locked: true,
        source: "treatment_plan"
      },
      {
        id: "doc_301",
        type: "Consent",
        dateOfService: "2026-01-08",
        status: "signed",
        author: "Avery Morgan",
        title: "Informed Consent for Psychotherapy",
        summary: "Signed intake consent and HIPAA acknowledgement.",
        locked: true,
        source: "signed_form"
      }
    ],
    billingSettings: {
      copayReference: 25,
      privatePayRate: 165,
      slidingScaleAdjustment: 0,
      billingNotes: [
        "Verify Medicaid eligibility monthly.",
        "Use telehealth POS 10 when client located at home.",
        "ROI on file for Primary Care Partners."
      ],
      policies: [
        {
          id: "pol_1",
          priority: "Primary",
          payerName: "Colorado Medicaid",
          payerType: "Medicaid / RAE",
          memberId: "CO123456789",
          groupNumber: "RAE-3",
          subscriberName: "Avery Morgan",
          subscriberDob: "1998-07-14",
          subscriberRelationship: "Self",
          effectiveDate: "2026-01-01",
          status: "active"
        }
      ],
      authorizations: [
        {
          id: "auth_1",
          payerName: "Colorado Medicaid",
          authorizationNumber: "AUTH-CO-44821",
          serviceCodes: ["90834", "90837"],
          startDate: "2026-01-01",
          endDate: "2026-06-30",
          unitsAuthorized: 24,
          unitsUsed: 7,
          status: "active"
        }
      ]
    },
    transactions: [
      {
        id: "txn_1",
        type: "charge",
        date: "2026-04-22",
        description: "90834 Psychotherapy charge",
        amount: 125,
        insurancePortion: 125,
        patientPortion: 0,
        balanceAfter: 125,
        linkedDateOfService: "2026-04-22",
        linkedClaimNumber: "CLM-20260422-1042"
      },
      {
        id: "txn_2",
        type: "insurance_payment",
        date: "2026-04-25",
        description: "Insurance payment for 90834",
        amount: -93,
        insurancePortion: -93,
        patientPortion: 0,
        balanceAfter: 32,
        linkedClaimNumber: "CLM-20260422-1042"
      },
      {
        id: "txn_3",
        type: "adjustment",
        date: "2026-04-25",
        description: "Contractual adjustment",
        amount: -32,
        insurancePortion: -32,
        patientPortion: 0,
        balanceAfter: 0,
        linkedClaimNumber: "CLM-20260422-1042"
      }
    ],
    statements: [{ id: "stmt_1", date: "2026-04-01", amount: 0, status: "sent" }],
    paymentMethods: [{ id: "pm_1", brand: "Visa", last4: "4242", expiration: "09/28", status: "active", autopay: false }],
    portal: {
      enabled: true,
      inviteStatus: "active",
      lastLogin: "2026-04-20 18:11",
      sharedDocuments: ["Informed Consent for Psychotherapy", "Telehealth Consent", "Good Faith Estimate"],
      messagingEnabled: true
    }
  },
  {
    identity: {
      id: "pat_sofia_martinez",
      internalId: "CO-BH-1043",
      firstName: "Sofia",
      lastName: "Martinez",
      preferredName: "Sofia",
      dob: "2010-11-03",
      age: 15,
      genderIdentity: "Female",
      pronouns: "she/her",
      sexAtBirth: "F",
      status: "active",
      assignedClinician: "Noah Kim, LCSW",
      location: "Arapahoe Office",
      referralSource: "School counselor"
    },
    contact: {
      addressLine1: "8801 E Iliff Ave",
      city: "Denver",
      state: "CO",
      zip: "80231",
      phone: "Guardian: (303) 555-0178",
      email: "guardian.martinez@example.com",
      emergencyContactName: "Elena Martinez",
      emergencyContactPhone: "(303) 555-0178",
      guarantorName: "Elena Martinez",
      guarantorRelationship: "Mother/Guardian",
      guarantorPhone: "(303) 555-0178"
    },
    documents: [
      {
        id: "doc_612",
        type: "Progress Note",
        dateOfService: "2026-04-24",
        status: "signed",
        author: "Noah Kim, LCSW",
        title: "90837 Adolescent Therapy Note",
        summary: "Safety plan reviewed with guardian. No imminent intent disclosed.",
        locked: true,
        source: "clinical_note"
      },
      {
        id: "doc_610",
        type: "Consent",
        dateOfService: "2026-03-12",
        status: "signed",
        author: "Elena Martinez",
        title: "Guardian Consent for Treatment",
        summary: "Guardian consent and minor rights acknowledgement.",
        locked: true,
        source: "signed_form"
      }
    ],
    billingSettings: {
      copayReference: 40,
      privatePayRate: 150,
      slidingScaleAdjustment: 0,
      billingNotes: ["School ROI pending. Do not release records until signed."],
      policies: [
        {
          id: "pol_2",
          priority: "Primary",
          payerName: "Anthem Colorado",
          payerType: "Commercial",
          memberId: "ANT1239987",
          groupNumber: "CO-GRP-44",
          subscriberName: "Elena Martinez",
          subscriberDob: "1982-02-13",
          subscriberRelationship: "Parent",
          effectiveDate: "2026-01-01",
          status: "active"
        }
      ],
      authorizations: []
    },
    transactions: [
      {
        id: "txn_4",
        type: "charge",
        date: "2026-04-24",
        description: "90837 Psychotherapy charge",
        amount: 165,
        insurancePortion: 125,
        patientPortion: 40,
        balanceAfter: 40,
        linkedDateOfService: "2026-04-24",
        linkedClaimNumber: "CLM-20260424-1043"
      }
    ],
    statements: [{ id: "stmt_2", date: "2026-04-26", amount: 40, status: "draft" }],
    paymentMethods: [],
    portal: {
      enabled: true,
      inviteStatus: "invited",
      sharedDocuments: ["Guardian Consent for Treatment", "Minor Rights Acknowledgment"],
      messagingEnabled: false
    }
  }
];

export function getPatientChartRecord(patientId: string): PatientChartRecord {
  return patientChartRecords.find((record) => record.identity.id === patientId || record.identity.internalId === patientId) ?? patientChartRecords[0];
}

export function formatMoney(value: number): string {
  const absolute = Math.abs(value);
  const formatted = absolute.toLocaleString("en-US", { style: "currency", currency: "USD" });
  return value < 0 ? `-${formatted}` : formatted;
}

export function getPatientBalance(record: PatientChartRecord): number {
  return record.transactions.at(-1)?.balanceAfter ?? 0;
}

export function getInsuranceBalance(record: PatientChartRecord): number {
  return record.transactions.reduce((sum, transaction) => sum + transaction.insurancePortion, 0);
}

export function getPatientResponsibility(record: PatientChartRecord): number {
  return record.transactions.reduce((sum, transaction) => sum + transaction.patientPortion, 0);
}
