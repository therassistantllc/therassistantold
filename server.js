// File: server.js
require("dotenv").config();

const cors = require("cors");
const express = require("express");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
const path = require("path");
const fs = require("fs");
const ts = require("typescript");

require.extensions[".ts"] = function registerTs(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(outputText, filename);
};

const { createSupabaseRepositories } = require("./backend/src/repositories/supabase/index.ts");
const {
  createScheduleService,
  createEncounterService,
  createClaimService,
  createWorkqueueService,
  createBillingService,
} = require("./backend/src/services/factories.ts");
const { createApiRouter } = require("./backend/src/routes/index.ts");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DEV_BYPASS_AUTH = process.env.DEV_BYPASS_AUTH === "true";

const FRONTEND_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
];

const ALL_ROLES = [
  "super_admin",
  "admin",
  "clinician",
  "billing_specialist",
  "credentialing_specialist",
  "supervisor",
  "front_desk",
  "patient",
];

const ADMIN_ROLES_SERVER = [
  "admin",
  "billing_specialist",
  "billing_staff",
  "credentialing_specialist",
  "supervisor",
  "front_desk",
  "super_admin",
];

const ALLOWED_AUDIT_EVENTS = [
  "login",
  "logout",
  "mfa_enrolled",
  "mfa_verified",
  "preview_start",
  "preview_end",
  "stripe_connect",
  "stripe_disconnect",
  "password_reset",
  "role_changed",
];

const DEV_USER = {
  id: "dev-user-001",
  email: "dev@therassistant.local",
  user_metadata: {
    role: "super_admin",
    org_id: "org-demo",
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || FRONTEND_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (_req, res) => {
  res.redirect("/app/admin-dashboard.html");
});

app.get("/admin", (_req, res) => {
  res.redirect("/app/admin-login.html");
});

function getBearerToken(req) {
  const auth = req.headers.authorization || "";
  return auth.replace(/^Bearer\s+/i, "").trim();
}

function clientIp(req) {
  return (
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket.remoteAddress ||
    null
  );
}

async function getAuthenticatedUserFromRequest(req) {
  if (DEV_BYPASS_AUTH) {
    return { errorStatus: null, error: null, user: DEV_USER };
  }

  const token = getBearerToken(req);
  if (!token) {
    return { errorStatus: 401, error: "Unauthorized", user: null };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { errorStatus: 401, error: "Invalid session", user: null };
  }

  return { errorStatus: null, error: null, user };
}

async function requireAdminRole(req, res) {
  const authResult = await getAuthenticatedUserFromRequest(req);

  if (authResult.error) {
    res.status(authResult.errorStatus).json({ error: authResult.error });
    return null;
  }

  const role = authResult.user.user_metadata?.role || "clinician";
  if (!ADMIN_ROLES_SERVER.includes(role)) {
    res.status(403).json({ error: "Forbidden: admin role required" });
    return null;
  }

  return authResult.user;
}

function requireRole(allowedRoles) {
  return async function roleMiddleware(req, res, next) {
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }

    const authResult = await getAuthenticatedUserFromRequest(req);

    if (authResult.error) {
      res.status(authResult.errorStatus).json({ error: authResult.error });
      return;
    }

    const role = authResult.user.user_metadata?.role || "clinician";
    if (!allowedRoles.includes(role)) {
      res
        .status(403)
        .json({ error: `Forbidden: requires one of [${allowedRoles.join(", ")}]` });
      return;
    }

    req.authUser = authResult.user;
    req.authRole = role;
    next();
  };
}

async function writeAuditLog(userId, orgId, event, metadata, ip, userAgent) {
  try {
    await supabase.from("audit_log").insert({
      user_id: userId || null,
      org_id: orgId || null,
      event,
      metadata: metadata || {},
      ip_address: ip || null,
      user_agent: userAgent || null,
    });
  } catch (err) {
    console.error("audit_log write failed:", err.message);
  }
}

const repos = createSupabaseRepositories();
const scheduleService = createScheduleService(repos);
const encounterService = createEncounterService(repos);
const claimService = createClaimService(repos);
const workqueueService = createWorkqueueService(repos);
const billingService = createBillingService(repos);

