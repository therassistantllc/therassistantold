import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAuthenticatedStaff } from "@/lib/rbac/auth";
import { loadAuthForProvider, markConnectionNeedsReconnect } from "@/lib/telehealth/connections";
import { pickAdapter } from "@/lib/telehealth/adapters";
import { isTelehealthPlatform, type TelehealthPlatform } from "@/lib/telehealth/config";

function durationMinutes(start: string, end: string | null): number {
  if (!end) return 50;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 50;
  return Math.max(15, Math.round(ms / 60000));
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ctx = await requireAuthenticatedStaff();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id: appointmentId } = await context.params;
  if (!appointmentId) {
    return NextResponse.json({ error: "appointmentId required" }, { status: 400 });
  }

  const supabase = createServerSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "Database unavailable" }, { status: 500 });

  const { data: appt, error: apptErr } = await supabase
    .from("appointments")
    .select(
      "id, organization_id, provider_id, scheduled_start_at, scheduled_end_at, appointment_type, telehealth_url, service_location",
    )
    .eq("id", appointmentId)
    .maybeSingle();
  if (apptErr) return NextResponse.json({ error: apptErr.message }, { status: 500 });
  if (!appt) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  if (appt.organization_id !== ctx.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: existing } = await supabase
    .from("telehealth_sessions")
    .select("id, meeting_url, host_url, telehealth_vendor, session_status")
    .eq("appointment_id", appointmentId)
    .eq("organization_id", ctx.organizationId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Resolve provider->auth_user_id mapping early so we can authorize host_url access.
  let providerAuthUserIdEarly: string | null = null;
  if (appt.provider_id) {
    const { data: pcp } = await supabase
      .from("provider_credentialing_profiles")
      .select("staff_id")
      .eq("organization_id", ctx.organizationId)
      .eq("id", appt.provider_id)
      .maybeSingle();
    const sid = (pcp as any)?.staff_id as string | null | undefined;
    if (sid) {
      const { data: staff } = await supabase
        .from("staff_profiles")
        .select("auth_user_id")
        .eq("id", sid)
        .maybeSingle();
      providerAuthUserIdEarly = (staff as any)?.auth_user_id ?? null;
    }
  }
  const callerIsProvider = providerAuthUserIdEarly !== null && providerAuthUserIdEarly === ctx.userId;

  if (existing?.meeting_url) {
    return NextResponse.json({
      success: true,
      source: "existing_session",
      sessionId: existing.id,
      platform: existing.telehealth_vendor,
      joinUrl: existing.meeting_url,
      // Host URL is privileged. Only the provider whose account hosts the
      // meeting may receive it; other staff get the join URL only.
      hostUrl: callerIsProvider ? existing.host_url ?? null : null,
    });
  }

  let platform: TelehealthPlatform | null = null;
  let providerLegacyUrl: string | null = null;
  let providerStaffId: string | null = null;
  if (appt.provider_id) {
    const { data: profile } = await supabase
      .from("provider_credentialing_profiles")
      .select("id, default_telehealth_platform, telehealth_url, staff_id")
      .eq("organization_id", ctx.organizationId)
      .eq("id", appt.provider_id)
      .maybeSingle();
    const dp = (profile as any)?.default_telehealth_platform as string | null | undefined;
    if (dp && isTelehealthPlatform(dp)) platform = dp;
    providerLegacyUrl = (profile as any)?.telehealth_url ?? null;
    providerStaffId = (profile as any)?.staff_id ?? null;
  }

  const providerAuthUserId = providerAuthUserIdEarly ?? null;
  void providerStaffId;
  const ownerUserIdForAuth = providerAuthUserId ?? ctx.userId;

  if (!platform) {
    const fallbackUrl = appt.telehealth_url ?? providerLegacyUrl ?? null;
    if (fallbackUrl) {
      return NextResponse.json({
        success: true,
        source: "legacy_static_url",
        platform: null,
        joinUrl: fallbackUrl,
        hostUrl: null,
        warning:
          "No default telehealth platform set for this provider. Using the legacy static telehealth URL. Connect Zoom or Google Meet in Settings → Providers to enable per-meeting links.",
      });
    }
    return NextResponse.json(
      {
        error: "No telehealth platform configured for this provider and no fallback URL set.",
        hint: "Set a default platform on the provider in Settings → Providers, or configure a Telehealth URL.",
      },
      { status: 409 },
    );
  }

  const auth = await loadAuthForProvider(supabase as any, {
    organizationId: ctx.organizationId,
    ownerUserId: ownerUserIdForAuth,
    platform,
  });
  if (!auth) {
    const fallbackUrl = appt.telehealth_url ?? providerLegacyUrl ?? null;
    const providerScopeNote = providerAuthUserId
      ? `The appointment's provider has not connected ${platform}.`
      : `${platform} connection lookup falls back to the current user because the appointment's provider has no linked staff account.`;
    if (fallbackUrl) {
      return NextResponse.json({
        success: true,
        source: "legacy_static_url",
        platform,
        joinUrl: fallbackUrl,
        hostUrl: null,
        warning: `${providerScopeNote} Using the legacy static URL. Connect in Settings → Providers to auto-create meetings.`,
      });
    }
    return NextResponse.json(
      {
        error: providerScopeNote,
        platform,
        requiresConnect: true,
      },
      { status: 409 },
    );
  }

  const adapter = pickAdapter(platform);
  let created;
  try {
    created = await adapter.createMeeting(auth, {
      topic: appt.appointment_type ?? "Telehealth visit",
      startAt: appt.scheduled_start_at,
      durationMinutes: durationMinutes(appt.scheduled_start_at, appt.scheduled_end_at),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Meeting creation failed";
    // Treat 401/invalid_grant style errors as a credential failure and prompt reconnect.
    if (/401|unauthor|invalid[_ ]grant|expired|revoked/i.test(msg)) {
      await markConnectionNeedsReconnect(supabase as any, {
        organizationId: ctx.organizationId,
        ownerUserId: ownerUserIdForAuth,
        platform,
        error: msg.slice(0, 500),
      });
      return NextResponse.json(
        { error: `${platform} credentials are no longer valid. Please reconnect in Settings → Providers.`, platform, requiresConnect: true },
        { status: 401 },
      );
    }
    return NextResponse.json({ error: msg, platform }, { status: 502 });
  }

  const sessionRow: Record<string, unknown> = {
    organization_id: ctx.organizationId,
    appointment_id: appointmentId,
    provider_id: appt.provider_id,
    scheduled_start_at: appt.scheduled_start_at,
    telehealth_vendor: platform,
    meeting_url: created.joinUrl,
    host_url: created.hostUrl,
    session_status: "scheduled",
    external_meeting_id: created.externalMeetingId ?? null,
  };
  let sessionInsert = await supabase
    .from("telehealth_sessions")
    .insert(sessionRow as any)
    .select("id")
    .single();
  if (sessionInsert.error) {
    const code = (sessionInsert.error as { code?: string }).code ?? "";
    const msg = String(sessionInsert.error.message ?? "");
    if (code === "42703" && /external_meeting_id/i.test(msg)) {
      // Migration not yet applied — retry without the new column.
      const { external_meeting_id: _drop, ...legacyRow } = sessionRow as Record<string, unknown>;
      void _drop;
      sessionInsert = await supabase
        .from("telehealth_sessions")
        .insert(legacyRow as any)
        .select("id")
        .single();
    }
  }
  if (sessionInsert.error) {
    console.error("[telehealth/join] failed to persist session", sessionInsert.error);
  }

  return NextResponse.json({
    success: true,
    source: "created",
    sessionId: sessionInsert.data?.id ?? null,
    platform,
    externalMeetingId: created.externalMeetingId,
    joinUrl: created.joinUrl,
    // Host URL is privileged — only the provider gets it.
    hostUrl: callerIsProvider ? created.hostUrl : null,
  });
}
