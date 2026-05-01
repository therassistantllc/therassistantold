# Office Ally Sandbox Clearinghouse Framework

## Overview

This implementation provides a complete sandbox framework for Office Ally clearinghouse integration without making live API calls. All operations are server-side only with credentials stored securely.

## Components

### 1. Database Tables Expected

The implementation expects these Supabase tables to exist:

- `integration_connections` - Stores clearinghouse connection settings
  - `id`, `organization_id`, `integration_name`, `connection_status`, `mode`, `supported_transactions`, `live_transactions_enabled`, `credentials_storage`, `sender_id`, `receiver_id`, `last_checked_at`, etc.

- `external_transactions` - Stores all clearinghouse transaction records
  - `id`, `organization_id`, `integration_connection_id`, `transaction_type`, `payload_type`, `message_format`, `processing_mode`, `processing_status`, `sender_id`, `receiver_id`, `source_object_type`, `source_object_id`, `request_payload`, `response_payload`, `parsed_response_summary`, `request_timestamp`, `response_timestamp`, etc.

- `external_transaction_attempts` - Stores individual API attempt details
  - `id`, `external_transaction_id`, `attempt_number`, `attempt_status`, `http_status_code`, `raw_request`, `raw_response`, `attempt_started_at`, `attempt_completed_at`, etc.

- `external_message_envelopes` - Stores EDI envelope/wrapper information (optional)
  - `id`, `external_transaction_id`, `envelope_type`, `control_number`, `sender_id`, `receiver_id`, etc.

- `eligibility_checks` - Stores eligibility verification results
  - `id`, `organization_id`, `patient_id`, `appointment_id`, `eligibility_status`, `checked_at`, `coverage_start_date`, `coverage_end_date`, `copay_amount`, `deductible_remaining`, `out_of_pocket_remaining`, `response_summary`, `external_transaction_id`, etc.

### 2. Pages Created

#### `/settings/clearinghouse` - Main clearinghouse settings page

- Displays Office Ally connection status from `integration_connections`
- Shows mode (sandbox/live), connection status, supported transactions
- Provides "Test Connection", "View Transaction Log", and "Configure" buttons
- Real-time display of last check timestamp

#### `/settings/clearinghouse/transactions` - Transaction log viewer

- Lists all `external_transactions` records
- Filterable by transaction type and processing status
- Shows sender/receiver, timestamps, source objects, and processing details
- Real-time refresh capability

#### `/settings/clearinghouse/configure` - Configuration page

- Currently a placeholder showing sandbox status
- Emphasizes server-side credential storage
- Warns that live transactions are disabled

### 3. API Routes Created

#### `POST /api/integrations/office-ally/test`

**Purpose**: Test the Office Ally connection in sandbox mode

**Request Body**:

```json
{
  "integrationName": "office_ally"
}
```

**Response**:

```json
{
  "success": true,
  "message": "Connection test successful",
  "connectionStatus": "sandbox_configured",
  "transactionId": "uuid",
  "lastCheckedAt": "2026-05-01T12:00:00Z"
}
```

**Behavior**:

- Creates an `external_transactions` record with `transaction_type: "test_connection"`
- Creates an `external_transaction_attempts` record
- Updates `integration_connections.last_checked_at`
- Returns mock success response (no live API call)
- All server-side only - no credentials exposed

#### `POST /api/eligibility/check`

**Purpose**: Run eligibility verification for an appointment or existing check

**Request Body**:

```json
{
  "appointmentId": "uuid",
  "eligibilityCheckId": "uuid",  // Alternative to appointmentId
  "organizationId": "uuid"
}
```

**Response**:

```json
{
  "success": true,
  "message": "Eligibility check completed successfully (sandbox mode)",
  "eligibilityCheck": {
    "id": "uuid",
    "eligibility_status": "active",
    "checked_at": "2026-05-01T12:00:00Z",
    "coverage_start_date": "2026-01-01",
    "coverage_end_date": "2026-12-31",
    "copay_amount": 25.0,
    "deductible_remaining": 850.0,
    "out_of_pocket_remaining": 2300.0,
    "response_summary": { ... },
    "external_transaction_id": "uuid"
  },
  "transactionId": "uuid"
}
```

**Behavior**:
- Finds or creates an `eligibility_checks` record
- Creates `external_transactions` record with `transaction_type: "eligibility"` and `payload_type: "270"`
- Creates `external_transaction_attempts` record with mock X12 270/271 data
- Updates `eligibility_checks` with sandbox coverage details:
  - `eligibility_status` = "active" (matches enum)
  - Coverage dates (start/end)
  - Copay, deductible, out-of-pocket amounts
  - Links to `external_transaction_id`
