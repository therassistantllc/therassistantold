"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type MailroomItem = {
  id: string;
  clientId: string;
  fileName: string;
  mimeType: string;
  status: string;
  documentType: string;
  source: string;
  notes: string;
  createdAt: string;
};

type MailroomResponse = { success?: boolean; items?: MailroomItem[]; error?: string };

function getOrganizationId() {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_ORGANIZATION_ID || "";
  return new URLSearchParams(window.location.search).get("organizationId") || process.env.NEXT_PUBLIC_ORGANIZATION_ID || "";
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function MailroomClient() {
  const organizationId = useMemo(() => getOrganizationId(), []);
  const [status, setStatus] = useState("needs_review");
  const [items, setItems] = useState<MailroomItem[]>([]);
  const [clientId, setClientId] = useState("");
  const [documentType, setDocumentType] = useState("payer_correspondence");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function loadItems() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/mailroom/items?organizationId=${encodeURIComponent(organizationId)}&status=${encodeURIComponent(status)}`);
    const json = (await response.json()) as MailroomResponse;
    if (!response.ok || !json.success) {
      setError(json.error || "Unable to load mailroom.");
      setItems([]);
    } else {
      setItems(json.items || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (organizationId) void loadItems();
    else {
      setError("Missing organizationId.");
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, status]);

  async function submit() {
    setSaving(true);
    setError(null);
    setMessage(null);

    if (!selectedFile) {
      setError("Please select a file to upload.");
      setSaving(false);
      return;
    }

    const formData = new FormData();
    formData.append("organizationId", organizationId);
    formData.append("file", selectedFile);
    formData.append("fileName", selectedFile.name);
    formData.append("mimeType", selectedFile.type || "application/octet-stream");
    formData.append("clientId", clientId || "");
    formData.append("documentType", documentType);
    formData.append("notes", notes);

    try {
      const response = await fetch("/api/mailroom/upload", {
        method: "POST",
        body: formData,
      });
      const json = (await response.json()) as { success?: boolean; error?: string; mailroomItemId?: string };
      if (!response.ok || !json.success) {
        setError(json.error || "Unable to create mailroom item.");
      } else {
        setMessage("Mailroom item created and routed to workqueue.");
        setSelectedFile(null);
        setClientId("");
        setNotes("");
        await loadItems();
      }
    } catch (err) {
      setError((err instanceof Error) ? err.message : "Upload failed");
    }
    setSaving(false);
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Mailroom</p>
          <h1>Route payer mail and scanned documents</h1>
          <p className="hero-copy">Capture paper EOBs, refund requests, payer letters, and other correspondence into billing/admin review.</p>
        </div>
        <div className="hero-actions">
          <a className="button" href="#mailroom-upload">Upload Document</a>
          <Link className="button button-secondary" href="/billing/workqueue">Workqueue</Link>
          <Link className="button button-secondary" href="/clinician/agenda">Agenda</Link>
        </div>
      </section>

      {error ? <div className="alert-panel">{error}</div> : null}
      {message ? <div className="empty-state success-panel">{message}</div> : null}

      <section className="two-column-panel">
        <div className="panel form-panel" id="mailroom-upload">
          <h2>Add mailroom item</h2>
          <label className="field-label">
            Select file to upload
            <input 
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setSelectedFile(file);
                }
              }}
              accept=".pdf,.jpg,.jpeg,.png,.txt,.doc,.docx"
              disabled={saving}
            />
          </label>
          {selectedFile && (
            <div className="field-label">
              <small>File: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</small>
            </div>
          )}
          <label className="field-label">
            Optional patient/client ID
            <input value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder="client UUID if known" />
          </label>
          <label className="field-label">
            Category
            <select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
              <option value="payer_correspondence">Payer correspondence</option>
              <option value="paper_eob">Paper EOB</option>
              <option value="refund_request">Refund request</option>
              <option value="medical_record_request">Medical record request</option>
              <option value="credentialing_notice">Credentialing notice</option>
              <option value="practice_document">Practice document</option>
            </select>
          </label>
          <label className="field-label">
            Notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Describe what billing/admin needs to review..." />
          </label>
          <button className="button" type="button" onClick={() => void submit()} disabled={saving || !selectedFile}>
            {saving ? "Uploading…" : "Upload Document"}
          </button>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Mailroom queue</h2>
              <p>Items routed for filing or billing/admin review.</p>
            </div>
            <label className="field-label compact-field">
              Status
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="needs_review">Needs Review</option>
                <option value="filed">Filed</option>
                <option value="all">All</option>
              </select>
            </label>
          </div>
          {loading ? <div className="empty-state">Loading mailroom…</div> : null}
          <div className="stack-list">
            {items.map((item) => (
              <div className="stack-item" key={item.id}>
                <div className="stack-row">
                  <div>
                    <strong>{item.fileName || "Mailroom document"}</strong>
                    <span>{item.documentType || "document"} · {item.status || "needs_review"}</span>
                    <span>{item.notes || "No notes"}</span>
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                  {item.clientId ? <Link className="button button-secondary" href={`/clients/${item.clientId}`}>Client Chart</Link> : null}
                </div>
              </div>
            ))}
            {items.length === 0 && !loading ? <div className="empty-state">No mailroom items found.</div> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
