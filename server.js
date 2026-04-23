require('dotenv').config()

const express = require("express")
const Stripe = require("stripe")
const { createClient } = require("@supabase/supabase-js")
const path = require("path")
const { createSupabaseRepositories } = require("./backend-dist/backend/src/repositories/supabase/index.js")
const {
  createEncounterService,
  createClaimService,
  createWorkqueueService,
  createBillingService,
} = require("./backend-dist/backend/src/services/factories.js")
const { createApiRouter } = require("./backend-dist/backend/src/routes/index.js")

const app = express()

/* STATIC APP */

app.use(express.static(path.join(__dirname, "public")))

app.get("/", (req, res) => {
  res.redirect("/app/dashboard.html")
})

// Separate admin login URL: /admin → admin-login.html
app.get("/admin", (req, res) => {
  res.redirect("/app/admin-login.html")
})

app.use(express.json())

/* STRIPE */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET

/* SUPABASE */

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

/* BILLING PORTAL */

app.post("/api/billing-portal", async (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: "Invalid session" });

    const email = user.email;
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({ email });
      customerId = customer.id;
    }

    const origin = req.headers.origin || "http://localhost:3000";
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: origin + "/app/subscription.html"
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Billing portal error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── AUTH & ROLE CONSTANTS ────────────────────────────────────────────────── */

const ALL_ROLES = [
  'super_admin', 'admin', 'clinician',
  'billing_specialist', 'credentialing_specialist',
  'supervisor', 'front_desk', 'patient',
];

// Legacy admin check (kept for existing routes — do not remove)
const ADMIN_ROLES_SERVER = ['admin', 'billing_specialist', 'billing_staff', 'credentialing_specialist', 'supervisor', 'front_desk', 'super_admin'];

async function requireAdminRole(req, res) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  const { data, error } = await supabase.auth.getUser(token);
  const user = data?.user;
  if (error || !user) { res.status(401).json({ error: 'Invalid session' }); return null; }
  const role = user.user_metadata?.role || 'clinician';
  if (!ADMIN_ROLES_SERVER.includes(role)) { res.status(403).json({ error: 'Forbidden: admin role required' }); return null; }
  return user;
}

/**
 * Express middleware factory for role-based access control.
 * Usage: app.get('/route', requireRole(['admin', 'super_admin']), handler)
 */
function requireRole(allowedRoles) {
  return async function (req, res, next) {
    const auth = req.headers.authorization || '';
    const token = auth.replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await supabase.auth.getUser(token);
    const user = data?.user;
    if (error || !user) return res.status(401).json({ error: 'Invalid session' });

    const role = user.user_metadata?.role || 'clinician';
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: `Forbidden: requires one of [${allowedRoles.join(', ')}]` });
    }

    req.authUser = user;
    req.authRole = role;
    next();
  };
}

/* CANONICAL API ROUTER COMPOSITION */
const repos = createSupabaseRepositories()
const encounterService = createEncounterService(repos)
const claimService = createClaimService(repos)
const workqueueService = createWorkqueueService(repos)
const billingService = createBillingService(repos)

app.use(
  "/api",
  createApiRouter({
    encounterService,
    claimService,
    workqueueService,
    billingService,
    requireRole,
  }),
)

/* ── AUDIT LOG HELPER ─────────────────────────────────────────────────────── */

const ALLOWED_AUDIT_EVENTS = [
  'login', 'logout', 'mfa_enrolled', 'mfa_verified',
  'preview_start', 'preview_end',
  'stripe_connect', 'stripe_disconnect',
  'password_reset', 'role_changed',
];

async function writeAuditLog(userId, orgId, event, metadata, ip, userAgent) {
  try {
    await supabase.from('audit_log').insert({
      user_id:    userId   || null,
      org_id:     orgId    || null,
      event,
      metadata:   metadata || {},
      ip_address: ip       || null,
      user_agent: userAgent || null,
    });
  } catch (err) {
    console.error('audit_log write failed:', err.message);
  }
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
}

/* ── AUDIT LOG ENDPOINT ───────────────────────────────────────────────────── */

// POST /api/auth/audit
// Client calls this after significant auth events (login, logout, MFA, etc.).
app.post('/api/auth/audit', async (req, res) => {
  const auth  = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data, error } = await supabase.auth.getUser(token);
  const user = data?.user;
  if (error || !user) return res.status(401).json({ error: 'Invalid session' });

  const { event, metadata } = req.body || {};
  if (!event || !ALLOWED_AUDIT_EVENTS.includes(event)) {
    return res.status(400).json({ error: 'Invalid or missing event type' });
  }

  const orgId = user.user_metadata?.org_id || null;
  await writeAuditLog(user.id, orgId, event, metadata || {}, clientIp(req), req.headers['user-agent']);
  res.json({ success: true });
});

