import { createServerSupabaseAdminClient } from "@/lib/supabase/server";

export interface WorkqueueActionInput {
  organizationId: string;
  workqueueItemId: string;
  userId?: string | null;
  comment?: string | null;
}

export interface AssignWorkqueueInput extends WorkqueueActionInput {
  assignedToUserId: string;
}

export interface DeferWorkqueueInput extends WorkqueueActionInput {
  deferredUntil: string;
  deferReason?: string | null;
}

export interface WorkqueueActionResult {
  ok: boolean;
  workqueueItemId: string;
  status: string | null;
  errors: Array<{ field: string; message: string }>;
}

type WorkqueueItem = {
  id: string;
  status: string;
};

async function loadWorkqueueItem(organizationId: string, workqueueItemId: string) {
  const supabase = createServerSupabaseAdminClient();
  if (!supabase) throw new Error("Database connection not available");

  const { data, error } = await supabase
    .from("workqueue_items")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("id", workqueueItemId)
    .is("archived_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as WorkqueueItem | null;
}

async function addComment(params: {
  organizationId: string;
  workqueueItemId: string;
  commentBody: string;
  commentType: "note" | "status_change" | "assignment" | "defer" | "resolution";
  userId?: string | null;
}) {
  const supabase = createServerSupabaseAdminClient();
  if (!supabase) throw new Error("Database connection not available");

  const body = params.commentBody.trim();
  if (!body) return;

  const { error } = await supabase.from("workqueue_item_comments").insert({
    organization_id: params.organizationId,
    workqueue_item_id: params.workqueueItemId,
    comment_body: body,
    comment_type: params.commentType,
    created_by_user_id: params.userId ?? null,
  });

  if (error) throw new Error(error.message);
}

function baseError(input: WorkqueueActionInput, message: string): WorkqueueActionResult {
  return {
    ok: false,
    workqueueItemId: input.workqueueItemId,
    status: null,
    errors: [{ field: "workqueue_items", message }],
  };
}

export async function addWorkqueueComment(input: WorkqueueActionInput): Promise<WorkqueueActionResult> {
  const item = await loadWorkqueueItem(input.organizationId, input.workqueueItemId);
  if (!item) return baseError(input, "Workqueue item not found");

  await addComment({
    organizationId: input.organizationId,
    workqueueItemId: input.workqueueItemId,
    commentBody: input.comment ?? "",
    commentType: "note",
    userId: input.userId ?? null,
  });

  return { ok: true, workqueueItemId: input.workqueueItemId, status: item.status, errors: [] };
}

export async function assignWorkqueueItem(input: AssignWorkqueueInput): Promise<WorkqueueActionResult> {
  const supabase = createServerSupabaseAdminClient();
  if (!supabase) return baseError(input, "Database connection not available");

  const item = await loadWorkqueueItem(input.organizationId, input.workqueueItemId);
  if (!item) return baseError(input, "Workqueue item not found");

  const { error } = await supabase
    .from("workqueue_items")
    .update({
      assigned_to_user_id: input.assignedToUserId,
      status: item.status === "open" ? "in_progress" : item.status,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.workqueueItemId);

  if (error) return baseError(input, error.message);

  await addComment({
    organizationId: input.organizationId,
    workqueueItemId: input.workqueueItemId,
    commentBody: input.comment ?? `Assigned workqueue item to ${input.assignedToUserId}`,
    commentType: "assignment",
    userId: input.userId ?? null,
  });

  return {
    ok: true,
    workqueueItemId: input.workqueueItemId,
    status: item.status === "open" ? "in_progress" : item.status,
    errors: [],
  };
}

export async function deferWorkqueueItem(input: DeferWorkqueueInput): Promise<WorkqueueActionResult> {
  const supabase = createServerSupabaseAdminClient();
  if (!supabase) return baseError(input, "Database connection not available");

  const item = await loadWorkqueueItem(input.organizationId, input.workqueueItemId);
  if (!item) return baseError(input, "Workqueue item not found");

  const deferredDate = new Date(input.deferredUntil);
  if (Number.isNaN(deferredDate.getTime())) {
    return {
      ok: false,
      workqueueItemId: input.workqueueItemId,
      status: item.status,
      errors: [{ field: "deferredUntil", message: "deferredUntil must be a valid date" }],
    };
  }

  const { error } = await supabase
    .from("workqueue_items")
    .update({
      status: "deferred",
      deferred_until: deferredDate.toISOString(),
      defer_reason: input.deferReason ?? input.comment ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.workqueueItemId);

  if (error) return baseError(input, error.message);

  await addComment({
    organizationId: input.organizationId,
    workqueueItemId: input.workqueueItemId,
    commentBody: input.comment ?? `Deferred until ${deferredDate.toISOString()}`,
    commentType: "defer",
    userId: input.userId ?? null,
  });

  return { ok: true, workqueueItemId: input.workqueueItemId, status: "deferred", errors: [] };
}

export async function resolveWorkqueueItem(input: WorkqueueActionInput): Promise<WorkqueueActionResult> {
  const supabase = createServerSupabaseAdminClient();
  if (!supabase) return baseError(input, "Database connection not available");

  const item = await loadWorkqueueItem(input.organizationId, input.workqueueItemId);
  if (!item) return baseError(input, "Workqueue item not found");

  const { error } = await supabase
    .from("workqueue_items")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: input.userId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.workqueueItemId);

  if (error) return baseError(input, error.message);

  await addComment({
    organizationId: input.organizationId,
    workqueueItemId: input.workqueueItemId,
    commentBody: input.comment ?? "Resolved workqueue item",
    commentType: "resolution",
    userId: input.userId ?? null,
  });

  return { ok: true, workqueueItemId: input.workqueueItemId, status: "resolved", errors: [] };
}

export async function closeWorkqueueItem(input: WorkqueueActionInput): Promise<WorkqueueActionResult> {
  const supabase = createServerSupabaseAdminClient();
  if (!supabase) return baseError(input, "Database connection not available");

  const item = await loadWorkqueueItem(input.organizationId, input.workqueueItemId);
  if (!item) return baseError(input, "Workqueue item not found");

  const { error } = await supabase
    .from("workqueue_items")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by_user_id: input.userId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.workqueueItemId);

  if (error) return baseError(input, error.message);

  await addComment({
    organizationId: input.organizationId,
    workqueueItemId: input.workqueueItemId,
    commentBody: input.comment ?? "Closed workqueue item",
    commentType: "status_change",
    userId: input.userId ?? null,
  });

  return { ok: true, workqueueItemId: input.workqueueItemId, status: "closed", errors: [] };
}
