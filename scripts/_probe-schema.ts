import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
async function main() {
  const { data: cc, error: ccErr } = await sb.from("client_contacts").select("*").limit(1);
  console.log("client_contacts columns:", JSON.stringify(Object.keys(cc?.[0] ?? {})));
  if (ccErr) console.log("client_contacts error:", ccErr.message);

  const { data: enc } = await sb.from("encounters").select("encounter_status").limit(5);
  console.log("encounter statuses in DB:", JSON.stringify(enc?.map((e: Record<string,unknown>) => e.encounter_status)));

  const { error: erErr } = await sb.from("eligibility_requests").select("id, appointment_id").limit(1);
  console.log("eligibility_requests.appointment_id:", erErr ? erErr.code + ": " + erErr.message : "exists");
}
main().catch(e => { console.error(e); process.exit(1); });
