"use client";

import { useState } from "react";

export default function NewSession() {
  const [duration, setDuration] = useState(53);
  const [modality, setModality] = useState("telehealth");

  function generate() {
    let codes = [];

    if (duration >= 53) {
      codes.push("90837");
    } else if (duration >= 38) {
      codes.push("90834");
    }

    if (modality === "telehealth") {
      codes.push("Modifier 95");
    }

    // 👉 THIS is the redirect we wanted
    window.location.href = "/sessions/1/coding";
  }

  return (
    <div className="p-10 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold">New Session</h1>

      <input
        type="number"
        value={duration}
        onChange={(e) => setDuration(Number(e.target.value))}
        className="border p-2 mt-4 w-full"
      />

      <select
        value={modality}
        onChange={(e) => setModality(e.target.value)}
        className="border p-2 mt-2 w-full"
      >
        <option value="telehealth">Telehealth</option>
        <option value="in_person">In Person</option>
      </select>

      <button
        onClick={generate}
        className="bg-black text-white p-2 mt-4 w-full"
      >
        Generate Codes
      </button>
    </div>
  );
}