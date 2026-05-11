// File: app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">THERASSISTANT EHR</p>
          <h1>Clinician-first workspace</h1>
          <p className="hero-copy">
            Start with the clinician’s day: appointments, chart access, check-in visibility, eligibility, balance, and simple routing support.
          </p>
        </div>
        <div className="hero-actions">
          <Link className="button" href="/clinician/agenda">Open Agenda</Link>
          <Link className="button button-secondary" href="/workflow-status">Workflow Status</Link>
        </div>
      </section>

      <section className="panel two-column-panel">
        <div>
          <h2>Clinician flow</h2>
          <p>
            The clinician UI stays focused on care delivery. Coding and billing review stay behind the scenes unless a practical visit issue needs attention.
          </p>
        </div>
        <div className="feature-list">
          <span>Agenda</span>
          <span>Patient chart</span>
          <span>Check-in review</span>
          <span>Eligibility snapshot</span>
          <span>Balance visibility</span>
          <span>Route to biller</span>
        </div>
      </section>
    </main>
  );
}
