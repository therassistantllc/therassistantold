import ClientWorkspaceNav from "@/components/layout/ClientWorkspaceNav";
import styles from "@/components/layout/ClientWorkspaceNav.module.css";
import PatientChartClient from "./PatientChartClient";

export default async function PatientChartPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;

  return (
    <div className={styles.workspace}>
      <ClientWorkspaceNav clientId={clientId} />
      <div className={styles.content}>
        <main className="app-shell">
          <PatientChartClient clientId={clientId} />
        </main>
      </div>
    </div>
  );
}