// GET /api/admin/audit-log  —  Admin view of audit log
app.get('/api/admin/audit-log', requireRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit)  || 100, 500);
    const offset = Math.max(parseInt(req.query.offset) || 0,   0);
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    res.json({ log: data, limit, offset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── AUTH PROFILE ─────────────────────────────────────────────────────────── */

// GET /api/auth/profile  —  Returns resolved user profile including org membership
app.get('/api/auth/profile', async (req, res) => {
  const auth  = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data, error } = await supabase.auth.getUser(token);
  const user = data?.user;
  if (error || !user) return res.status(401).json({ error: 'Invalid session' });

  const { data: orgMember } = await supabase
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  res.json({
    id:         user.id,
    email:      user.email,
    role:       user.user_metadata?.role || 'clinician',
    org_id:     orgMember?.org_id || user.user_metadata?.org_id || null,
    org_role:   orgMember?.role   || null,
    created_at: user.created_at,
  });
});

/* ── ADMIN PREVIEW ROLE ───────────────────────────────────────────────────── */

// POST /api/auth/preview-role/validate
// Validates that the caller may enter preview mode and records an audit event.
// The actual preview is tab-scoped (sessionStorage) on the client.
app.post('/api/auth/preview-role/validate', async (req, res) => {
  const auth  = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data, error } = await supabase.auth.getUser(token);
  const user = data?.user;
  if (error || !user) return res.status(401).json({ error: 'Invalid session' });

  const callerRole = user.user_metadata?.role || 'clinician';
  if (callerRole !== 'super_admin' && callerRole !== 'admin') {
    return res.status(403).json({ error: 'Preview mode requires admin role' });
  }

  const { targetRole } = req.body || {};
  if (!ALL_ROLES.includes(targetRole)) {
    return res.status(400).json({ error: 'Invalid target role' });
  }

  await writeAuditLog(
    user.id, user.user_metadata?.org_id || null,
    'preview_start', { targetRole }, clientIp(req), req.headers['user-agent']
  );

  res.json({ success: true, targetRole });
});

/* ── ROLE MANAGEMENT ──────────────────────────────────────────────────────── */

// ADMIN ENDPOINTS (continued below)

