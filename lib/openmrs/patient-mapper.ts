export type OpenMrsPatient = {
  uuid: string;
  person?: {
    display?: string;
    preferredName?: {
      givenName?: string;
      familyName?: string;
    };
    dead?: boolean;
    deathDate?: string | null;
    attributes?: Array<{
      attributeType?: { display?: string };
      value?: string;
    }>;
  };
};

function getAttribute(patient: OpenMrsPatient, label: string) {
  return (
    patient.person?.attributes?.find((attribute) =>
      attribute.attributeType?.display?.toLowerCase().includes(label.toLowerCase()),
    )?.value ?? null
  );
}

export function mapOpenMrsPatientToClientRecord(patient: OpenMrsPatient) {
  const name = patient.person?.preferredName;

  return {
    id: patient.uuid,
    name:
      patient.person?.display ||
      [name?.givenName, name?.familyName].filter(Boolean).join(" ") ||
      "Unnamed client",
    preferredName: null,
    email: getAttribute(patient, "email"),
    phone: getAttribute(patient, "phone"),
    status: patient.person?.dead ? "deceased" : "active",
    intakeStatus: null,
    openBalance: 0,
    updatedAt: null,
  };
}