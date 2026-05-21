import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";
import { DEFAULT_ORG_ID } from "@/lib/config";

const BUCKET = "mailroom-documents";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Database connection not available" }, { status: 500 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ success: false, error: "file is required" }, { status: 400 });
    }
    const organizationId = String(form.get("organizationId") || "").trim() || DEFAULT_ORG_ID;
    const clientId = String(form.get("clientId") || "").trim() || null;
    const documentType = String(form.get("documentType") || "").trim() || "other";

    const blob = file as Blob & { name?: string };
    const fileName = (blob.name && String(blob.name)) || `mailroom-${Date.now()}`;
    const mimeType = blob.type || "application/octet-stream";
    const safeName = fileName.replace(/[^\w.\-]+/g, "_");
    const storagePath = `${organizationId}/${Date.now()}-${safeName}`;

    const arrayBuffer = await blob.arrayBuffer();
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, new Uint8Array(arrayBuffer), { contentType: mimeType, upsert: false });
    if (upErr) {
      return NextResponse.json({ success: false, error: `Storage upload failed: ${upErr.message}` }, { status: 500 });
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("mailroom_items")
      .insert({
        organization_id: organizationId,
        client_id: clientId,
        file_name: fileName,
        mime_type: mimeType,
        storage_path: storagePath,
        status: "needs_review",
        document_type: documentType,
        source: "manual_upload",
        notes: "Uploaded via mailroom drop zone.",
        created_at: now,
        updated_at: now,
      })
      .select("id, file_name, mime_type, storage_path, status, document_type, source, client_id, notes, created_at, updated_at")
      .single();

    if (error || !data) {
      await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
      return NextResponse.json(
        { success: false, error: error?.message || "Failed to create mailroom item" },
        { status: 422 },
      );
    }

    return NextResponse.json({
      success: true,
      item: {
        id: String(data.id),
        fileName: String(data.file_name ?? fileName),
        mimeType: String(data.mime_type ?? mimeType),
        storagePath: String(data.storage_path ?? storagePath),
        status: String(data.status ?? "needs_review"),
        documentType: String(data.document_type ?? documentType),
        source: String(data.source ?? "manual_upload"),
        clientId: data.client_id ? String(data.client_id) : null,
        notes: String(data.notes ?? ""),
        createdAt: String(data.created_at ?? now),
      },
    });
  } catch (error) {
    console.error("Mailroom upload error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}
