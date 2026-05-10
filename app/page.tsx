// File: app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>THERASSISTANT EHR Workflow Validation Build</h1>
      <p>
        The feature UI is intentionally removed while backend workflows are validated.
      </p>
      <ul>
        <li>
          <Link href="/health">/health</Link>
        </li>
        <li>
          <Link href="/workflow-status">/workflow-status</Link>
        </li>
      </ul>
    </main>
  );
}