- Generates mock 270 request and 271 response in X12 format
- No live Office Ally API calls

#### `GET /api/integrations/connections`

**Purpose**: Fetch all integration connections

**Response**:

```json
{
  "connections": [
    {
      "id": "uuid",
      "integration_name": "office_ally",
      "connection_status": "sandbox_configured",
      "mode": "sandbox",
      "live_transactions_enabled": false,
      "supported_transactions": ["270/271", "276/277", "837P", "835"],
      "last_checked_at": "2026-05-01T12:00:00Z"
    }
  ]
}
```

#### `GET /api/integrations/transactions`

**Purpose**: Fetch transaction history

**Query Parameters**:
- `transaction_type` - Filter by type (optional)
- `processing_status` - Filter by status (optional)
- `processing_mode` - Filter by sandbox/live (optional)
- `limit` - Max records (default: 100)

**Response**:

```json
{
  "transactions": [ ... ],
  "count": 42
}
```

### 4. Type Definitions

Created `/types/integrations.ts` with complete TypeScript interfaces:
- `IntegrationConnection`
- `ExternalTransaction`
- `ExternalTransactionAttempt`
- `ExternalMessageEnvelope`
- `TestConnectionRequest/Response`
- `EligibilityCheckRequest/Response`

## Safety Features

✅ **Server-side only**: All API routes use `createServerSupabaseAdminClient()`  
✅ **No credential exposure**: Credentials never sent to client  
✅ **Sandbox mode enforced**: `processing_mode: "sandbox"` on all transactions  
✅ **Live transactions disabled**: `live_transactions_enabled: false`  
✅ **No real API calls**: All responses are mock data  
✅ **Audit trail**: Complete transaction and attempt logging  

## Usage Flow

### Testing Connection

1. Navigate to Settings > Clearinghouse
2. Click "Test Connection" button
3. System creates transaction records
4. Updates `last_checked_at` timestamp
5. Displays success message

### Running Eligibility Check

```javascript
// From your code
const response = await fetch('/api/eligibility/check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    appointmentId: 'your-appointment-id',
    organizationId: 'your-org-id'
  })
});

const data = await response.json();
// data.eligibilityCheck contains updated eligibility information
```

### Viewing Transaction Log

1. Navigate to Settings > Clearinghouse > View Transaction Log
2. Filter by transaction type or status
3. See all external_transactions with timestamps and details

## Mock Data Generated

### Eligibility Check (270/271)

- Status: "active"
- Coverage: Jan 1 - Dec 31 (current year)
- Copay: $25.00
- Deductible remaining: $850.00
- Out-of-pocket remaining: $2,300.00
- Includes mock X12 270 and 271 EDI segments

### Test Connection

- Status: "completed"
- Message: "Sandbox connection test successful"
- Connection healthy: true

## Integration with appointment_eligibility_status View

The `eligibility_checks` table updates will automatically be reflected in the `appointment_eligibility_status` view since we populate:
- `appointment_id` (links to appointment)
- `eligibility_status` (active/inactive enum)
- `checked_at` (timestamp)
- `coverage_start_date`, `coverage_end_date`
- `copay_amount`, `deductible_remaining`, etc.

## Next Steps for Live Integration

When ready to enable live Office Ally transactions:

1. Update `integration_connections.live_transactions_enabled = true`
2. Store actual Office Ally credentials in `encrypted_credentials` (server-side)
3. Replace mock response logic with real Office Ally API client
4. Update `processing_mode` from "sandbox" to "live"
5. Implement error handling for real API failures
6. Add retry logic to `external_transaction_attempts`

## Files Created

```
types/integrations.ts
app/settings/clearinghouse/page.tsx
app/settings/clearinghouse/transactions/page.tsx
app/settings/clearinghouse/configure/page.tsx
app/api/integrations/connections/route.ts
app/api/integrations/office-ally/test/route.ts
app/api/integrations/transactions/route.ts
app/api/eligibility/check/route.ts
```

## Testing Checklist

- [ ] npm run build passes
- [ ] Settings > Clearinghouse page loads
- [ ] Office Ally connection displays with sandbox status
- [ ] Test Connection button creates transaction records
- [ ] Transaction log shows created records
- [ ] Eligibility check populates eligibility_checks table
- [ ] appointment_eligibility_status view reflects updated data
- [ ] No TypeScript errors
- [ ] No credentials exposed in client code
- [ ] All operations use server-side Supabase client
