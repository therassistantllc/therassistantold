import Link from "next/link";

export default function Home() {
  return (
    <main className="p-10 max-w-5xl mx-auto">
      <h1 className="text-4xl font-bold">THERASSISTANT</h1>

      <p className="mt-4 text-lg text-gray-600">
        Revenue capture, coding guidance, and SOAP note generation for clinicians.
      </p>

      <div className="mt-8 flex gap-4">
        <Link href="/sessions/new">
          <button className="bg-black text-white px-6 py-3 rounded">
            Start New Session
          </button>
        </Link>
      </div>
    </main>
  );
}