import Link from "next/link";

const demoAgenda = [
  {
    time: "9:00 AM",
    client: "Client A",
    dob: "03/14/1991",
    visitType: "Telehealth psychotherapy",
    checkIn: "Checked in",
    eligibility: "Active",
    balance: "$25.00",
    payer: "Aetna",
  },
  {
    time: "10:00 AM",
    client: "Client B",
    dob: "07/22/1988",
    visitType: "Office visit",
    checkIn: "Not submitted",
    eligibility: "Not checked",
    balance: "$0.00",
    payer: "Colorado Medicaid",
  },
  {
    time: "11:30 AM",
    client: "Client C",
    dob: "11/02/1979",
    visitType: "Telehealth follow-up",
    checkIn: "Checked in",
    eligibility: "Inactive",
    balance: "$110.00",
    payer: "UnitedHealthcare",
  },
];

function statusClass(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("active") && !normalized.includes("inactive")) return "status status-green";
  if (normalized.includes("checked in")) return "status status-green";
  if (normalized.includes("inactive") || normalized.includes("not checked")) return "status status-red";
  if (normalized.includes("not submitted")) return "status status-yellow";
  return "status";
}

export default function ClinicianAgendaPage() {
  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Clinician Workspace</p>
          <h1>Today’s Agenda</h1>
          <p className="hero-copy">
            A clean visit-focused view for clinicians: schedule, check-in, eligibility, balance, and routing support.
            Billing logic stays behind the scenes.
          </p>
        </div>
        <div className="hero-actions">
          <Link className="button button-secondary" href="/">Home</Link>
          <Link className="button" href="/clinician/agenda">Refresh</Link>
        </div>
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <span>Appointments</span>
          <strong>3</strong>
        </article>
        <article className="metric-card">
          <span>Checked In</span>
          <strong>2</strong>
        </article>
        <article className="metric-card">
          <span>Eligibility Issues</span>
          <strong>2</strong>
        </article>
        <article className="metric-card">
          <span>Balances to Review</span>
          <strong>2</strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Appointment List</h2>
            <p>Practical visit context only. No coding prompts or documentation interruptions.</p>
          </div>
        </div>

        <div className="agenda-list">
          {demoAgenda.map((item) => (
            <article className="agenda-card" key={`${item.time}-${item.client}`}>
              <div className="agenda-time">
                <strong>{item.time}</strong>
                <span>{item.visitType}</span>
              </div>

              <div className="agenda-main">
                <h3>{item.client}</h3>
                <p>DOB: {item.dob}</p>
                <p>Payer: {item.payer}</p>
                <div className="status-row">
                  <span className={statusClass(item.checkIn)}>{item.checkIn}</span>
                  <span className={statusClass(item.eligibility)}>{item.eligibility}</span>
                  <span className="status">Balance {item.balance}</span>
                </div>
              </div>

              <div className="agenda-actions">
                <button type="button" className="button button-secondary">Open Chart</button>
                <button type="button" className="button button-secondary">Open Note</button>
                <button type="button" className="button button-secondary">Collect</button>
                <button type="button" className="button">Route to Biller</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
