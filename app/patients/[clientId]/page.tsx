import PatientChartClient from "./PatientChartClient";

export default async function PatientChartPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;

  return (
    <main className="app-shell">
      <PatientChartClient clientId={clientId} />
    </main>
  );
}
