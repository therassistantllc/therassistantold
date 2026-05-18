// File: app/api/mailroom/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseServiceRoleClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Service role key is required for file uploads." },
        { status: 503 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const organizationId = formData.get("organizationId") as string | null;
    const fileName = (formData.get("fileName") as string) || (file?.name ?? "document");
    const mimeType = (formData.get("mimeType") as string) || (file?.type ?? "application/octet-stream");
    const clientId = formData.get("clientId") as string | null;
    const documentType = formData.get("documentType") as string || "practice_document";
    const notes = formData.get("notes") as string || "";

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided." }, { status: 400 });
    }

    if (!organizationId) {
      return NextResponse.json({ success: false, error: "organizationId is required." }, { status: 400 });
    }

    // Generate unique file path
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 10);
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `mailroom/${organizationId}/${timestamp}-${randomStr}-${safeFileName}`;

    // Upload file to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, uint8Array, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { success: false, error: `File upload failed: ${uploadError.message}` },
        { status: 500 },
      );
    }

    // Create mailroom item record
    const { data: mailroomItem, error: itemError } = await supabase
      .from("mailroom_items")
      .insert([
        {
          organization_id: organizationId,
          file_name: fileName,
          mime_type: mimeType,
          storage_path: storagePath,
          client_id: clientId || null,
          document_type: documentType,
          status: "needs_review",
          notes: notes || null,
          source: "manual_upload",
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (itemError) {
      return NextResponse.json(
        { success: false, error: `Failed to create mailroom item: ${itemError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        mailroomItemId: mailroomItem?.id,
        message: "File uploaded and mailroom item created successfully.",
      },
      { status: 201 },
    );
  } catch (error) {
    const message = (error instanceof Error) ? error.message : "File upload failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