app.get('/api/admin/users', async (req, res) => {
  const caller = await requireAdminRole(req, res);
  if (!caller) return;
  try {
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;
    res.json({ users: data.users });
  } catch (err) {
    console.error('admin/users error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/set-role', async (req, res) => {
  const caller = await requireAdminRole(req, res);
  if (!caller) return;
  const { userId, role } = req.body || {};
  if (!userId || !role || !ALL_ROLES.includes(role)) {
    return res.status(400).json({ error: 'userId and a valid role are required' });
  }
  // Only super_admin can grant super_admin or admin roles
  const callerRole = caller.user_metadata?.role || 'clinician';
  if ((role === 'super_admin' || role === 'admin') && callerRole !== 'super_admin') {
    return res.status(403).json({ error: 'Only super_admin can assign admin roles' });
  }
  try {
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { role }
    });
    if (error) throw error;

    await writeAuditLog(
      caller.id, caller.user_metadata?.org_id || null,
      'role_changed', { targetUserId: userId, newRole: role },
      null, null
    );

    res.json({ success: true, user: data.user });
  } catch (err) {
    console.error('admin/set-role error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── STRIPE CONNECT (clinician account linking) ───────────────────────────── */

// GET /api/clinician/stripe-connect/url
// Returns a Stripe Account onboarding link for the authenticated clinician.
app.get('/api/clinician/stripe-connect/url',
  requireRole(['clinician', 'admin', 'super_admin']),
  async (req, res) => {
    try {
      const origin      = req.headers.origin || 'http://localhost:3000';
      const returnUrl   = `${origin}/app/settings.html?stripe_return=1`;
      const refreshUrl  = `${origin}/app/settings.html?stripe_refresh=1`;

      // Create a new Express account on behalf of the clinician
      const account = await stripe.accounts.create({
        type:  'express',
        email: req.authUser.email,
        metadata: { supabase_user_id: req.authUser.id },
      });

      // Persist the account ID so we can look it up later
      await supabase.from('clinician_stripe_accounts').upsert({
        user_id:            req.authUser.id,
        stripe_account_id:  account.id,
        updated_at:         new Date().toISOString(),
      }, { onConflict: 'user_id' });

      const accountLink = await stripe.accountLinks.create({
        account:     account.id,
        refresh_url: refreshUrl,
        return_url:  returnUrl,
        type:        'account_onboarding',
      });

      res.json({ url: accountLink.url });
    } catch (err) {
      console.error('stripe-connect/url error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

// GET /api/clinician/stripe-connect/status
// Returns the connection and capability status for the current clinician.
app.get('/api/clinician/stripe-connect/status',
  requireRole(['clinician', 'admin', 'super_admin']),
  async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('clinician_stripe_accounts')
        .select('stripe_account_id, connected_at, livemode')
        .eq('user_id', req.authUser.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return res.json({ connected: false });

      const account  = await stripe.accounts.retrieve(data.stripe_account_id);
      const connected = !!(account.charges_enabled && account.details_submitted);

      if (connected && !data.connected_at) {
        await supabase.from('clinician_stripe_accounts').update({
          charges_enabled:   account.charges_enabled,
          payouts_enabled:   account.payouts_enabled,
          details_submitted: account.details_submitted,
          connected_at:      new Date().toISOString(),
          livemode:          account.livemode,
          updated_at:        new Date().toISOString(),
        }).eq('user_id', req.authUser.id);
      }

      res.json({
        connected,
        accountId:        data.stripe_account_id,
        chargesEnabled:   account.charges_enabled,
        payoutsEnabled:   account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        livemode:         account.livemode,
      });
    } catch (err) {
      console.error('stripe-connect/status error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

// DELETE /api/clinician/stripe-connect
// Removes the clinician's connected Stripe account record from this platform.
app.delete('/api/clinician/stripe-connect',
  requireRole(['clinician', 'admin', 'super_admin']),
  async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('clinician_stripe_accounts')
        .select('stripe_account_id')
        .eq('user_id', req.authUser.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'No connected Stripe account found' });

      await supabase.from('clinician_stripe_accounts').delete().eq('user_id', req.authUser.id);

      await writeAuditLog(
        req.authUser.id, req.authUser.user_metadata?.org_id || null,
        'stripe_disconnect', { accountId: data.stripe_account_id },
        clientIp(req), req.headers['user-agent']
      );

      res.json({ success: true });
    } catch (err) {
      console.error('stripe-connect delete error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

/* ── ORGANIZATION ACCESS ──────────────────────────────────────────────────── */

// GET /api/org/members  —  List members of the caller's organization
app.get('/api/org/members',
  requireRole(['admin', 'super_admin', 'supervisor']),
  async (req, res) => {
    try {
      const orgId = req.authUser.user_metadata?.org_id;
      if (!orgId) return res.status(400).json({ error: 'User is not assigned to an organization' });

      const { data, error } = await supabase
        .from('organization_members')
        .select('id, user_id, role, joined_at')
        .eq('org_id', orgId);

      if (error) throw error;
      res.json({ members: data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/org/members  —  Add a user to the caller's org with a role
app.post('/api/org/members',
  requireRole(['admin', 'super_admin']),
  async (req, res) => {
    try {
      const orgId = req.authUser.user_metadata?.org_id;
      if (!orgId) return res.status(400).json({ error: 'User is not assigned to an organization' });

      const { userId, role } = req.body || {};
      if (!userId || !role || !ALL_ROLES.includes(role)) {
        return res.status(400).json({ error: 'userId and a valid role are required' });
      }

      const { data, error } = await supabase.from('organization_members').upsert({
        org_id:     orgId,
        user_id:    userId,
        role,
        invited_by: req.authUser.id,
      }, { onConflict: 'org_id,user_id' }).select().single();

      if (error) throw error;
      res.json({ member: data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* ── ADMIN ENDPOINTS (continued) ─────────────────────────────────────────── */

/* WEBHOOK */

app.post("/stripe-webhook", express.raw({ type: "*/*" }), async (req, res) => {

  console.log("---- WEBHOOK HIT ----")
  console.log("content-type:", req.headers["content-type"])
  console.log("req.body is Buffer:", Buffer.isBuffer(req.body))

  let event

  try {

    const sig = req.headers["stripe-signature"]

    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      endpointSecret
    )

  } catch (err) {

    console.log("Webhook signature verification failed:", err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)

  }

  if (event.type === "checkout.session.completed") {

    const session = event.data.object
    const email = session.customer_details?.email?.toLowerCase()

    console.log("Subscription purchased by:", email)

    if (email) {

      const { error } = await supabase
        .from("subscriptions")
        .upsert({
          email: email,
          active: true
        })

      if (error) {
        console.log("Supabase error:", error.message)
      } else {
        console.log("Subscription activated")
      }

    }

  }

  res.json({ received: true })

})

/* START SERVER */

const PORT = process.env.PORT || 3000

const server = app.listen(PORT, () => {
  console.log(`App running at http://localhost:${PORT}/app/dashboard.html`)
  console.log("server.listening:", server.listening)
})

server.on("close", () => {
  console.log("SERVER CLOSE EVENT FIRED")
})

server.on("error", (err) => {
  console.error("SERVER ERROR EVENT:", err)
})

setInterval(() => {
  console.log("HEARTBEAT", new Date().toISOString())
}, 30000)