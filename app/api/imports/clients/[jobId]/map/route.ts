import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdminClientTyped } from "@/lib/supabase/server";
import { applyClientImportMapping } from "@/lib/imports/clientImportMappingService";
import { validateClientImportRows } from "@/lib/imports/clientImportValidationService";

interface MapRequest {
  mapping: Record<string, string | null>;
}

export async function POST(
  req: NextRequest,
  context: { params: { jobId: string } }
) {
  try {
    const { jobId } = context.params;
    const body = (await req.json()) as MapRequest;
    const { mapping } = body;

    if (!mapping || typeof mapping !== "object") {
      return NextResponse.json(
        { error: "mapping is required and must be an object" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseAdminClientTyped();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 503 }
      );
    }

    // Verify job exists and get current rows
    const { data: job, error: jobError } = await supabase
      .from("client_import_jobs")
      .select("id, status")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Import job not found" },
        { status: 404 }
      );
    }

    // Fetch all rows for this job
    const { data: rows, error: rowsError } = await supabase
      .from("client_import_rows")
      .select("id, row_number, raw_data")
      .eq("import_job_id", jobId)
      .order("row_number", { ascending: true });

    if (rowsError || !rows) {
      return NextResponse.json(
        { error: "Failed to fetch import rows" },
        { status: 500 }
      );
    }

    // Apply mapping to all rows
    const mappedRows = rows.map((row) => {
      const rawData = (row.raw_data ?? {}) as Record<string, unknown>;
      const mapped = applyClientImportMapping(rawData, mapping);
      return {
        id: row.id,
        mapped_data: mapped,
      };
    });

    // Validate all rows
    const validatedRows = await validateClientImportRows(
      rows.map((row) => ({
        id: row.id,
        row_number: row.row_number,
        mapped_data: mappedRows.find((m) => m.id === row.id)?.mapped_data ?? null,
      }))
    );

    // Prepare bulk update data
    const updateData = validatedRows.map((validated) => ({
      id: validated.id,
      mapped_data: validated.mappedData,
      validation_errors: validated.errors.length > 0 ? validated.errors : null,
      validation_warnings: validated.warnings.length > 0 ? validated.warnings : null,
      duplicate_match_client_id: validated.duplicateMatchClientId,
      import_status: validated.importStatus,
      updated_at: new Date().toISOString(),
    }));

    // Update all rows with mapped and validated data
    for (const update of updateData) {
      const { error: updateError } = await supabase
        .from("client_import_rows")
        .update({
          mapped_data: update.mapped_data,
          validation_errors: update.validation_errors,
          validation_warnings: update.validation_warnings,
          duplicate_match_client_id: update.duplicate_match_client_id,
          import_status: update.import_status,
          updated_at: update.updated_at,
        })
        .eq("id", update.id);

      if (updateError) {
        await supabase
          .from("client_import_jobs")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        return NextResponse.json(
          { error: "Failed to update import rows" },
          { status: 500 }
        );
      }
    }

    // Calculate validation summary
    const validCount = validatedRows.filter((r) => r.importStatus === "valid")
      .length;
    const invalidCount = validatedRows.filter((r) => r.importStatus === "invalid")
      .length;
    const duplicateCount = validatedRows.filter(
      (r) => r.importStatus === "duplicate"
    ).length;

    const validationSummary = {
      totalRows: validatedRows.length,
      validRows: validCount,
      invalidRows: invalidCount,
      duplicateRows: duplicateCount,
      validatedAt: new Date().toISOString(),
    };

    // Update job status to validated
    const { error: updateJobError } = await supabase
      .from("client_import_jobs")
      .update({
        status: "validated",
        valid_rows: validCount,
        invalid_rows: invalidCount,
        duplicate_rows: duplicateCount,
        validation_summary: validationSummary,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (updateJobError) {
      return NextResponse.json(
        { error: "Failed to update job status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      validationSummary,
      rowValidations: validatedRows.map((r) => ({
        rowNumber: r.rowNumber,
        importStatus: r.importStatus,
        errors: r.errors,
        warnings: r.warnings,
        isDuplicate: !!r.duplicateMatchClientId,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to map and validate rows";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
