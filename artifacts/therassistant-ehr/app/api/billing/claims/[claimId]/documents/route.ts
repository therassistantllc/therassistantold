/**
 * GET /api/billing/claims/[claimId]/documents
 *
 * Returns the documents linked to a claim, for the Claim Hold detail panel
 * (and any other surface that needs a claim's supporting paperwork).
 *
 * Source is derived from the document and (when present) its originating
 * mailroom item — so faxes and email-ingested mail show as "Fax" / "Mailroom"
 * rather than the generic "Manual upload".
 */
import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";
import { requireBillingAccess } from "@/lib/billing/requireBillingAccess";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbRow = Record<string, any>;

type DocumentSource = "mailroom" | "fax" | "manual_upload" | "other";

function deriveSource(doc: DbRow): { source: DocumentSource; sourceLabel: string } {
  const mailroom = doc.mailroom_items as DbRow | null;
  const mailroomSource =
    mailroom && typeof mailroom.source === "string"
      ? String(mailroom.source).toLowerCase()
      : null;

  if (mailroomSource === "fax") {
    return { source: "fax", sourceLabel: "Fax" };
  }
  if (mailroom || doc.document_scope === "mailroom" || doc.mailroom_item_id) {
    return { source: "mailroom", sourceLabel: "Mailroom" };
  }
  return { source: "manual_upload", sourceLabel: "Manual upload" };
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ claimId: string }> },
) {
  try {
    const { claimId } = await ctx.params;
    const { searchParams } = new URL(request.url);
    const guard = await requireBillingAccess({
      requestedOrganizationId: searchParams.get("organizationId"),
    });
    if (guard instanceof NextResponse) return guard;
    const organizationId = guard.organizationId;

    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Database not available" },
        { status: 500 },
      );
    }

    if (!claimId) {
      return NextResponse.json(
        { success: false, error: "claimId is required" },
        { status: 400 },
      );
    }

    const { data, error } = await (supabase as DbRow)
      .from("documents")
      .select(
        `id, document_scope, document_type, title, file_name, mime_type,
         file_size_bytes, notes, filed_at, created_at, mailroom_item_id,
         storage_bucket, storage_path,
         mailroom_items:mailroom_item_id ( id, source, sender_name, received_date )`,
      )
      .eq("organization_id", organizationId)
      .eq("claim_id", claimId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 422 },
      );
    }

    const documents = (data ?? []).map((doc: DbRow) => {
      const { source, sourceLabel } = deriveSource(doc);
      return {
        id: doc.id as string,
        title: (doc.title as string | null) ?? (doc.file_name as string | null) ?? "Document",
        fileName: (doc.file_name as string | null) ?? null,
        documentType: (doc.document_type as string | null) ?? null,
        documentScope: (doc.document_scope as string | null) ?? null,
        mimeType: (doc.mime_type as string | null) ?? null,
        fileSizeBytes: (doc.file_size_bytes as number | null) ?? null,
        notes: (doc.notes as string | null) ?? null,
        uploadedAt: (doc.filed_at as string | null) ?? (doc.created_at as string | null),
        createdAt: (doc.created_at as string | null) ?? null,
        mailroomItemId: (doc.mailroom_item_id as string | null) ?? null,
        hasFile: Boolean(doc.storage_bucket && doc.storage_path),
        source,
        sourceLabel,
      };
    });

    return NextResponse.json({
      success: true,
      documents,
      total: documents.length,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to load documents",
      },
      { status: 500 },
    );
  }
}
