import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";

type DbRow = Record<string, unknown>;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function itemDto(row: DbRow) {
  return {
    id: clean(row.id),
    organizationId: clean(row.organization_id),
    clientId: clean(row.client_id),
    fileName: clean(row.file_name),
    fileType: clean(row.file_type),
    storagePath: clean(row.storage_path),
    status: clean(row.status),
    documentCategory: clean(row.document_category),
    source: clean(row.source),
    description: clean(row.description),
    adminComments: clean(row.admin_comments),
    uploadedBy: clean(row.uploaded_by),
    createdAt: clean(row.created_at),
    updatedAt: clean(row.updated_at),
  };
}

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Database connection not available" }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId") || process.env.NEXT_PUBLIC_ORGANIZATION_ID || "";
    const status = searchParams.get("status") || "pending";
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 100);

    if (!organizationId) return NextResponse.json({ success: false, error: "organizationId is required" }, { status: 400 });

    let query = supabase
      .from("mailroom_items")
      .select("id, organization_id, client_id, file_name, file_type, storage_path, status, document_category, source, description, admin_comments, uploaded_by, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status !== "all") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 422 });

    return NextResponse.json({ success: true, items: ((data ?? []) as DbRow[]).map(itemDto) });
  } catch (error) {
    console.error("Mailroom items API error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Mailroom items failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Database connection not available" }, { status: 500 });

    const body = await request.json();
    const organizationId = clean(body.organizationId) || process.env.NEXT_PUBLIC_ORGANIZATION_ID || "";
    const fileName = clean(body.fileName) || "uploaded-mailroom-document";
    const fileType = clean(body.fileType) || "application/pdf";
    const storagePath = clean(body.storagePath) || `manual-mailroom/${Date.now()}-${fileName}`;
    const clientId = clean(body.clientId) || null;
    const documentCategory = clean(body.documentCategory) || "payer_correspondence";
    const description = clean(body.description) || "Mailroom document routed for billing/admin review.";

    if (!organizationId) return NextResponse.json({ success: false, error: "organizationId is required" }, { status: 400 });

    const { data, error } = await supabase
      .from("mailroom_items")
      .insert({
        organization_id: organizationId,
        client_id: clientId,
        file_name: fileName,
        file_type: fileType,
        storage_path: storagePath,
        status: "pending",
        document_category: documentCategory,
        source: clean(body.source) || "manual_upload",
        description,
        uploaded_by: clean(body.uploadedBy) || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error || !data) return NextResponse.json({ success: false, error: error?.message || "Failed to create mailroom item" }, { status: 422 });

    const { error: workqueueError } = await supabase.from("workqueue_items").insert({
      organization_id: organizationId,
      title: `Mailroom review - ${fileName}`,
      description,
      work_type: "mailroom_review",
      status: "open",
      priority: "normal",
      source_object_type: "mailroom_item",
      source_object_id: data.id,
      client_id: clientId,
      context_payload: {
        mailroom_item_id: data.id,
        document_category: documentCategory,
        file_name: fileName,
        storage_path: storagePath,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, mailroomItemId: data.id, workqueueCreated: !workqueueError, workqueueError: workqueueError?.message || null });
  } catch (error) {
    console.error("Create mailroom item API error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Create mailroom item failed" }, { status: 500 });
  }
}
