import ClientWorkspaceNav from "@/components/layout/ClientWorkspaceNav";
import styles from "@/components/layout/ClientWorkspaceNav.module.css";
import PatientBalanceClient from "./PatientBalanceClient";

export default async function PatientBalancePage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;

  return (
    <div className={styles.workspace}>
      <ClientWorkspaceNav clientId={clientId} />
      <div className={styles.content}>
        <main className="app-shell">
          <PatientBalanceClient clientId={clientId} />
        </main>
      </div>
    </div>
  );
}
