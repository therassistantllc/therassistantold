import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdminClientTyped } from "@/lib/supabase/server";

interface QueryParams {
  pageSize?: string;
  pageNumber?: string;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    
    const { searchParams } = new URL(req.url);
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") ?? "50"), 500);
    const pageNumber = Math.max(parseInt(searchParams.get("pageNumber") ?? "1"), 1);
    const offset = (pageNumber - 1) * pageSize;

    const supabase = createServerSupabaseAdminClientTyped();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 503 }
      );
    }

    // Get job summary
    const { data: job, error: jobError } = await supabase
      .from("client_import_jobs")
      .select(
        "id, organization_id, source_system, original_file_name, status, total_rows, valid_rows, invalid_rows, imported_rows, duplicate_rows, created_at, updated_at"
      )
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Import job not found" },
        { status: 404 }
      );
    }

    // Get paginated rows
    const { data: rows, error: rowsError, count } = await supabase
      .from("client_import_rows")
      .select(
        "id, row_number, mapped_data, validation_errors, validation_warnings, duplicate_match_client_id, import_status, imported_client_id",
        { count: "exact" }
      )
      .eq("import_job_id", jobId)
      .order("row_number", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (rowsError) {
      return NextResponse.json(
        { error: "Failed to fetch import rows" },
        { status: 500 }
      );
    }

    const totalRows = count ?? 0;
    const totalPages = Math.ceil(totalRows / pageSize);

    // Map rows to response format, excluding raw PHI by default
    const mappedRows = (rows ?? []).map((row) => ({
      id: row.id,
      rowNumber: row.row_number,
      importStatus: row.import_status,
      errors: row.validation_errors ?? [],
      warnings: row.validation_warnings ?? [],
      isDuplicate: !!row.duplicate_match_client_id,
      mappedValues: row.mapped_data ? {
        first_name: row.mapped_data.first_name ?? null,
        last_name: row.mapped_data.last_name ?? null,
        email: row.mapped_data.email ?? null,
        phone: row.mapped_data.phone ?? null,
      } : null,
    }));

    return NextResponse.json({
      ok: true,
      job: {
        id: job.id,
        organizationId: job.organization_id,
        sourceSystem: job.source_system,
        fileName: job.original_file_name,
        status: job.status,
        totalRows: job.total_rows,
        validRows: job.valid_rows,
        invalidRows: job.invalid_rows,
        importedRows: job.imported_rows,
        duplicateRows: job.duplicate_rows,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      },
      pagination: {
        pageNumber,
        pageSize,
        totalRows,
        totalPages,
      },
      rows: mappedRows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to retrieve job details";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
