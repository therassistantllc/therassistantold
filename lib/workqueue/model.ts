import type { WorkqueueItem, WorkqueueType } from "@/lib/canonical-ehr/types";

export function filterWorkqueueItems(items: WorkqueueItem[], queueType: WorkqueueType | "all") {
  return queueType === "all" ? items : items.filter((item) => item.queue_type === queueType);
}

export function isOpenWorkqueueItem(item: WorkqueueItem) {
  return item.status === "open" || item.status === "in_progress" || item.status === "deferred";
}
