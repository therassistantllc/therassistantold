"use client";

import { useParams } from "next/navigation";
import ClassicPatientChartResolved from "@/components/patient-chart/ClassicPatientChartResolved";

interface Message {
  id: string;
  patient_id?: string | null;
  sender_type?: string | null;
  sender_id?: string | null;
  subject?: string | null;
  body?: string | null;
  is_read?: boolean;
  created_at?: string;
}

interface Patient {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  mrn?: string | null;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function PatientMessagesPage() {
  const params = useParams();
  const patientId = params.id as string;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError(null);

      // Load patient
      const { data: patientData, error: patientError } = await supabase
        .from("clients")
        .select("id, first_name, last_name, mrn")
        .eq("id", patientId)
        .single();

      if (!active) return;

      if (patientError) {
        setError(patientError.message);
        setLoading(false);
        return;
      }

      setPatient(patientData as Patient);

      // Load messages
      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .eq("patient_id", patientId)
        .is("archived_at", null)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (messagesError) {
        console.error("Error loading messages:", messagesError);
        setMessages([]);
      } else {
        setMessages((messagesData ?? []) as Message[]);
      }

      setLoading(false);
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [patientId]);

  const filteredMessages = messages.filter((msg) => {
    if (filter === "unread") return !msg.is_read;
    return true;
  });

  const unreadCount = messages.filter((m) => !m.is_read).length;

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-5xl px-6 py-8">
          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
              Loading messages...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
              Error loading messages: {error}
            </div>
          ) : !patient ? (
            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6 text-sm text-yellow-700 shadow-sm">
              Patient not found.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Messages: {[patient.first_name, patient.last_name].filter(Boolean).join(" ")}
                  </h1>
                  {patient.mrn && <p className="mt-1 text-sm text-gray-600">MRN: {patient.mrn}</p>}
                </div>
                <Link
                  href={`/patients/${patientId}`}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Back to Chart
                </Link>
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={[
                    "rounded-lg px-4 py-2 text-sm font-medium",
                    filter === "all"
                      ? "bg-blue-600 text-white"
                      : "border border-gray-300 text-gray-700 hover:bg-gray-50",
                  ].join(" ")}
                >
                  All Messages ({messages.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("unread")}
                  className={[
                    "rounded-lg px-4 py-2 text-sm font-medium",
                    filter === "unread"
                      ? "bg-blue-600 text-white"
                      : "border border-gray-300 text-gray-700 hover:bg-gray-50",
                  ].join(" ")}
                >
                  Unread ({unreadCount})
                </button>
                <button
                  type="button"
                  className="ml-auto rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  disabled
                >
                  New Message
                </button>
              </div>

              <div className="space-y-3">
                {filteredMessages.length === 0 ? (
                  <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
                    {filter === "unread" ? "No unread messages." : "No messages found."}
                  </div>
                ) : (
                  filteredMessages.map((message) => (
                    <div
                      key={message.id}
                      className={[
                        "rounded-2xl border p-6 shadow-sm",
                        message.is_read
                          ? "border-gray-200 bg-white"
                          : "border-blue-200 bg-blue-50",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {!message.is_read && (
                              <span className="inline-block h-2 w-2 rounded-full bg-blue-600" />
                            )}
                            <h3 className="text-base font-semibold text-gray-900">
                              {message.subject || "(No Subject)"}
                            </h3>
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            <span className="capitalize">{message.sender_type || "Unknown"}</span> •{" "}
                            {formatDateTime(message.created_at)}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="text-sm text-blue-600 hover:underline"
                          disabled
                        >
                          {message.is_read ? "Mark Unread" : "Mark Read"}
                        </button>
                      </div>
                      {message.body && (
                        <div className="mt-4 whitespace-pre-wrap text-sm text-gray-700">
                          {message.body}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
