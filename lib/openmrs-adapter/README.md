# OpenMRS Adapter Layer

Data transformation and integration adapter for bridging OpenMRS ESM modules with TherAssistant EHR.

## Overview

The OpenMRS Adapter provides a declarative, type-safe transformation layer that maps OpenMRS data structures to TherAssistant equivalents while:

1. **Preserving TherAssistant Business Logic** - All Supabase queries, billing workflows, Office Ally integration, and claim processing remain unchanged
2. **Maintaining Data Integrity** - Bidirectional mapping with OpenMRS UUIDs preserved for reconciliation
3. **Supporting Selective Sync** - Import only essential modules; defer bed/ward/lab/stock unless needed
4. **Enabling Gradual Migration** - Run OpenMRS and TherAssistant in parallel during transition

## Architecture

```
OpenMRS System → Adapter Layer → TherAssistant System
    ↓                  ↓              ↓
  Patient          mapOpenMRS      Client
  Visit            PatientTo        Appointment
  Encounter        Client()         Encounter
  Attachment       mapOpenMRS       Mailroom
                   VisitTo...       Item
                   validateMapped...
```

## Core Concepts

### Entity Mappings

| OpenMRS | TherAssistant | Purpose |
|---------|---------------|---------|
| Patient | Client | Patient identity, demographics |
| Patient UUID | externalClientRef | Cross-system reference |
| Visit | Appointment | Scheduling information |
| Encounter | Encounter | Clinical detail, diagnoses, service lines |
| Attachment | Mailroom Item | Documents, scans, correspondence |
| Observations | diagnoses[], clinical notes | Clinical data |
| Orders | service_lines[] | Billable procedures |

### Data Flow Example

```typescript
// 1. Fetch OpenMRS patient
const openMRSPatient = await fetchOpenMRSPatient(patientUuid);

// 2. Transform to TherAssistant client
const mappedClient = mapOpenMRSPatientToClient(openMRSPatient, config);

// 3. Validate
const { valid, errors } = validateMappedPatient(mappedClient);

// 4. Insert to Supabase
if (valid) {
  const { data } = await supabase
    .from("clients")
    .insert([mappedClient])
    .select();
}
```

## API Reference

### Patient Transformation

```typescript
import { mapOpenMRSPatientToClient, validateMappedPatient } from "@/lib/openmrs-adapter";

const config: OpenMRSMappingConfig = {
  organizationId: "org-uuid",
  identifierTypeUuids: {
    mrn: "8d793bee-c2cc-11de-8d13-0010c6dffd0f",
    externalRef: "external-id-uuid"
  },
  visitTypeUuids: {},
  encounterTypeUuids: {},
  conceptUuids: {},
  locationUuids: {}
};

const mappedPatient = mapOpenMRSPatientToClient(openMRSPatient, config);
const { valid, errors } = validateMappedPatient(mappedPatient);
```

### Visit & Encounter Transformation

```typescript
import { mapOpenMRSVisitToAppointmentAndEncounter } from "@/lib/openmrs-adapter";

const mappedVisit = mapOpenMRSVisitToAppointmentAndEncounter(
  openMRSVisit,
  therassistantClientId,
  config
);

// mappedVisit.appointment → INSERT INTO appointments
// mappedVisit.encounter → INSERT INTO encounters
```

### Attachment Transformation

```typescript
import { mapOpenMRSAttachmentToMailroom } from "@/lib/openmrs-adapter";

const mailroomItem = mapOpenMRSAttachmentToMailroom(
  openMRSAttachment,
  clientId,
  config,
  "s3://therassistant/documents/file.pdf"
);

// INSERT INTO mailroom_items
```

## Configuration

The `OpenMRSMappingConfig` object controls how OpenMRS UUIDs map to TherAssistant labels:

```typescript
interface OpenMRSMappingConfig {
  organizationId: string;
  
  // Map identifier type UUIDs to purposes
  identifierTypeUuids: {
    mrn?: string;                    // Medical record number
    externalRef?: string;            // External system reference
  };
  
  // Map visit type UUIDs to TherAssistant appointment types
  visitTypeUuids: Record<string, string>;
  // Example: { "uuid-for-initial": "Intake", "uuid-for-followup": "Follow-up" }
  
  // Map encounter type UUIDs to service purposes
  encounterTypeUuids: Record<string, string>;
  // Example: { "uuid-clinic": "office", "uuid-telehealth": "telehealth" }
  
  // Map concept UUIDs to domain codes
  conceptUuids: Record<string, string>;
  
  // Map location UUIDs to TherAssistant locations
  locationUuids: Record<string, string>;
  // Example: { "uuid-office": "Office", "uuid-virtual": "Virtual" }
}
```

## Usage Examples

### Complete Patient Import

