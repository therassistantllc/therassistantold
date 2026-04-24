"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function NewSession() {
  const router = useRouter();
  const [duration, setDuration] = useState(53);
  const [modality, setModality] = useState("telehealth");

  const suggestedCodes = useMemo(() => {
    const codes: string[] = [];

    if (duration >= 53) {
      codes.push("90837");
    } else if (duration >= 38) {
      codes.push("90834");
    }

    if (modality === "telehealth") {
      codes.push("Modifier 95");
    }

    return codes;
  }, [duration, modality]);

  function continueToSchedule() {
    const query = new URLSearchParams();
    query.set("suggested_codes", suggestedCodes.join(","));
    router.push(`/scheduling?${query.toString()}`);
  }

  return (
    <div className="mx-auto max-w-xl p-10">
      <h1 className="text-2xl font-bold">New Session</h1>
      <p className="mt-2 text-sm text-gray-600">
        Generate suggested billing codes, then continue in the schedule workflow.
      </p>

      <label className="mt-4 block text-sm font-medium text-gray-700">Duration (minutes)</label>
      <input
        type="number"
        value={duration}
        onChange={(e) => setDuration(Number(e.target.value))}
        className="mt-1 w-full rounded border p-2"
      />

      <label className="mt-3 block text-sm font-medium text-gray-700">Modality</label>
      <select
        value={modality}
        onChange={(e) => setModality(e.target.value)}
        className="mt-1 w-full rounded border p-2"
      >
        <option value="telehealth">Telehealth</option>
        <option value="in_person">In Person</option>
      </select>

      <div className="mt-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        Suggested codes: {suggestedCodes.length > 0 ? suggestedCodes.join(", ") : "None"}
      </div>

      <button
        type="button"
        onClick={continueToSchedule}
        className="mt-4 w-full rounded bg-black p-2 text-white"
      >
        Continue to Scheduling
      </button>
    </div>
  );
}
