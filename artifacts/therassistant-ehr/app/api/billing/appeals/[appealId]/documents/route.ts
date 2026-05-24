/**
 * /api/billing/appeals/[appealId]/documents
 *
 * GET  — list real supporting documents uploaded against an appeal.
 * POST — multipart upload: stores the file in the `claim-appeal-documents`
 *        Supabase storage bucket and inserts a row in
 *        public.claim_appeal_documents so it surfaces in the Attachments
 *        tab with a download link. Also writes a claim_notes entry for
 *        the audit trail.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";
import { requireBillingAccess } from "@/lib/billing/requireBillingAccess";

const BUCKET = "claim-appeal-documents";
const MAX_BYTES = 25 * 1024 * 1024;

const text = (v: unknown) => String(v ?? "").trim();

async function ensureBucket(
  supabase: ReturnType<typeof createServerSupabaseAdminClient>,
) {
  if (!supabase) return;
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    if (buckets && buckets.some((b) => b.name === BUCKET)) return;
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_BYTES,
    });
    if (error && !/already exists/i.test(error.message)) {
      console.warn("[appeals.documents] ensure-bucket-error", error.message);
    }
  } catch (err) {
    console.warn(
      "[appeals.documents] ensure-bucket-exception",
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function loadAppeal(
  supabase: ReturnType<typeof createServerSupabaseAdminClient>,
  organizationId: string,
  appealId: string,
) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("claim_appeals")
    .select("id, claim_id, organization_id")
    .eq("organization_id", organizationId)
    .eq("id", appealId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { id: string; claim_id: string; organization_id: string } | null;
}

function shapeDoc(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    appealId: String(row.appeal_id),
    claimId: String(row.claim_id),
    fileName: text(row.file_name) || "document",
    mimeType: text(row.mime_type) || null,
    fileSizeBytes:
      row.file_size_bytes === null || row.file_size_bytes === undefined
        ? null
        : Number(row.file_size_bytes),
    description: text(row.description) || null,
    uploadedByDisplayName: text(row.uploaded_by_display_name) || null,
    uploadedAt: text(row.created_at) || null,
  };
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ appealId: string }> },
) {
  try {
    const { appealId } = await ctx.params;
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
    if (!appealId) {
      return NextResponse.json(
        { success: false, error: "appealId is required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("claim_appeal_documents")
      .select(
        "id, appeal_id, claim_id, file_name, mime_type, file_size_bytes, description, uploaded_by_display_name, created_at",
      )
      .eq("organization_id", organizationId)
      .eq("appeal_id", appealId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 422 },
      );
    }

    const documents = (data ?? []).map((r) => shapeDoc(r as Record<string, unknown>));
    return NextResponse.json({ success: true, documents, total: documents.length });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to list documents",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ appealId: string }> },
) {
  try {
    const { appealId } = await ctx.params;
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Database not available" },
        { status: 500 },
      );
    }
    if (!appealId) {
      return NextResponse.json(
        { success: false, error: "appealId is required" },
        { status: 400 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { success: false, error: "file is required" },
        { status: 400 },
      );
    }
    const guard = await requireBillingAccess({
      requestedOrganizationId: text(form.get("organizationId")) || null,
    });
    if (guard instanceof NextResponse) return guard;
    const organizationId = guard.organizationId;

    const appeal = await loadAppeal(supabase, organizationId, appealId);
    if (!appeal) {
      return NextResponse.json(
        { success: false, error: "Appeal not found" },
        { status: 404 },
      );
    }

    const blob = file as Blob & { name?: string };
    const size = blob.size ?? 0;
    if (size <= 0) {
      return NextResponse.json(
        { success: false, error: "Uploaded file is empty" },
        { status: 400 },
      );
    }
    if (size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: `File exceeds ${MAX_BYTES / (1024 * 1024)}MB cap` },
        { status: 413 },
      );
    }

    const fileName = (blob.name && String(blob.name)) || `appeal-${Date.now()}`;
    const mimeType = blob.type || "application/octet-stream";
    const description = text(form.get("description")) || null;
    const safeName = fileName.replace(/[^\w.\-]+/g, "_");
    const storagePath = `${organizationId}/${appealId}/${Date.now()}-${safeName}`;

    await ensureBucket(supabase);

    const buffer = new Uint8Array(await blob.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false });
    if (upErr) {
      return NextResponse.json(
        { success: false, error: `Storage upload failed: ${upErr.message}` },
        { status: 500 },
      );
    }

    const userId = (guard as { userId?: string | null }).userId ?? null;
    const authorDisplay = text(form.get("actorDisplayName")) || null;

    const { data: inserted, error: insertErr } = await supabase
      .from("claim_appeal_documents")
      .insert({
        organization_id: organizationId,
        appeal_id: appealId,
        claim_id: appeal.claim_id,
        file_name: fileName,
        mime_type: mimeType,
        file_size_bytes: size,
        storage_bucket: BUCKET,
        storage_path: storagePath,
        description,
        uploaded_by_user_id: userId,
        uploaded_by_display_name: authorDisplay,
      })
      .select(
        "id, appeal_id, claim_id, file_name, mime_type, file_size_bytes, description, uploaded_by_display_name, created_at",
      )
      .single();

    if (insertErr || !inserted) {
      await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
      return NextResponse.json(
        { success: false, error: insertErr?.message || "Failed to record document" },
        { status: 422 },
      );
    }

    // Refresh denormalized counter + audit note. Counter is derived from
    // the documents table on read, but keeping the column up to date keeps
    // older read paths honest.
    const { count } = await supabase
      .from("claim_appeal_documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("appeal_id", appealId);

    const now = new Date().toISOString();
    await supabase
      .from("claim_appeals")
      .update({ attachments_count: count ?? 0, updated_at: now })
      .eq("organization_id", organizationId)
      .eq("id", appealId);

    await supabase.from("claim_notes").insert({
      organization_id: organizationId,
      claim_id: appeal.claim_id,
      body: `Uploaded appeal document: ${fileName}${description ? ` — ${description}` : ""}`,
      author_user_id: userId,
      author_display_name: authorDisplay,
    });

    return NextResponse.json({
      success: true,
      document: shapeDoc(inserted as Record<string, unknown>),
      attachmentsCount: count ?? 0,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Upload failed",
      },
      { status: 500 },
    );
  }
}
