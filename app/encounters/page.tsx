import Link from "next/link";

export default function EncountersPage() {
  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Clinical</p>
          <h1>Encounters</h1>
          <p className="hero-copy">Open an encounter from the Clinician Agenda, or start a new encounter directly.</p>
        </div>
        <div className="hero-actions">
          <Link className="button" href="/encounters/new">
            New Encounter
          </Link>
          <Link className="button button-secondary" href="/clinician/agenda">
            Clinician Agenda
          </Link>
        </div>
      </section>

      <section className="panel">
        <p style={{ color: "var(--text-secondary)" }}>
          Encounters are initiated from the Clinician Agenda. Select an appointment to open an existing encounter, or use the button above to create a new one.
        </p>
      </section>
    </main>
  );
}
