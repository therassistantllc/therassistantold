"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DEFAULT_ORG_ID } from "@/lib/config";
import styles from "./mailroom.module.css";

type DocStatus = "needs_review" | "filed" | "attached" | "new";

interface MailroomDoc {
  id: string;
  fileName: string;
  mimeType: string;
  documentType: string;
  status: DocStatus;
  clientId?: string;
  clientName?: string;
  notes: string;
  createdAt: string;
  source: string;
}

interface Comment { id: string; author: string; text: string; date: string; }

const DOC_TYPE_LABELS: Record<string, string> = {
  payer_correspondence: "Payer Correspondence",
  eob: "EOB",
  prior_auth: "Prior Auth",
  clinical: "Clinical Document",
  intake: "Intake Form",
  consent: "Consent Form",
  insurance_card: "Insurance Card",
  id: "ID Document",
  other: "Other",
};

const DEMO_DOCS: MailroomDoc[] = [
  { id: "doc-1", fileName: "BCBS_ERA_2026-0234.pdf", mimeType: "application/pdf", documentType: "eob", status: "needs_review", clientName: "Avery Morgan", clientId: "cc100001-0000-0000-0000-000000000002", notes: "ERA received 05/19 — partial payment noted for 3 claims. Denial reason: CO-4.", createdAt: "2026-05-19T09:00:00Z", source: "clearinghouse" },
  { id: "doc-2", fileName: "Aetna_EOB_05-18.pdf", mimeType: "application/pdf", documentType: "eob", status: "filed", clientName: "Dana Patel", clientId: "cc100001-0000-0000-0000-000000000001", notes: "EOB for May 12 session. Payment posted.", createdAt: "2026-05-18T14:00:00Z", source: "clearinghouse" },
  { id: "doc-3", fileName: "SofiaM_intake_consent.pdf", mimeType: "application/pdf", documentType: "consent", status: "needs_review", clientName: "Sofia Martinez", clientId: "cc100001-0000-0000-0000-000000000003", notes: "", createdAt: "2026-05-17T10:30:00Z", source: "uploaded" },
  { id: "doc-4", fileName: "UHC_PriorAuth_MarcusT.pdf", mimeType: "application/pdf", documentType: "prior_auth", status: "attached", clientName: "Marcus Thompson", clientId: "cc100001-0000-0000-0000-000000000005", notes: "Prior auth approved for 20 sessions. Expires 12/31/2026.", createdAt: "2026-05-15T08:00:00Z", source: "fax" },
  { id: "doc-5", fileName: "ElenaR_InsuranceCard_front.jpg", mimeType: "image/jpeg", documentType: "insurance_card", status: "needs_review", clientName: "Elena Rodriguez", clientId: "cc100001-0000-0000-0000-000000000001", notes: "", createdAt: "2026-05-14T16:00:00Z", source: "uploaded" },
  { id: "doc-6", fileName: "Medicaid_denial_JamesR.pdf", mimeType: "application/pdf", documentType: "payer_correspondence", status: "needs_review", clientName: "James Rivera", clientId: "cc100001-0000-0000-0000-000000000004", notes: "Denial code: CO-97. See notes for appeal instructions.", createdAt: "2026-05-13T11:00:00Z", source: "clearinghouse" },
  { id: "doc-7", fileName: "BCBS_bulk_ERA_may2026.pdf", mimeType: "application/pdf", documentType: "eob", status: "new", notes: "Bulk ERA received. Not yet matched to claims.", createdAt: "2026-05-19T07:00:00Z", source: "clearinghouse" },
];

const DEMO_COMMENTS: Record<string, Comment[]> = {
  "doc-1": [{ id: "c1", author: "Lena Ortiz", text: "Reviewed — denial is for incorrect place of service. Correcting and resubmitting.", date: "05/19/2026 9:14 AM" }],
  "doc-2": [{ id: "c2", author: "Noah Kim", text: "EOB received. Payment posted to ledger. Remaining balance sent to patient.", date: "05/18/2026 2:30 PM" }],
};

function getOrg() {
  if (typeof window === "undefined") return DEFAULT_ORG_ID;
  return new URLSearchParams(window.location.search).get("organizationId") || process.env.NEXT_PUBLIC_ORGANIZATION_ID || DEFAULT_ORG_ID;
}

function fileExt(name: string): string {
  return name.split(".").pop()?.toUpperCase() ?? "FILE";
}

function iconClass(mime: string): string {
  if (mime.includes("pdf")) return styles.iconPdf;
  if (mime.includes("word") || mime.includes("document")) return styles.iconDoc;
  if (mime.includes("image")) return styles.iconImg;
  return styles.iconFile;
}

function statusClass(s: DocStatus): string {
  return { needs_review: styles.statusNeedsReview, filed: styles.statusFiled, attached: styles.statusAttached, new: styles.statusNew }[s] ?? styles.statusNeedsReview;
}

function statusLabel(s: DocStatus): string {
  return { needs_review: "Needs Review", filed: "Filed", attached: "Attached to Chart", new: "New" }[s] ?? s;
}

