// @ts-expect-error - Deno edge runtime URL import is valid at runtime but not resolvable by this TS config.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const MICROSOFT_CLIENT_ID = Deno.env.get("MICROSOFT_CLIENT_ID")!;
const MICROSOFT_TENANT_ID = Deno.env.get("MICROSOFT_TENANT_ID") || "common";
const APP_BASE_URL = Deno.env.get("APP_BASE_URL")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

serve(async (req: Request) => {
  const url = new URL(req.url);
  const organizationId = url.searchParams.get("organization_id");

  if (!organizationId) {
    return new Response("Missing organization_id", { status: 400 });
  }

  const redirectUri = `${SUPABASE_URL}/functions/v1/outlook-oauth-callback`;

  const state = btoa(
    JSON.stringify({
      organization_id: organizationId,
      return_to: `${APP_BASE_URL}/settings/integrations/outlook`,
    }),
  );

  const oauthUrl = new URL(
    `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`,
  );
  oauthUrl.searchParams.set("client_id", MICROSOFT_CLIENT_ID);
  oauthUrl.searchParams.set("redirect_uri", redirectUri);
  oauthUrl.searchParams.set("response_type", "code");
  oauthUrl.searchParams.set("response_mode", "query");
  oauthUrl.searchParams.set("prompt", "consent");
  oauthUrl.searchParams.set(
    "scope",
    [
      "openid",
      "email",
      "profile",
      "offline_access",
      "User.Read",
      "Mail.ReadWrite",
      "Mail.Send",
    ].join(" "),
  );
  oauthUrl.searchParams.set("state", state);

  return Response.redirect(oauthUrl.toString(), 302);
});
