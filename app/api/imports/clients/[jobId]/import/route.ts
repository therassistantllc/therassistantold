import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdminClientTyped } from "@/lib/supabase/server";

interface ImportRequest {
  importDuplicates?: boolean;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    const body = (await req.json()) as ImportRequest;
    const { importDuplicates = false } = body;

    const supabase = createServerSupabaseAdminClientTyped();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 503 }
      );
    }

    // Verify job exists and is validated
    const { data: job, error: jobError } = await supabase
      .from("client_import_jobs")
      .select("id, status, organization_id, mapping")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Import job not found" },
        { status: 404 }
      );
    }

    if (job.status !== "validated") {
      return NextResponse.json(
        { error: `Job status is ${job.status}, expected 'validated'` },
        { status: 400 }
      );
    }

    // Fetch rows to import
    const query = supabase
      .from("client_import_rows")
      .select("id, row_number, mapped_data, import_status, duplicate_match_client_id")
      .eq("import_job_id", jobId);

    // Only fetch valid rows (and optionally duplicates)
    if (importDuplicates) {
      query.in("import_status", ["valid", "duplicate"]);
    } else {
      query.eq("import_status", "valid");
    }

    const { data: rows, error: rowsError } = await query.order("row_number", {
      ascending: true,
    });

    if (rowsError || !rows) {
      return NextResponse.json(
        { error: "Failed to fetch rows for import" },
        { status: 500 }
      );
    }

    // Track results
    let importedCount = 0;
    let failedCount = 0;
    const failedRows: Array<{ rowNumber: number; error: string }> = [];

    // Update job status to importing
    await supabase
      .from("client_import_jobs")
      .update({ status: "importing", updated_at: new Date().toISOString() })
      .eq("id", jobId);

    // Insert each valid row as a new client record
    for (const row of rows) {
      try {
        const mappedData = (row.mapped_data ?? {}) as Record<string, unknown>;

        // Construct client payload from mapped data
        const clientPayload = {
          organization_id: job.organization_id,
          first_name: mappedData.first_name ?? null,
          last_name: mappedData.last_name ?? null,
          middle_name: mappedData.middle_name ?? null,
          preferred_name: mappedData.preferred_name ?? null,
          date_of_birth: mappedData.date_of_birth ?? null,
          email: mappedData.email ?? null,
          phone: mappedData.phone ?? null,
          mrn: mappedData.mrn ?? null,
          sex_at_birth: mappedData.sex_at_birth ?? null,
          gender_identity: mappedData.gender_identity ?? null,
          pronouns: mappedData.pronouns ?? null,
          preferred_language: mappedData.preferred_language ?? null,
          address_line_1: mappedData.address_line1 ?? null,
          address_line_2: mappedData.address_line2 ?? null,
          city: mappedData.city ?? null,
          state: mappedData.state ?? null,
          postal_code: mappedData.postal_code ?? null,
          external_client_ref: mappedData.external_client_ref ?? null,
          primary_clinician_user_id: mappedData.primary_clinician_user_id ?? null,
        };

        // Insert new client
        const { data: insertedClient, error: insertError } = await supabase
          .from("clients")
          .insert(clientPayload)
          .select("id")
          .single();

        if (insertError || !insertedClient) {
          failedCount += 1;
          failedRows.push({
            rowNumber: row.row_number,
            error: insertError?.message ?? "Unknown insertion error",
          });
          continue;
        }

        // Mark row as imported
        const { error: updateRowError } = await supabase
          .from("client_import_rows")
          .update({
            imported_client_id: insertedClient.id,
            import_status: "imported",
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        if (updateRowError) {
          failedCount += 1;
          failedRows.push({
            rowNumber: row.row_number,
            error: "Failed to update row status",
          });
          continue;
        }

        importedCount += 1;
      } catch (error) {
        failedCount += 1;
        failedRows.push({
          rowNumber: row.row_number,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Count remaining rows by status for summary
    const { data: finalRows } = await supabase
      .from("client_import_rows")
      .select("import_status")
      .eq("import_job_id", jobId);

    const duplicateCount = (finalRows ?? []).filter(
      (r) => r.import_status === "duplicate"
    ).length;
    const invalidCount = (finalRows ?? []).filter(
      (r) => r.import_status === "invalid"
    ).length;

    // Update job with final counts
    const { error: updateJobError } = await supabase
      .from("client_import_jobs")
      .update({
        status: "completed",
        imported_rows: importedCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (updateJobError) {
      return NextResponse.json(
        { error: "Failed to finalize job" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      import: {
        importedCount,
        duplicateCount,
        invalidCount,
        failedCount,
      },
      failedRows: failedRows.length > 0 ? failedRows : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import rows";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
