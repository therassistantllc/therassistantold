"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type MailroomItem = {
  id: string;
  clientId: string;
  fileName: string;
  fileType: string;
  status: string;
  documentCategory: string;
  source: string;
  description: string;
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
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState<MailroomItem[]>([]);
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("application/pdf");
  const [clientId, setClientId] = useState("");
  const [documentCategory, setDocumentCategory] = useState("payer_correspondence");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
    const response = await fetch("/api/mailroom/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        fileName,
        fileType,
        clientId: clientId || null,
        documentCategory,
        description,
        source: "manual_upload",
      }),
    });
    const json = (await response.json()) as { success?: boolean; error?: string; mailroomItemId?: string };
    if (!response.ok || !json.success) {
      setError(json.error || "Unable to create mailroom item.");
    } else {
      setMessage("Mailroom item created and routed to workqueue.");
      setFileName("");
      setClientId("");
      setDescription("");
      await loadItems();
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
          <Link className="button button-secondary" href="/workqueue">Workqueue</Link>
          <Link className="button button-secondary" href="/clinician/agenda">Agenda</Link>
        </div>
      </section>

      {error ? <div className="alert-panel">{error}</div> : null}
      {message ? <div className="empty-state success-panel">{message}</div> : null}

      <section className="two-column-panel">
        <div className="panel form-panel">
          <h2>Add mailroom item</h2>
          <label className="field-label">
            File name
            <input value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder="paper-eob.pdf" />
          </label>
          <label className="field-label">
            File type
            <select value={fileType} onChange={(event) => setFileType(event.target.value)}>
              <option value="application/pdf">PDF</option>
              <option value="image/jpeg">JPEG image</option>
              <option value="image/png">PNG image</option>
              <option value="text/plain">Text</option>
            </select>
          </label>
          <label className="field-label">
            Optional patient/client ID
            <input value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder="client UUID if known" />
          </label>
          <label className="field-label">
            Category
            <select value={documentCategory} onChange={(event) => setDocumentCategory(event.target.value)}>
              <option value="payer_correspondence">Payer correspondence</option>
              <option value="paper_eob">Paper EOB</option>
              <option value="refund_request">Refund request</option>
              <option value="medical_record_request">Medical record request</option>
              <option value="credentialing_notice">Credentialing notice</option>
              <option value="practice_document">Practice document</option>
            </select>
          </label>
          <label className="field-label">
            Description
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what billing/admin needs to review..." />
          </label>
          <button className="button" type="button" onClick={submit} disabled={saving || !fileName.trim()}>
            {saving ? "Routing…" : "Create Mailroom Item"}
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
                <option value="pending">Pending</option>
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
                    <span>{item.documentCategory || "document"} · {item.status || "pending"}</span>
                    <span>{item.description || "No description"}</span>
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                  {item.clientId ? <Link className="button button-secondary" href={`/patients/${item.clientId}`}>Patient Chart</Link> : null}
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