function fmtDate(v: string) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type FilterType = "all" | DocStatus;

export default function MailroomClient() {
  const orgId = useMemo(() => getOrg(), []);
  const [docs, setDocs] = useState<MailroomDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>(DEMO_COMMENTS);
  const [newComment, setNewComment] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/mailroom/items?organizationId=${encodeURIComponent(orgId)}&status=all&limit=50`);
        const json = await res.json() as { success?: boolean; items?: Array<Record<string, unknown>> };
        if (json.success && Array.isArray(json.items) && json.items.length > 0) {
          setDocs(json.items.map((item) => ({
            id: String(item.id ?? ""),
            fileName: String(item.fileName ?? item.file_name ?? "Untitled"),
            mimeType: String(item.mimeType ?? item.mime_type ?? "application/octet-stream"),
            documentType: String(item.documentType ?? item.document_type ?? "other"),
            status: (String(item.status ?? "needs_review")) as DocStatus,
            clientId: item.clientId ? String(item.clientId) : undefined,
            clientName: item.clientName ? String(item.clientName) : undefined,
            notes: String(item.notes ?? ""),
            createdAt: String(item.createdAt ?? item.created_at ?? ""),
            source: String(item.source ?? "uploaded"),
          })));
        } else {
          setDocs(DEMO_DOCS);
        }
      } catch {
        setDocs(DEMO_DOCS);
      }
      setLoading(false);
    }
    load();
  }, [orgId]);

  const filtered = useMemo(() => {
    let list = docs;
    if (filter !== "all") list = list.filter((d) => d.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d) =>
        d.fileName.toLowerCase().includes(q) ||
        (d.clientName ?? "").toLowerCase().includes(q) ||
        (DOC_TYPE_LABELS[d.documentType] ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [docs, filter, search]);

  const selected = useMemo(() => docs.find((d) => d.id === selectedId) ?? null, [docs, selectedId]);
  const selectedComments = useMemo(() => (selectedId ? (comments[selectedId] ?? []) : []), [comments, selectedId]);

  function addComment() {
    if (!selectedId || !newComment.trim()) return;
    const c: Comment = { id: `c-${Date.now()}`, author: "You", text: newComment.trim(), date: new Date().toLocaleString() };
    setComments((prev) => ({ ...prev, [selectedId]: [...(prev[selectedId] ?? []), c] }));
    setNewComment("");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) simulateUpload(files[0]);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) simulateUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function simulateUpload(file: File) {
    setUploading(true);
    setTimeout(() => {
      const newDoc: MailroomDoc = {
        id: `doc-upload-${Date.now()}`,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        documentType: "other",
        status: "new",
        notes: "",
        createdAt: new Date().toISOString(),
        source: "uploaded",
      };
      setDocs((prev) => [newDoc, ...prev]);
      setSelectedId(newDoc.id);
      setUploading(false);
    }, 800);
  }

  function markStatus(id: string, status: DocStatus) {
    setDocs((prev) => prev.map((d) => d.id === id ? { ...d, status } : d));
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <div className={styles.headerTitle}>Mailroom</div>
          <div className={styles.headerSub}>Document intake, review, and chart filing</div>
        </div>
        <div className={styles.headerSpacer} />
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          </span>
          <input className={styles.searchInput} placeholder="Search documents…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className={styles.filterRow}>
          {(["all", "new", "needs_review", "attached", "filed"] as FilterType[]).map((f) => (
            <button key={f} type="button" className={filter === f ? `${styles.filterChip} ${styles.filterChipActive}` : styles.filterChip} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "needs_review" ? "Needs Review" : statusLabel(f as DocStatus)}
            </button>
          ))}
        </div>
        <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={handleFileInput} accept="application/pdf,image/*,.doc,.docx" />
        <button type="button" className={styles.uploadBtn} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" /></svg>
          {uploading ? "Uploading…" : "Upload Document"}
        </button>
      </header>

      {/* Drop zone */}
      <div
        className={dragOver ? `${styles.dropZone} ${styles.dropZoneActive}` : styles.dropZone}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") fileInputRef.current?.click(); }}
        aria-label="Upload document"
      >
        <div className={styles.dropZoneIcon}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" /></svg>
        </div>
        <div className={styles.dropZoneText}>Drop documents here to upload</div>
        <div className={styles.dropZoneSub}>PDF, images, and Word documents supported</div>
      </div>

      {/* Body */}
      <div className={styles.body}>
        {/* Document list */}
        <div className={styles.docList}>
          <div className={styles.docListHeader}>
            <span className={styles.docListCount}>{filtered.length} document{filtered.length !== 1 ? "s" : ""}</span>
          </div>
          <div className={styles.docListScroll}>
            {loading ? (
              <div style={{ padding: "24px 16px", color: "#94A3B8", fontSize: 13 }}>Loading…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "24px 16px", color: "#94A3B8", fontSize: 13 }}>No documents found.</div>
            ) : filtered.map((doc) => (
              <div
                key={doc.id}
                className={`${styles.docRow} ${selectedId === doc.id ? styles.docRowSelected : ""}`}
                onClick={() => setSelectedId(doc.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") setSelectedId(doc.id); }}
              >
                <div className={`${styles.docIcon} ${iconClass(doc.mimeType)}`}>
                  {fileExt(doc.fileName)}
                </div>
                <div className={styles.docMeta}>
                  <div className={styles.docFileName}>{doc.fileName}</div>
                  <div className={styles.docSubRow}>
                    <span className={styles.docType}>{DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}</span>
                    {doc.clientName ? (
                      <><span style={{ color: "#E2E8F0" }}>·</span><span className={styles.docType}>{doc.clientName}</span></>
                    ) : null}
                    <span className={`${styles.docStatus} ${statusClass(doc.status)}`}>{statusLabel(doc.status)}</span>
                  </div>
                  <div className={styles.docDate}>{fmtDate(doc.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className={styles.detailPanel}>
          {selected ? (
            <div className={styles.detailScroll}>
              {/* Doc info */}
              <div className={styles.docCard}>
                <div className={styles.docCardHeader}>
                  <div className={styles.docCardTitle}>{selected.fileName}</div>
                  <span className={`${styles.docStatus} ${statusClass(selected.status)}`}>{statusLabel(selected.status)}</span>
                </div>
                <div className={styles.docCardMeta}>
                  <div className={styles.docCardField}>
                    <span className={styles.fieldLabel}>Document Type</span>
                    <span className={styles.fieldValue}>{DOC_TYPE_LABELS[selected.documentType] ?? selected.documentType}</span>
                  </div>
                  <div className={styles.docCardField}>
                    <span className={styles.fieldLabel}>Received</span>
                    <span className={styles.fieldValue}>{fmtDate(selected.createdAt)}</span>
                  </div>
                  <div className={styles.docCardField}>
                    <span className={styles.fieldLabel}>Source</span>
                    <span className={styles.fieldValue}>{selected.source}</span>
                  </div>
                  <div className={styles.docCardField}>
                    <span className={styles.fieldLabel}>Linked Client</span>
                    <span className={styles.fieldValue}>
                      {selected.clientId ? (
                        <Link href={`/clients/${selected.clientId}`} style={{ color: "#3B82F6", textDecoration: "none" }}>
                          {selected.clientName ?? selected.clientId}
                        </Link>
                      ) : "Not linked"}
                    </span>
                  </div>
                </div>
                {selected.notes ? (
                  <div style={{ marginTop: 12, padding: "10px 12px", background: "#F8FAFC", borderRadius: 8, fontSize: 12.5, color: "#475569", lineHeight: 1.5 }}>
                    {selected.notes}
                  </div>
                ) : null}
              </div>

              {/* Preview */}
              <div className={styles.previewArea}>
                <div className={styles.previewHeader}>
                  <span className={styles.previewTitle}>Document Preview</span>
                </div>
                <div className={styles.previewPlaceholder}>
                  <div className={styles.previewIcon}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  </div>
                  <div className={styles.previewPlaceholderText}>{selected.fileName}</div>
                  <button type="button" className={styles.previewBtn}>Open Full Document</button>
                </div>
              </div>

              {/* Comments */}
              <div className={styles.commentSection}>
                <div className={styles.commentHeader}>Comments &amp; Notes</div>
                {selectedComments.length > 0 ? (
                  <div className={styles.commentList}>
                    {selectedComments.map((c) => (
                      <div key={c.id} className={styles.comment}>
                        <div className={styles.commentMeta}>{c.author} · {c.date}</div>
                        <div className={styles.commentText}>{c.text}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: "12px 16px", color: "#94A3B8", fontSize: 13 }}>No comments yet.</div>
                )}
                <div className={styles.commentForm}>
                  <input
                    className={styles.commentInput}
                    placeholder="Add a comment or note…"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addComment(); }}
                  />
                  <button type="button" className={styles.commentSubmit} onClick={addComment}>Add</button>
                </div>
              </div>

              {/* Attach / File Actions */}
              <div className={styles.attachSection}>
                <div className={styles.attachHeader}>File or Attach</div>
                <div className={styles.attachActions}>
                  {selected.clientId ? (
                    <Link className={`${styles.attachBtn} ${styles.attachBtnPrimary}`} href={`/clients/${selected.clientId}/documents`}>
                      Attach to Chart
                    </Link>
                  ) : (
                    <button type="button" className={`${styles.attachBtn} ${styles.attachBtnPrimary}`}>Link to Patient Chart</button>
                  )}
                  <button type="button" className={styles.attachBtn}>File to Provider Profile</button>
                  <button type="button" className={styles.attachBtn}>File to Practice</button>
                  <button type="button" className={`${styles.attachBtn} ${styles.markFiledBtn}`} onClick={() => markStatus(selected.id, "filed")}>
                    Mark as Filed
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.detailEmpty}>
              <div className={styles.detailEmptyIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              </div>
              <div className={styles.detailEmptyText}>Select a document to review, comment, and file</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
