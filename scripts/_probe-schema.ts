import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
async function main() {
  // Get client_contacts columns via a broken insert (FK error reveals accepted fields)
  const { error: ccInsErr } = await sb.from("client_contacts").insert({
    organization_id: "11111111-1111-1111-1111-111111111111",
    client_id: "00000000-0000-0000-0000-000000000099",
    first_name: "X", last_name: "Y",
    contact_type: "emergency", relationship: "spouse",
    phone: "555-0000",
  }).select("id").single();
  console.log("client_contacts insert result:", JSON.stringify({ code: ccInsErr?.code, msg: ccInsErr?.message }));
}
main().catch(e => { console.error(e); process.exit(1); });