app.use("/api", (req, res, next) => {
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(
  "/api",
  createApiRouter({
    scheduleService,
    encounterService,
    claimService,
    workqueueService,
    billingService,
    requireRole,
  }),
);

app.post("/api/billing-portal", async (req, res) => {
  const authResult = await getAuthenticatedUserFromRequest(req);
  if (authResult.error) {
    res.status(authResult.errorStatus).json({ error: authResult.error });
    return;
  }

  try {
    const email = authResult.user.email;
    const customers = await stripe.customers.list({ email, limit: 1 });

    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({ email });
      customerId = customer.id;
    }

    const origin =
      typeof req.headers.origin === "string" && FRONTEND_ORIGINS.includes(req.headers.origin)
        ? req.headers.origin
        : "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/app/subscription.html`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Billing portal error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/audit", async (req, res) => {
  const authResult = await getAuthenticatedUserFromRequest(req);
  if (authResult.error) {
    res.status(authResult.errorStatus).json({ error: authResult.error });
    return;
  }

  const { event, metadata } = req.body || {};
  if (!event || !ALLOWED_AUDIT_EVENTS.includes(event)) {
    res.status(400).json({ error: "Invalid or missing event type" });
    return;
  }

  const orgId = authResult.user.user_metadata?.org_id || null;
  await writeAuditLog(
    authResult.user.id,
    orgId,
    event,
    metadata || {},
    clientIp(req),
    req.headers["user-agent"],
  );

  res.json({ success: true });
});

app.get("/api/admin/audit-log", requireRole(["super_admin", "admin"]), async (req, res) => {
  try {
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 100, 500);
    const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);

    const { data, error } = await supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.json({ log: data, limit, offset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/auth/profile", async (req, res) => {
  const authResult = await getAuthenticatedUserFromRequest(req);
  if (authResult.error) {
    res.status(authResult.errorStatus).json({ error: authResult.error });
    return;
  }

  if (DEV_BYPASS_AUTH) {
    res.json({
      id: DEV_USER.id,
      email: DEV_USER.email,
      role: DEV_USER.user_metadata.role,
      org_id: DEV_USER.user_metadata.org_id,
      org_role: DEV_USER.user_metadata.role,
      created_at: new Date().toISOString(),
    });
    return;
  }

  const { data: orgMember } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", authResult.user.id)
    .maybeSingle();

  res.json({
    id: authResult.user.id,
    email: authResult.user.email,
    role: authResult.user.user_metadata?.role || "clinician",
    org_id: orgMember?.org_id || authResult.user.user_metadata?.org_id || null,
    org_role: orgMember?.role || null,
    created_at: authResult.user.created_at,
  });
});

app.post("/api/auth/preview-role/validate", async (req, res) => {
  const authResult = await getAuthenticatedUserFromRequest(req);
  if (authResult.error) {
    res.status(authResult.errorStatus).json({ error: authResult.error });
    return;
  }

  const callerRole = authResult.user.user_metadata?.role || "clinician";
  if (callerRole !== "super_admin" && callerRole !== "admin") {
    res.status(403).json({ error: "Preview mode requires admin role" });
    return;
  }

  const { targetRole } = req.body || {};
  if (!ALL_ROLES.includes(targetRole)) {
    res.status(400).json({ error: "Invalid target role" });
    return;
  }

  await writeAuditLog(
    authResult.user.id,
    authResult.user.user_metadata?.org_id || null,
    "preview_start",
    { targetRole },
    clientIp(req),
    req.headers["user-agent"],
  );

  res.json({ success: true, targetRole });
});

app.get("/api/admin/users", async (req, res) => {
  const caller = await requireAdminRole(req, res);
  if (!caller) return;

  try {
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;
    res.json({ users: data.users });
  } catch (err) {
    console.error("admin/users error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/set-role", async (req, res) => {
  const caller = await requireAdminRole(req, res);
  if (!caller) return;

  const { userId, role } = req.body || {};
  if (!userId || !role || !ALL_ROLES.includes(role)) {
    res.status(400).json({ error: "userId and a valid role are required" });
    return;
  }

  const callerRole = caller.user_metadata?.role || "clinician";
  if ((role === "super_admin" || role === "admin") && callerRole !== "super_admin") {
    res.status(403).json({ error: "Only super_admin can assign admin roles" });
    return;
  }

  try {
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { role },
    });
    if (error) throw error;

    await writeAuditLog(
      caller.id,
      caller.user_metadata?.org_id || null,
      "role_changed",
      { targetUserId: userId, newRole: role },
      null,
      null,
    );

    res.json({ success: true, user: data.user });
  } catch (err) {
    console.error("admin/set-role error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get(
  "/api/clinician/stripe-connect/url",
  requireRole(["clinician", "admin", "super_admin"]),
  async (req, res) => {
    try {
      const origin =
        typeof req.headers.origin === "string" && FRONTEND_ORIGINS.includes(req.headers.origin)
          ? req.headers.origin
          : "http://localhost:3000";

      const returnUrl = `${origin}/app/settings.html?stripe_return=1`;
      const refreshUrl = `${origin}/app/settings.html?stripe_refresh=1`;

      const account = await stripe.accounts.create({
        type: "express",
        email: req.authUser.email,
        metadata: { supabase_user_id: req.authUser.id },
      });

      await supabase.from("clinician_stripe_accounts").upsert(
        {
          user_id: req.authUser.id,
          stripe_account_id: account.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: "account_onboarding",
      });

      res.json({ url: accountLink.url });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.get(
  "/api/clinician/stripe-connect/status",
  requireRole(["clinician", "admin", "super_admin"]),
  async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("clinician_stripe_accounts")
        .select("stripe_account_id, connected_at, livemode")
        .eq("user_id", req.authUser.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        res.json({ connected: false });
        return;
      }

      const account = await stripe.accounts.retrieve(data.stripe_account_id);
      const connected = Boolean(account.charges_enabled && account.details_submitted);

      if (connected && !data.connected_at) {
        await supabase
          .from("clinician_stripe_accounts")
          .update({
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
            details_submitted: account.details_submitted,
            connected_at: new Date().toISOString(),
            livemode: account.livemode,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", req.authUser.id);
      }

      res.json({
        connected,
        accountId: data.stripe_account_id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        livemode: account.livemode,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.delete(
  "/api/clinician/stripe-connect",
  requireRole(["clinician", "admin", "super_admin"]),
  async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("clinician_stripe_accounts")
        .select("stripe_account_id")
        .eq("user_id", req.authUser.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        res.status(404).json({ error: "No connected Stripe account found" });
        return;
      }

      await supabase.from("clinician_stripe_accounts").delete().eq("user_id", req.authUser.id);

      await writeAuditLog(
        req.authUser.id,
        req.authUser.user_metadata?.org_id || null,
        "stripe_disconnect",
        { accountId: data.stripe_account_id },
        clientIp(req),
        req.headers["user-agent"],
      );

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.get(
  "/api/org/members",
  requireRole(["admin", "super_admin", "supervisor"]),
  async (req, res) => {
    try {
      const orgId = req.authUser.user_metadata?.org_id;
      if (!orgId) {
        res.status(400).json({ error: "User is not assigned to an organization" });
        return;
      }

      const { data, error } = await supabase
        .from("organization_members")
        .select("id, user_id, role, joined_at")
        .eq("org_id", orgId);

      if (error) throw error;
      res.json({ members: data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.post(
  "/api/org/members",
  requireRole(["admin", "super_admin"]),
  async (req, res) => {
    try {
      const orgId = req.authUser.user_metadata?.org_id;
      if (!orgId) {
        res.status(400).json({ error: "User is not assigned to an organization" });
        return;
      }

      const { userId, role } = req.body || {};
      if (!userId || !role || !ALL_ROLES.includes(role)) {
        res.status(400).json({ error: "userId and a valid role are required" });
        return;
      }

      const { data, error } = await supabase
        .from("organization_members")
        .upsert(
          {
            org_id: orgId,
            user_id: userId,
            role,
            invited_by: req.authUser.id,
          },
          { onConflict: "org_id,user_id" },
        )
        .select()
        .single();

      if (error) throw error;
      res.json({ member: data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.post("/stripe-webhook", express.raw({ type: "*/*" }), async (req, res) => {
  let event;

  try {
    const signature = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(req.body, signature, endpointSecret);
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const email = session.customer_details?.email?.toLowerCase();

    if (email) {
      await supabase.from("subscriptions").upsert({
        email,
        active: true,
      });
    }
  }

  res.json({ received: true });
});

const server = app.listen(PORT, () => {
  console.log(`App running at http://localhost:${PORT}/app/admin-dashboard.html`);
  console.log(`DEV_BYPASS_AUTH=${DEV_BYPASS_AUTH}`);
});

server.on("error", (err) => {
  console.error("SERVER ERROR EVENT:", err);
});