```typescript
import { mapOpenMRSPatientToClient, validateMappedPatient } from "@/lib/openmrs-adapter";
import { createServerSupabaseServiceRoleClient } from "@/lib/supabase/server";

async function importOpenMRSPatient(openMRSPatientUuid: string, config: OpenMRSMappingConfig) {
  // 1. Fetch from OpenMRS
  const patient = await fetch(
    `${OPENMRS_API_URL}/patient/${openMRSPatientUuid}`
  ).then(r => r.json());

  // 2. Transform
  const mapped = mapOpenMRSPatientToClient(patient, config);
  
  // 3. Validate
  const { valid, errors } = validateMappedPatient(mapped);
  if (!valid) {
    console.error("Validation failed:", errors);
    return { success: false, errors };
  }

  // 4. Check for existing client
  const supabase = createServerSupabaseServiceRoleClient();
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("external_client_ref", mapped.externalClientRef)
    .eq("organization_id", config.organizationId)
    .maybeSingle();

  if (existing) {
    // Update existing client
    const { data: updated } = await supabase
      .from("clients")
      .update(mapped)
      .eq("id", existing.id)
      .select();
    return { success: true, client: updated?.[0], created: false };
  } else {
    // Insert new client
    const { data: created } = await supabase
      .from("clients")
      .insert([mapped])
      .select();
    return { success: true, client: created?.[0], created: true };
  }
}
```

### Batch Visit Import

```typescript
import { mapOpenMRSVisitToAppointmentAndEncounter, validateMappedVisit } from "@/lib/openmrs-adapter";

async function importOpenMRSVisit(
  openMRSVisit: OpenMRSVisit,
  clientId: string,
  config: OpenMRSMappingConfig
) {
  // Transform
  const mapped = mapOpenMRSVisitToAppointmentAndEncounter(openMRSVisit, clientId, config);
  const { valid, errors } = validateMappedVisit(mapped);

  if (!valid) {
    return { success: false, errors };
  }

  const supabase = createServerSupabaseServiceRoleClient();

  // Insert appointment
  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .insert([mapped.appointment])
    .select("id");

  if (apptError || !appointment?.[0]) {
    return { success: false, error: apptError?.message };
  }

  // Insert encounter if present
  if (mapped.encounter) {
    mapped.encounter.appointmentId = appointment[0].id;
    const { data: encounter, error: encError } = await supabase
      .from("encounters")
      .insert([mapped.encounter])
      .select("id");

    if (encError) {
      console.warn("Encounter insert warning:", encError);
    }
  }

  return {
    success: true,
    appointment: appointment[0],
    encounter: mapped.encounter,
  };
}
```

### Document Import with Storage

```typescript
import { mapOpenMRSAttachmentToMailroom } from "@/lib/openmrs-adapter";

async function importOpenMRSAttachment(
  attachment: OpenMRSAttachment,
  clientId: string,
  config: OpenMRSMappingConfig
) {
  const supabase = createServerSupabaseServiceRoleClient();

  // 1. Download file from OpenMRS
  const fileData = await fetch(attachment.fileMetadata.url).then(r => r.arrayBuffer());

  // 2. Upload to TherAssistant storage
  const storagePath = `mailroom/${config.organizationId}/${Date.now()}-${attachment.uuid}`;
  const { error: uploadError } = await supabase
    .storage
    .from("documents")
    .upload(storagePath, fileData, {
      contentType: attachment.fileMetadata.mimeType,
    });

  if (uploadError) {
    return { success: false, error: uploadError.message };
  }

  // 3. Transform and insert mailroom record
  const mapped = mapOpenMRSAttachmentToMailroom(attachment, clientId, config, storagePath);
  const { data } = await supabase
    .from("mailroom_items")
    .insert([mapped])
    .select();

  return { success: true, mailroomItem: data?.[0] };
}
```

## Reconciliation & Sync

The adapter preserves all OpenMRS UUIDs as `external*Uuid` fields for reconciliation:

- `externalClientRef` - OpenMRS Patient UUID
- `openmrsPatientUuid` - Duplicate reference
- `openmrsVisitUuid` - Visit UUID
- `openmrsEncounterId` - Encounter UUID
- `openmrsAttachmentUuid` - Attachment UUID

Use these to:
1. Check for duplicate imports (query by `externalClientRef`)
2. Update records from OpenMRS (find by UUID, update fields)
3. Reconcile two-way syncs (compare timestamps, content hashes)
4. Handle deletions (mark as archived when deleted in OpenMRS)

## Validation

All transformations include built-in validation:

```typescript
const { valid, errors } = validateMappedPatient(mapped);
// errors = ["First name is required", "Date of birth is required", ...]
```

Never insert unvalidated data. Handle validation errors by:
1. Logging for manual review
2. Creating a reconciliation ticket
3. Marking the record as "pending_review"
4. Notifying admin for correction

## Next Steps

After Phase 2 (adapter layer), proceed to:

- **Phase 3**: Audit OpenMRS module compatibility (npm packages vs single-spa)
- **Phase 4**: Import high-priority modules (home, patient chart, appointments)
- **Phase 5**: Replace broken UI with OpenMRS-adapted components
- **Phase 6**: Full integration testing and data migration

## See Also

- [OpenMRS ESM Documentation](https://openmrs.org/wiki/display/projects/OpenMRS+SPA)
- [TherAssistant Schema](../../schema.sql)
- [API Endpoints Reference](../../docs/api-endpoints.md)
