/**
 * THERASSISTANT Support Chat Widget  v1.0
 * chat-widget.js — include on all clinician-facing pages after shared.js
 *
 * Self-contained IIFE — injects its own CSS, creates DOM, handles Supabase
 * realtime subscriptions, presence tracking, file uploads, and auto-ticket
 * creation when staff are offline or SLA is breached.
 *
 * Relies on: window.supabaseClient  (set by shared.js)
 */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     CONSTANTS
  ══════════════════════════════════════════════════════════ */
  var TOPICS = [
    'Billing', 'Credentialing', 'Coding', 'Claims', 'Denials',
    'Payments', 'Technical Support', 'Subscription Question', 'General Question'
  ];

  var FILE_TYPES = [
    'Screenshot', 'EOB (Explanation of Benefits)', 'Denial Letter',
    'Recoupment Notice', 'Credentialing Letter', 'Remittance Advice',
    'Claim Form', 'Authorization', 'PDF Report', 'Other Document'
  ];

  var FAQS = [
    {
      q: 'How do I correct and resubmit a denied claim?',
      a: 'Go to Saved Reports, locate the note for the denied date of service, click "Generate Note", update any required fields, then use the corrected claim to resubmit to the payer. Upload your denial letter via this chat for staff review.'
    },
    {
      q: 'What documentation is required for H0031 level of care assessments?',
      a: 'For H0031 you need: a completed ASAM criteria assessment, diagnostic impressions, level of care recommendation, and clinician signature. THERASSISTANT\'s H0031 module auto-generates all required fields when you fill in the guided form.'
    },
    {
      q: 'Why is my billing code showing as excluded?',
      a: 'Colorado Medicaid exclusion rules apply to certain code combinations. Common exclusions: H0001 cannot be billed same-day as H0031, and H2019 cannot appear with 90837 on the same claim. Review the Coder tool\'s exclusion warnings for details.'
    },
    {
      q: 'How long does it take for a recoupment notice response?',
      a: 'We aim to respond to recoupment notices within 24–48 business hours. Please upload your notice through this chat and our billing team will review and prepare a response letter on your behalf.'
    },
    {
      q: 'Can I change my subscription plan?',
      a: 'Yes — go to Settings → Subscription to update your plan. Changes take effect on the next billing cycle. Contact support via this chat if you need to downgrade or pause your account.'
    },
    {
      q: 'How do I get a credentialing letter from THERASSISTANT?',
      a: 'Submit your request through this chat by selecting "Credentialing" as the topic. Include the provider name, NPI, payer, and purpose. Our credentialing team typically generates letters within 1–2 business days.'
    }
  ];

  /* ── SLA: minutes before auto-ticket is created when staff offline */
  var SLA_OFFLINE_MINUTES = 30;
  var SLA_ONLINE_MINUTES  = 15;

  /* ══════════════════════════════════════════════════════════
     STATE
  ══════════════════════════════════════════════════════════ */
  var S = {
    user:            null,
    conv:            null,
    messages:        [],
    realtimeChannel: null,
    presenceChannel: null,
    isOpen:          false,
    view:            'menu',   /* menu | chat | tickets | upload | faq */
    unread:          0,
    staffOnline:     false,
    staffList:       [],
    pendingFiles:    [],
    selectedTopic:   '',
    isUrgent:        false,
    typingTimer:     null,
    slaTimer:        null,
    slaWarned:       false,
    notifGranted:    false,
    isDragging:      false,
    initialized:     false,
  };

  /* ══════════════════════════════════════════════════════════
     HELPERS
  ══════════════════════════════════════════════════════════ */
  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtTime(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch (e) { return ''; }
  }

  function fmtRelative(iso) {
    if (!iso) return '';
    try {
      var diff = (Date.now() - new Date(iso).getTime()) / 1000;
      if (diff < 60)     return 'Just now';
      if (diff < 3600)   return Math.floor(diff / 60) + 'm ago';
      if (diff < 86400)  return Math.floor(diff / 3600) + 'h ago';
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) { return ''; }
  }

  function uid() {
    return 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  }

  function getConvKey() {
    return 'dchat_v1_' + ((S.user && S.user.id) || 'guest');
  }

  function getClient() {
    return (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;
  }

  function detectActivity() {
    var path = window.location.pathname + window.location.search;
    if (path.includes('Coder') || path.includes('coder'))   return 'Currently in coding workflow';
    if (path.includes('H0031') || path.includes('H0001'))   return 'Currently generating assessment note';
    if (path.includes('report'))                             return 'Currently viewing reports';
    if (path.includes('note'))                               return 'Currently viewing notes';
    if (path.includes('support'))                            return 'Currently in support center';
    if (path.includes('billing') || path.includes('subscr')) return 'Currently on billing page';
    return 'Currently on THERASSISTANT';
  }

  /* ══════════════════════════════════════════════════════════
     LOCAL STORAGE
  ══════════════════════════════════════════════════════════ */
  function loadLocal() {
    try {
      var raw = localStorage.getItem(getConvKey());
      if (raw) {
        var d = JSON.parse(raw);
        S.conv     = d.conv     || null;
        S.messages = d.messages || [];
      }
    } catch (e) {}
  }

  function saveLocal() {
    try {
      localStorage.setItem(getConvKey(), JSON.stringify({ conv: S.conv, messages: S.messages }));
    } catch (e) {}
  }

  /* ══════════════════════════════════════════════════════════
     SUPABASE — CONVERSATIONS
  ══════════════════════════════════════════════════════════ */
  async function fetchOrCreateConversation() {
    var db = getClient();
    if (!db || !S.user) return;
    try {
      /* Try to load from Supabase first */
      var { data: convs } = await db.from('conversations')
        .select('*')
        .eq('user_id', S.user.id)
        .neq('status', 'Closed')
        .order('updated_at', { ascending: false })
        .limit(1);
      if (convs && convs.length > 0) {
        S.conv = convs[0];
        /* Load messages */
        var { data: msgs } = await db.from('messages')
          .select('*')
          .eq('conversation_id', S.conv.id)
          .order('sent_at', { ascending: true });
        if (msgs) S.messages = msgs;
        saveLocal();
      }
    } catch (e) {
      /* Supabase tables may not exist yet — localStorage fallback already loaded */
    }
  }

  async function createConversationInDb(topic, isUrgent) {
    var db = getClient();
    if (!db || !S.user) return null;
    try {
      var meta  = S.user.user_metadata || {};
      var practice = meta.practice_name || meta.organization || '';
      var { data, error } = await db.from('conversations').insert({
        user_id:    S.user.id,
        topic:      topic,
        status:     'Open',
        priority:   isUrgent ? 'Urgent' : 'Routine',
        is_urgent:  isUrgent,
        last_message_at:      new Date().toISOString(),
        last_message_preview: 'New conversation started',
      }).select().single();
      if (!error && data) return data;
    } catch (e) {}
    return null;
  }

  async function saveMessageToDb(msg) {
    var db = getClient();
    if (!db || !S.conv || !S.conv.id || S.conv.id.startsWith('local-')) return;
    try {
      await db.from('messages').insert({
        conversation_id: S.conv.id,
        sender_id:       S.user.id,
        sender_role:     'clinician',
        content:         msg.content,
        message_type:    msg.type || 'text',
        is_urgent:       msg.is_urgent || false,
        sent_at:         msg.sent_at,
      });
      await db.from('conversations')
        .update({
          last_message_at:      msg.sent_at,
          last_message_preview: msg.content.slice(0, 120),
          updated_at:           new Date().toISOString(),
          unread_count_staff:   (S.conv.unread_count_staff || 0) + 1,
        })
        .eq('id', S.conv.id);
    } catch (e) {}
  }

  /* ══════════════════════════════════════════════════════════
     SUPABASE — REALTIME
  ══════════════════════════════════════════════════════════ */
  function subscribeToMessages() {
    var db = getClient();
    if (!db || !S.conv || S.conv.id.startsWith('local-')) return;
    if (S.realtimeChannel) { S.realtimeChannel.unsubscribe(); }
    S.realtimeChannel = db
      .channel('chat:' + S.conv.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: 'conversation_id=eq.' + S.conv.id
      }, function (payload) {
        var msg = payload.new;
        if (msg.sender_id === S.user.id) return; /* own message already appended */
        S.messages.push(msg);
        saveLocal();
        appendMessageDOM(msg);
        if (!S.isOpen || S.view !== 'chat') {
          S.unread++;
          updateBadge();
          showBrowserNotif('Support replied', msg.content.slice(0, 80));
        }
        scrollMessages();
      })
      .subscribe();
  }

  function subscribeToPresence() {
    var db = getClient();
    if (!db) return;
    S.presenceChannel = db.channel('docusistant:support-presence')
      .on('presence', { event: 'sync' }, function () {
        var ps = S.presenceChannel.presenceState();
        var keys = Object.keys(ps);
        S.staffList = [];
        keys.forEach(function (k) {
          var presences = ps[k];
          presences.forEach(function (p) {
            if (p.role && p.role !== 'clinician') {
              S.staffList.push(p);
            }
          });
        });
        S.staffOnline = S.staffList.length > 0;
        updatePresenceDot();
      })
      .on('presence', { event: 'join' }, function (e) {
        if (e.newPresences && e.newPresences[0] && e.newPresences[0].role !== 'clinician') {
          S.staffOnline = true;
          updatePresenceDot();
        }
      })
      .on('presence', { event: 'leave' }, function () {
        /* recheck on next sync */
      })
      .subscribe(async function (status) {
        if (status === 'SUBSCRIBED' && S.user) {
          await S.presenceChannel.track({
            user_id:  S.user.id,
            email:    S.user.email,
            role:     (S.user.user_metadata && S.user.user_metadata.role) || 'clinician',
            page:     window.location.pathname,
            activity: detectActivity(),
            status:   'online',
          });
        }
      });
  }

  function updateUserPresence(status) {
    if (!S.presenceChannel) return;
    try {
      S.presenceChannel.track({
        user_id:  S.user && S.user.id,
        email:    S.user && S.user.email,
        role:     (S.user && S.user.user_metadata && S.user.user_metadata.role) || 'clinician',
        page:     window.location.pathname,
        activity: detectActivity(),
        status:   status,
      });
    } catch (e) {}
  }

  /* ══════════════════════════════════════════════════════════
     AUTO-TICKET CREATION
  ══════════════════════════════════════════════════════════ */
  function startSLATimer() {
    clearSLATimer();
    var minutes = S.staffOnline ? SLA_ONLINE_MINUTES : SLA_OFFLINE_MINUTES;
    S.slaTimer = setTimeout(function () {
      if (!S.slaWarned) {
        S.slaWarned = true;
        autoCreateTicket('SLA breach — no staff response within ' + minutes + ' minutes');
      }
    }, minutes * 60 * 1000);
  }

  function clearSLATimer() {
    if (S.slaTimer) { clearTimeout(S.slaTimer); S.slaTimer = null; }
    S.slaWarned = false;
  }

  function autoCreateTicket(reason) {
    var transcript = S.messages.map(function (m) {
      var sender = m.sender_role === 'clinician' ? 'You' : 'Support';
      return '[' + fmtTime(m.sent_at) + '] ' + sender + ': ' + m.content;
    }).join('\n');

    var ticketId = 'TKT-' + Date.now();
    var ticket = {
      id:          ticketId,
      subject:     (S.selectedTopic || 'General Question') + ' — Chat Converted to Ticket',
      description: 'Auto-created from live chat.\n\nReason: ' + reason + '\n\n--- Chat Transcript ---\n' + transcript,
      topic:       S.selectedTopic || 'General Question',
      priority:    S.isUrgent ? 'Urgent' : 'Routine',
      status:      'Open',
      is_urgent:   S.isUrgent,
      created_at:  new Date().toISOString(),
      user_id:     S.user && S.user.id,
    };

    try {
      var existing = JSON.parse(localStorage.getItem('docusistant_sc_tickets_v1') || '[]');
      existing.unshift(ticket);
      localStorage.setItem('docusistant_sc_tickets_v1', JSON.stringify(existing));
    } catch (e) {}

    /* Post system message in chat */
    addSystemMessage('Your message has been converted into support ticket ' + ticketId + '. Our team will follow up via email. We apologize for the wait.');

    /* Try DB too */
    var db = getClient();
    if (db && S.conv && !S.conv.id.startsWith('local-')) {
      db.from('conversations').update({
        status:           'Escalated',
        linked_ticket_id: ticketId,
      }).eq('id', S.conv.id).then(function () {});
    }
    updatePresenceDot();
  }

  /* ══════════════════════════════════════════════════════════
     BROWSER NOTIFICATIONS
  ══════════════════════════════════════════════════════════ */
  function requestNotifPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') { S.notifGranted = true; return; }
    if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(function (p) {
        S.notifGranted = (p === 'granted');
      });
    }
  }

  function showBrowserNotif(title, body) {
    if (!S.notifGranted) return;
    try {
      new Notification('THERASSISTANT — ' + title, {
        body: body,
        icon: '/favicon.ico',
        tag:  'dchat',
      });
    } catch (e) {}
  }

  /* ══════════════════════════════════════════════════════════
     CSS INJECTION
  ══════════════════════════════════════════════════════════ */
  function injectCSS() {
    if (document.getElementById('dchat-styles')) return;
    var el = document.createElement('style');
    el.id  = 'dchat-styles';
    el.textContent = [
      /* === Floating button === */
      '#dchat-btn{position:fixed;bottom:24px;right:24px;z-index:9990;width:58px;height:58px;border-radius:50%;background:linear-gradient(135deg,#3c90d1,#1a5f98);box-shadow:0 4px 22px rgba(26,95,152,.5);display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;transition:transform .22s ease,box-shadow .22s ease;outline:none}',
      '#dchat-btn:hover{transform:scale(1.09);box-shadow:0 7px 30px rgba(26,95,152,.65)}',
      '#dchat-btn svg{width:26px;height:26px;fill:#fff;flex-shrink:0}',
      '.dchat-badge{position:absolute;top:-3px;right:-3px;background:#ef4444;color:#fff;font-size:10px;font-weight:800;min-width:18px;height:18px;border-radius:99px;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #fff;font-family:\'Public Sans\',sans-serif;pointer-events:none}',
      /* === Panel === */
      '#dchat-panel{position:fixed;bottom:92px;right:24px;z-index:9989;width:384px;background:#fff;border-radius:20px;box-shadow:0 16px 60px rgba(13,53,94,.28);display:flex;flex-direction:column;overflow:hidden;transform:scale(.9) translateY(20px);opacity:0;pointer-events:none;transition:transform .26s cubic-bezier(.34,1.56,.64,1),opacity .22s ease;max-height:600px;font-family:\'Public Sans\',\'Segoe UI\',sans-serif;font-size:14px}',
      '#dchat-panel.dchat-open{transform:scale(1) translateY(0);opacity:1;pointer-events:all}',
      /* === Header === */
      '.dchat-hdr{background:linear-gradient(135deg,#1a5f98,#0b2c4d);padding:14px 16px;display:flex;align-items:center;gap:12px;flex-shrink:0}',
      '.dchat-hdr-avatar{width:40px;height:40px;background:rgba(255,255,255,.16);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0}',
      '.dchat-hdr-info{flex:1;min-width:0}',
      '.dchat-hdr-title{font-family:\'Sora\',\'Public Sans\',sans-serif;font-size:14px;font-weight:700;color:#fff;letter-spacing:.01em}',
      '.dchat-hdr-sub{display:flex;align-items:center;gap:6px;font-size:11.5px;color:rgba(255,255,255,.78);margin-top:3px}',
      '.dchat-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;transition:background .3s}',
      '.dchat-dot.online{background:#4ade80;box-shadow:0 0 6px rgba(74,222,128,.7)}',
      '.dchat-dot.idle{background:#fbbf24;box-shadow:0 0 6px rgba(251,191,36,.6)}',
      '.dchat-dot.offline{background:#94a3b8}',
      '.dchat-close{background:rgba(255,255,255,.14);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s;line-height:1}',
      '.dchat-close:hover{background:rgba(255,255,255,.28)}',
      /* === Content === */
      '.dchat-content{flex:1;overflow-y:auto;display:flex;flex-direction:column;min-height:0;scroll-behavior:smooth}',
      /* === Menu === */
      '.dchat-menu{padding:18px 16px;display:flex;flex-direction:column;gap:8px}',
      '.dchat-menu-greeting{font-size:14px;font-weight:700;color:#112538;margin-bottom:4px}',
      '.dchat-menu-sub{font-size:12.5px;color:#526373;margin-bottom:6px;line-height:1.55}',
      '.dchat-menu-item{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1.5px solid #d9e7f4;border-radius:12px;background:#f6fafd;cursor:pointer;transition:border-color .14s,background .14s;text-decoration:none;color:inherit;outline:none}',
      '.dchat-menu-item:hover{border-color:#3c90d1;background:#eaf3fd}',
      '.dchat-menu-icon{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0}',
      '.dchat-menu-icon.blue{background:linear-gradient(135deg,#3c90d1,#1a5f98)}',
      '.dchat-menu-icon.green{background:linear-gradient(135deg,#10b981,#047857)}',
      '.dchat-menu-icon.amber{background:linear-gradient(135deg,#f59e0b,#b45309)}',
      '.dchat-menu-icon.purple{background:linear-gradient(135deg,#8b5cf6,#5b21b6)}',
      '.dchat-menu-icon.teal{background:linear-gradient(135deg,#14b8a6,#0f766e)}',
      '.dchat-menu-lbl{flex:1;min-width:0}',
      '.dchat-menu-lbl strong{display:block;font-size:13.5px;font-weight:700;color:#112538}',
      '.dchat-menu-lbl span{font-size:11.5px;color:#66788a}',
      '.dchat-menu-chevron{color:#94a3b8;font-size:12px;flex-shrink:0}',
      /* === Chat sub-header === */
      '.dchat-subhdr{display:flex;align-items:center;gap:8px;padding:9px 13px;border-bottom:1px solid #e8f0f8;background:#f6fafd;flex-shrink:0}',
      '.dchat-back{background:none;border:none;cursor:pointer;font-size:18px;color:#66788a;padding:0;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:6px;transition:background .14s}',
      '.dchat-back:hover{background:#e1edfa}',
      '.dchat-topic-pill{font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;background:#dbeafe;color:#1e40af;text-transform:uppercase;letter-spacing:.05em;cursor:pointer}',
      '.dchat-urgent-pill{font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;background:#fee2e2;color:#b91c1c;text-transform:uppercase;letter-spacing:.05em;margin-left:auto}',
      /* === Messages === */
      '.dchat-msgs{flex:1;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:10px;min-height:120px}',
      '.dchat-msg{display:flex;align-items:flex-end;gap:8px;animation:dchatIn .2s ease}',
      '.dchat-msg.mine{flex-direction:row-reverse}',
      '@keyframes dchatIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}',
      '.dchat-av{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;color:#fff;text-transform:uppercase}',
      '.dchat-av.support{background:linear-gradient(135deg,#3c90d1,#1a5f98)}',
      '.dchat-av.mine{background:linear-gradient(135deg,#10b981,#047857)}',
      '.dchat-av.system{background:#94a3b8}',
      '.dchat-msg-body{max-width:76%;display:flex;flex-direction:column;gap:3px}',
      '.dchat-msg.mine .dchat-msg-body{align-items:flex-end}',
      '.dchat-bubble{padding:9px 12px;border-radius:14px;font-size:13.5px;line-height:1.52;word-break:break-word;color:#112538}',
      '.dchat-msg.support .dchat-bubble{background:#edf5ff;border-radius:3px 14px 14px 14px}',
      '.dchat-msg.mine .dchat-bubble{background:linear-gradient(135deg,#3c90d1,#1a5f98);color:#fff;border-radius:14px 14px 3px 14px}',
      '.dchat-msg.system .dchat-bubble{background:#fef3c7;color:#92400e;font-size:12.5px;border-radius:8px;text-align:center;font-style:italic;padding:8px 14px}',
      '.dchat-msg-meta{font-size:10.5px;color:#94a3b8;display:flex;align-items:center;gap:3px;margin-top:1px}',
      '.dchat-attach-pill{display:inline-flex;align-items:center;gap:5px;background:#e1edfa;border-radius:7px;padding:4px 9px;font-size:11.5px;color:#1a5f98;font-weight:600;margin-top:4px;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      /* Typing indicator */
      '.dchat-typing{display:flex;align-items:flex-end;gap:8px;padding:0 4px 6px}',
      '.dchat-typing-bubbles{display:flex;gap:3px;padding:9px 12px;background:#edf5ff;border-radius:3px 14px 14px 14px}',
      '.dchat-typing-bubbles span{width:6px;height:6px;border-radius:50%;background:#94a3b8;animation:dchatBounce 1.2s infinite}',
      '.dchat-typing-bubbles span:nth-child(2){animation-delay:.2s}',
      '.dchat-typing-bubbles span:nth-child(3){animation-delay:.4s}',
      '@keyframes dchatBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}',
      /* === Input === */
      '.dchat-input-area{border-top:1px solid #e8f0f8;padding:10px 12px;flex-shrink:0;background:#fff}',
      '.dchat-file-chips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px}',
      '.dchat-file-chip{display:inline-flex;align-items:center;gap:5px;background:#dbeafe;border-radius:6px;padding:3px 8px;font-size:11px;color:#1e40af;font-weight:600}',
      '.dchat-chip-rm{background:none;border:none;cursor:pointer;color:#64748b;font-size:11px;padding:0;margin-left:2px;line-height:1}',
      '.dchat-row1{display:flex;gap:7px;margin-bottom:8px;align-items:center}',
      '.dchat-topic-sel{flex:1;padding:5px 9px;border:1.5px solid #d9e7f4;border-radius:8px;font-size:12px;font-family:inherit;color:#112538;background:#f6fafd;outline:none;cursor:pointer}',
      '.dchat-topic-sel:focus{border-color:#3c90d1}',
      '.dchat-urgent-label{display:flex;align-items:center;gap:4px;font-size:12px;color:#64748b;cursor:pointer;white-space:nowrap;flex-shrink:0;user-select:none}',
      '.dchat-urgent-label input{accent-color:#ef4444;cursor:pointer}',
      '.dchat-row2{display:flex;gap:7px;align-items:flex-end}',
      '.dchat-textarea{flex:1;border:1.5px solid #d9e7f4;border-radius:10px;padding:8px 11px;font-size:13.5px;font-family:inherit;resize:none;min-height:40px;max-height:100px;outline:none;line-height:1.45;color:#112538;background:#fff}',
      '.dchat-textarea:focus{border-color:#3c90d1;box-shadow:0 0 0 3px rgba(60,144,209,.12)}',
      '.dchat-attach-btn{width:34px;height:34px;border-radius:8px;background:#f6fafd;border:1.5px solid #d9e7f4;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#66788a;transition:border-color .14s,color .14s;flex-shrink:0}',
      '.dchat-attach-btn:hover{border-color:#3c90d1;color:#3c90d1}',
      '.dchat-attach-btn svg{width:16px;height:16px}',
      '.dchat-send{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#3c90d1,#1a5f98);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:transform .15s,opacity .15s}',
      '.dchat-send:hover{transform:scale(1.1)}',
      '.dchat-send:disabled{opacity:.45;cursor:not-allowed;transform:none}',
      '.dchat-send svg{width:17px;height:17px;fill:#fff}',
      /* === Drag overlay === */
      '.dchat-drop-overlay{position:absolute;inset:0;background:rgba(60,144,209,.1);border:3px dashed #3c90d1;border-radius:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;z-index:10;opacity:0;pointer-events:none;transition:opacity .18s}',
      '.dchat-drop-overlay.active{opacity:1}',
      '.dchat-drop-icon{font-size:2rem}',
      '.dchat-drop-label{font-size:14px;font-weight:700;color:#1a5f98}',
      /* === Tickets view === */
      '.dchat-tkts{padding:14px;display:flex;flex-direction:column;gap:8px}',
      '.dchat-tkt{border:1.5px solid #d9e7f4;border-radius:12px;padding:12px 14px;background:#f6fafd;cursor:pointer;transition:border-color .14s}',
      '.dchat-tkt:hover{border-color:#3c90d1}',
      '.dchat-tkt-id{font-size:11px;font-weight:700;color:#3c90d1;margin-bottom:3px;letter-spacing:.03em}',
      '.dchat-tkt-subj{font-size:13px;font-weight:600;color:#112538;margin-bottom:3px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
      '.dchat-tkt-meta{font-size:11.5px;color:#66788a;display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
      '.dchat-spill{display:inline-block;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:99px;text-transform:uppercase;letter-spacing:.04em}',
      '.dchat-spill-open{background:#dbeafe;color:#1e40af}',
      '.dchat-spill-closed{background:#d1fae5;color:#065f46}',
      '.dchat-spill-urgent{background:#fee2e2;color:#b91c1c}',
      '.dchat-spill-routine{background:#f1f5f9;color:#475569}',
      /* === Upload view === */
      '.dchat-upload-view{padding:16px;display:flex;flex-direction:column;gap:12px}',
      '.dchat-upload-hdr{font-size:14px;font-weight:700;color:#112538}',
      '.dchat-upload-sub{font-size:12.5px;color:#526373;line-height:1.5}',
      '.dchat-drop-zone{border:2px dashed #c5d8ea;border-radius:14px;padding:28px 16px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;transition:border-color .15s,background .15s;background:#f6fafd}',
      '.dchat-drop-zone:hover{border-color:#3c90d1;background:#eaf3fd}',
      '.dchat-drop-zone-icon{font-size:2.2rem}',
      '.dchat-drop-zone-lbl{font-size:14px;font-weight:600;color:#112538}',
      '.dchat-drop-zone-sub{font-size:12px;color:#66788a;text-align:center}',
      '.dchat-doc-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}',
      '.dchat-doc-chip{background:#dbeafe;color:#1e40af;font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px}',
      /* === FAQ view === */
      '.dchat-faq{padding:12px 14px;display:flex;flex-direction:column;gap:6px}',
      '.dchat-faq-item{border:1.5px solid #d9e7f4;border-radius:10px;overflow:hidden}',
      '.dchat-faq-q{padding:11px 13px;font-size:13px;font-weight:600;color:#112538;cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:#f6fafd;transition:background .14s;gap:8px}',
      '.dchat-faq-q:hover{background:#eaf3fd}',
      '.dchat-faq-q .dchat-faq-arrow{flex-shrink:0;transition:transform .2s;font-size:11px;color:#94a3b8}',
      '.dchat-faq-item.open .dchat-faq-arrow{transform:rotate(180deg)}',
      '.dchat-faq-a{display:none;padding:11px 13px;font-size:13px;color:#3d5062;line-height:1.55;background:#fff;border-top:1px solid #e8f0f8}',
      '.dchat-faq-item.open .dchat-faq-a{display:block}',
      /* === System / SLA bar === */
      '.dchat-sysbar{background:#fef3c7;border-top:1px solid #fde68a;padding:8px 14px;font-size:12px;color:#92400e;text-align:center;font-weight:600;flex-shrink:0}',
      '.dchat-offline-bar{background:#f1f5f9;border-top:1px solid #e2e8f0;padding:8px 14px;font-size:12px;color:#64748b;text-align:center;flex-shrink:0}',
      /* === Empty states === */
      '.dchat-empty{text-align:center;padding:28px 16px;color:#94a3b8;font-size:13px}',
      '.dchat-empty-icon{font-size:2.2rem;margin-bottom:8px}',
      /* === Responsive === */
      '@media(max-width:480px){#dchat-panel{width:calc(100vw - 16px);right:8px;bottom:82px;max-height:72vh}#dchat-btn{bottom:16px;right:16px}}'
    ].join('');
    document.head.appendChild(el);
  }

  /* ══════════════════════════════════════════════════════════
     DOM — BUILD WIDGET
  ══════════════════════════════════════════════════════════ */
  function buildDOM() {
    /* Floating button */
    var btn = document.createElement('button');
    btn.id   = 'dchat-btn';
    btn.setAttribute('aria-label', 'Open support chat');
    btn.innerHTML = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4l4 4 4-4h4a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-2 10H6v-2h12v2zm0-3H6V7h12v2z"/></svg><span class="dchat-badge" id="dchat-badge" style="display:none">0</span>';

    /* Panel */
    var panel = document.createElement('div');
    panel.id = 'dchat-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'THERASSISTANT Support Chat');
    panel.innerHTML = [
      '<div class="dchat-hdr">',
        '<div class="dchat-hdr-avatar">💬</div>',
        '<div class="dchat-hdr-info">',
          '<div class="dchat-hdr-title">THERASSISTANT Support</div>',
          '<div class="dchat-hdr-sub">',
            '<span class="dchat-dot offline" id="dchat-dot"></span>',
            '<span id="dchat-presence-txt">Checking availability…</span>',
          '</div>',
        '</div>',
        '<button class="dchat-close" id="dchat-close" aria-label="Close chat">✕</button>',
      '</div>',
      '<div class="dchat-content" id="dchat-content"></div>',
      '<div class="dchat-drop-overlay" id="dchat-drop-overlay">',
        '<div class="dchat-drop-icon">📎</div>',
        '<div class="dchat-drop-label">Drop files to attach</div>',
      '</div>',
    ].join('');

    /* Hidden file input */
    var fileInput = document.createElement('input');
    fileInput.type     = 'file';
    fileInput.id       = 'dchat-file-input';
    fileInput.multiple = true;
    fileInput.accept   = 'image/*,application/pdf,.pdf,.doc,.docx,.txt';
    fileInput.style.display = 'none';

    document.body.appendChild(btn);
    document.body.appendChild(panel);
    document.body.appendChild(fileInput);
  }

  /* ══════════════════════════════════════════════════════════
     UI — RENDER VIEWS
  ══════════════════════════════════════════════════════════ */
  function renderMenu() {
    S.view = 'menu';
    var name = S.user ? ((S.user.user_metadata && S.user.user_metadata.full_name) || S.user.email.split('@')[0]) : 'there';
    var content = document.getElementById('dchat-content');
    content.innerHTML = [
      '<div class="dchat-menu">',
        '<div class="dchat-menu-greeting">Hi, ' + esc(name) + ' 👋</div>',
        '<div class="dchat-menu-sub">How can we help you today? Select an option below.</div>',
        '<button class="dchat-menu-item" id="dm-chat">',
          '<div class="dchat-menu-icon blue">💬</div>',
          '<div class="dchat-menu-lbl"><strong>Chat with Support</strong><span>Ask a billing, coding, or credentialing question</span></div>',
          '<span class="dchat-menu-chevron">›</span>',
        '</button>',
        '<button class="dchat-menu-item" id="dm-ticket">',
          '<div class="dchat-menu-icon green">🎫</div>',
          '<div class="dchat-menu-lbl"><strong>Submit a Ticket</strong><span>Create a formal support request</span></div>',
          '<span class="dchat-menu-chevron">›</span>',
        '</button>',
        '<button class="dchat-menu-item" id="dm-upload">',
          '<div class="dchat-menu-icon amber">📤</div>',
          '<div class="dchat-menu-lbl"><strong>Upload Correspondence</strong><span>Share EOBs, denial letters, recoupment notices</span></div>',
          '<span class="dchat-menu-chevron">›</span>',
        '</button>',
        '<button class="dchat-menu-item" id="dm-tickets">',
          '<div class="dchat-menu-icon purple">📋</div>',
          '<div class="dchat-menu-lbl"><strong>View Open Tickets</strong><span>Track your existing requests</span></div>',
          '<span class="dchat-menu-chevron">›</span>',
        '</button>',
        '<button class="dchat-menu-item" id="dm-faq">',
          '<div class="dchat-menu-icon teal">❓</div>',
          '<div class="dchat-menu-lbl"><strong>FAQ</strong><span>Common billing and documentation questions</span></div>',
          '<span class="dchat-menu-chevron">›</span>',
        '</button>',
      '</div>',
      !S.staffOnline ? '<div class="dchat-offline-bar">⏰ Support typically responds within 2 hours during business hours</div>' : '',
    ].join('');

    document.getElementById('dm-chat').addEventListener('click', function () { renderChat(); });
    document.getElementById('dm-ticket').addEventListener('click', function () { window.open('support-request.html', '_blank'); });
    document.getElementById('dm-upload').addEventListener('click', function () { renderUpload(); });
    document.getElementById('dm-tickets').addEventListener('click', function () { renderTickets(); });
    document.getElementById('dm-faq').addEventListener('click', function () { renderFaq(); });
  }

  function renderChat() {
    S.view = 'chat';
    clearSLATimer();
    var content = document.getElementById('dchat-content');
    content.innerHTML = [
      '<div class="dchat-subhdr">',
        '<button class="dchat-back" id="dchat-back" aria-label="Back to menu">‹</button>',
        '<span class="dchat-topic-pill" id="dchat-cur-topic" title="Click to change topic">' +
          esc(S.selectedTopic || 'General Question') + '</span>',
        S.isUrgent ? '<span class="dchat-urgent-pill">⚡ Urgent</span>' : '',
      '</div>',
      '<div class="dchat-msgs" id="dchat-msgs"></div>',
      !S.staffOnline ? '<div class="dchat-offline-bar" id="dchat-offline-bar">Staff offline — your message will create a support ticket if unanswered</div>' : '',
      '<div class="dchat-input-area">',
        '<div class="dchat-file-chips" id="dchat-file-chips"></div>',
        '<div class="dchat-row1">',
          '<select class="dchat-topic-sel" id="dchat-topic-sel" aria-label="Select topic">',
            TOPICS.map(function (t) {
              return '<option value="' + esc(t) + '"' + (t === S.selectedTopic ? ' selected' : '') + '>' + esc(t) + '</option>';
            }).join(''),
          '</select>',
          '<label class="dchat-urgent-label"><input type="checkbox" id="dchat-urgent-chk"' + (S.isUrgent ? ' checked' : '') + '> ⚡ Urgent</label>',
        '</div>',
        '<div class="dchat-row2">',
          '<button class="dchat-attach-btn" id="dchat-attach-btn" type="button" aria-label="Attach file" title="Attach file">',
            '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48-1.41-1.42-8.49 8.49a4 4 0 0 0 5.66 5.66l9.2-9.19a6 6 0 0 0-8.49-8.49l-9.19 9.19-1.42-1.41 9.2-9.2a8 8 0 1 1 11.31 11.32z"/></svg>',
          '</button>',
          '<textarea class="dchat-textarea" id="dchat-textarea" placeholder="Type your message…" rows="1" aria-label="Message"></textarea>',
          '<button class="dchat-send" id="dchat-send" aria-label="Send message" disabled>',
            '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>',
          '</button>',
        '</div>',
      '</div>',
    ].join('');

    /* Render existing messages */
    renderMessages();

    /* Bind events */
    document.getElementById('dchat-back').addEventListener('click', renderMenu);
    document.getElementById('dchat-send').addEventListener('click', sendMessage);
    document.getElementById('dchat-attach-btn').addEventListener('click', function () {
      document.getElementById('dchat-file-input').click();
    });

    var ta = document.getElementById('dchat-textarea');
    ta.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 100) + 'px';
      document.getElementById('dchat-send').disabled = !this.value.trim() && !S.pendingFiles.length;
    });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    document.getElementById('dchat-topic-sel').addEventListener('change', function () {
      S.selectedTopic = this.value;
      var pill = document.getElementById('dchat-cur-topic');
      if (pill) pill.textContent = this.value;
    });
    document.getElementById('dchat-urgent-chk').addEventListener('change', function () {
      S.isUrgent = this.checked;
    });

    /* Greeting if no messages */
    if (S.messages.length === 0) {
      var greeting = {
        id: 'greeting-' + Date.now(),
        sender_role: 'support',
        content: 'Hi! Thanks for reaching out to THERASSISTANT Support. How can we help you today? Please select a topic and describe your question.',
        sent_at: new Date().toISOString(),
        message_type: 'text',
      };
      S.messages.push(greeting);
      saveLocal();
      renderMessages();
      /* Show typing animation briefly */
      showTypingIndicator();
      setTimeout(hideTypingIndicator, 2000);
    }

    scrollMessages();
    ta.focus();
  }

  function renderMessages() {
    var container = document.getElementById('dchat-msgs');
    if (!container) return;
    container.innerHTML = S.messages.map(function (m) { return msgHTML(m); }).join('');
    scrollMessages();
  }

  function msgHTML(m) {
    var isMe = m.sender_role === 'clinician';
    var isSystem = m.sender_role === 'system' || m.message_type === 'system' || m.message_type === 'ticket_created';
    var cls = isSystem ? 'system' : (isMe ? 'mine' : 'support');
    var initials = isMe ? ((S.user && S.user.email || 'Y')[0].toUpperCase()) : 'S';
    return [
      '<div class="dchat-msg ' + cls + '">',
        !isSystem ? '<div class="dchat-av ' + (isMe ? 'mine' : 'support') + '">' + esc(initials) + '</div>' : '',
        '<div class="dchat-msg-body">',
          '<div class="dchat-bubble">' + esc(m.content) + '</div>',
          m.file_name ? '<div class="dchat-attach-pill">📎 ' + esc(m.file_name) + '</div>' : '',
          !isSystem ? '<div class="dchat-msg-meta">' + (isMe ? 'You' : 'Support') + ' · ' + fmtTime(m.sent_at) + (isMe && m.read_at ? ' ✓✓' : (isMe ? ' ✓' : '')) + '</div>' : '',
        '</div>',
      '</div>',
    ].join('');
  }

  function appendMessageDOM(m) {
    var container = document.getElementById('dchat-msgs');
    if (!container) return;
    var div = document.createElement('div');
    div.innerHTML = msgHTML(m);
    container.appendChild(div.firstChild);
    scrollMessages();
    hideTypingIndicator();
  }

  function addSystemMessage(text) {
    var m = { id: uid(), sender_role: 'system', message_type: 'system', content: text, sent_at: new Date().toISOString() };
    S.messages.push(m);
    saveLocal();
    appendMessageDOM(m);
  }

  function scrollMessages() {
    var container = document.getElementById('dchat-msgs');
    if (container) container.scrollTop = container.scrollHeight;
  }

  function showTypingIndicator() {
    var container = document.getElementById('dchat-msgs');
    if (!container || document.getElementById('dchat-typing')) return;
    var div = document.createElement('div');
    div.className = 'dchat-typing';
    div.id = 'dchat-typing';
    div.innerHTML = '<div class="dchat-av support">S</div><div class="dchat-typing-bubbles"><span></span><span></span><span></span></div>';
    container.appendChild(div);
    scrollMessages();
  }

  function hideTypingIndicator() {
    var el = document.getElementById('dchat-typing');
    if (el) el.remove();
  }

  function renderTickets() {
    S.view = 'tickets';
    var tickets = [];
    try { tickets = JSON.parse(localStorage.getItem('docusistant_sc_tickets_v1') || '[]'); } catch (e) {}
    var userTickets = tickets.filter(function (t) { return !S.user || t.user_id === S.user.id || !t.user_id; });

    var content = document.getElementById('dchat-content');
    var listHTML = userTickets.length === 0
      ? '<div class="dchat-empty"><div class="dchat-empty-icon">🎉</div>No open support tickets</div>'
      : userTickets.slice(0, 10).map(function (t) {
          return [
            '<div class="dchat-tkt">',
              '<div class="dchat-tkt-id">' + esc(t.id) + '</div>',
              '<div class="dchat-tkt-subj">' + esc(t.subject || t.description || 'Support Request') + '</div>',
              '<div class="dchat-tkt-meta">',
                '<span class="dchat-spill ' + (t.status === 'Closed' ? 'dchat-spill-closed' : (t.is_urgent ? 'dchat-spill-urgent' : 'dchat-spill-open')) + '">' + esc(t.status || 'Open') + '</span>',
                esc(t.topic || ''),
                ' · ',
                fmtRelative(t.created_at),
              '</div>',
            '</div>',
          ].join('');
        }).join('');

    content.innerHTML = [
      '<div class="dchat-subhdr">',
        '<button class="dchat-back" id="dchat-back">‹</button>',
        '<span style="font-weight:700;color:#112538;font-size:13.5px">Open Tickets</span>',
      '</div>',
      '<div class="dchat-tkts">' + listHTML + '</div>',
    ].join('');
    document.getElementById('dchat-back').addEventListener('click', renderMenu);
  }

  function renderUpload() {
    S.view = 'upload';
    var content = document.getElementById('dchat-content');
    content.innerHTML = [
      '<div class="dchat-subhdr">',
        '<button class="dchat-back" id="dchat-back">‹</button>',
        '<span style="font-weight:700;color:#112538;font-size:13.5px">Upload Correspondence</span>',
      '</div>',
      '<div class="dchat-upload-view">',
        '<div class="dchat-upload-hdr">Share documents with Support</div>',
        '<div class="dchat-upload-sub">Upload billing documents and our team will review them within 1–2 business hours. Files are securely stored and only accessible to your assigned support staff.</div>',
        '<div class="dchat-drop-zone" id="dchat-upload-zone">',
          '<div class="dchat-drop-zone-icon">📁</div>',
          '<div class="dchat-drop-zone-lbl">Click or drag files here</div>',
          '<div class="dchat-drop-zone-sub">Supports: PDF, Images, Word documents<br>Maximum 20MB per file</div>',
        '</div>',
        '<div class="dchat-doc-chips">',
          ['EOB', 'Denial Letter', 'Recoupment Notice', 'Credentialing Letter',
           'Remittance Advice', 'Claim Form', 'Authorization', 'Other'].map(function (t) {
            return '<span class="dchat-doc-chip">' + esc(t) + '</span>';
          }).join(''),
        '</div>',
        '<div id="dchat-upload-file-chips" class="dchat-file-chips"></div>',
        '<button class="dchat-send" style="width:100%;border-radius:10px;height:40px;margin-top:4px" id="dchat-upload-send" disabled>',
          '<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:#fff;margin-right:6px"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg> Send to Support',
        '</button>',
      '</div>',
    ].join('');

    document.getElementById('dchat-back').addEventListener('click', renderMenu);
    document.getElementById('dchat-upload-zone').addEventListener('click', function () {
      document.getElementById('dchat-file-input').click();
    });
    document.getElementById('dchat-upload-send').addEventListener('click', function () {
      if (!S.pendingFiles.length) return;
      /* Move to chat with files queued */
      if (!S.selectedTopic) S.selectedTopic = 'General Question';
      renderChat();
      setTimeout(sendMessage, 200);
    });
  }

  function renderFaq() {
    S.view = 'faq';
    var content = document.getElementById('dchat-content');
    content.innerHTML = [
      '<div class="dchat-subhdr">',
        '<button class="dchat-back" id="dchat-back">‹</button>',
        '<span style="font-weight:700;color:#112538;font-size:13.5px">Frequently Asked Questions</span>',
      '</div>',
      '<div class="dchat-faq">',
        FAQS.map(function (f, i) {
          return [
            '<div class="dchat-faq-item" id="faq-item-' + i + '">',
              '<div class="dchat-faq-q" id="faq-q-' + i + '">' + esc(f.q) + '<span class="dchat-faq-arrow">▼</span></div>',
              '<div class="dchat-faq-a">' + esc(f.a) + '</div>',
            '</div>',
          ].join('');
        }).join(''),
        '<div style="padding-top:8px;text-align:center">',
          '<button class="dchat-menu-item" id="faq-chat-btn" style="display:flex;justify-content:center;font-size:13px;font-weight:700;color:#1a5f98;background:#eaf3fd;border-color:#3c90d1">',
            'Still have questions? Chat with support →',
          '</button>',
        '</div>',
      '</div>',
    ].join('');

    document.getElementById('dchat-back').addEventListener('click', renderMenu);
    FAQS.forEach(function (_, i) {
      document.getElementById('faq-q-' + i).addEventListener('click', function () {
        var item = document.getElementById('faq-item-' + i);
        item.classList.toggle('open');
      });
    });
    document.getElementById('faq-chat-btn').addEventListener('click', renderChat);
  }

  /* ══════════════════════════════════════════════════════════
     SEND MESSAGE
  ══════════════════════════════════════════════════════════ */
  async function sendMessage() {
    var ta = document.getElementById('dchat-textarea');
    var text = ta ? ta.value.trim() : '';
    if (!text && !S.pendingFiles.length) return;

    /* Ensure conversation exists */
    if (!S.conv) {
      var topic = S.selectedTopic || 'General Question';
      var dbConv = await createConversationInDb(topic, S.isUrgent);
      S.conv = dbConv || {
        id:       'local-' + Date.now(),
        topic:    topic,
        status:   'Open',
        priority: S.isUrgent ? 'Urgent' : 'Routine',
      };
      saveLocal();
      subscribeToMessages();
    }

    var now = new Date().toISOString();
    var msgs = [];

    /* File messages first */
    S.pendingFiles.forEach(function (f) {
      msgs.push({
        id:          uid(),
        sender_role: 'clinician',
        message_type: 'file',
        content:     '📎 Attached: ' + f.name,
        file_name:   f.name,
        sent_at:     now,
        is_urgent:   S.isUrgent,
      });
      /* Route to admin correspondence repository */
      routeFileToCorrRepository(f);
    });

    /* Text message */
    if (text) {
      msgs.push({
        id:          uid(),
        sender_role: 'clinician',
        message_type: 'text',
        content:     text,
        sent_at:     now,
        is_urgent:   S.isUrgent,
      });
    }

    msgs.forEach(function (m) {
      S.messages.push(m);
      appendMessageDOM(m);
      saveMessageToDb(m);
    });

    S.pendingFiles = [];
    saveLocal();
    renderFileChips();

    if (ta) { ta.value = ''; ta.style.height = 'auto'; }
    var sendBtn = document.getElementById('dchat-send');
    if (sendBtn) sendBtn.disabled = true;

    /* Show typing dots as if staff are responding */
    if (!S.staffOnline) {
      startSLATimer();
    } else {
      showTypingIndicator();
      /* Simulate read receipt after brief delay */
      clearSLATimer();
      startSLATimer();
    }
  }

  /* ══════════════════════════════════════════════════════════
     FILE HANDLING
  ══════════════════════════════════════════════════════════ */
  function handleFileSelect(files) {
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (f.size > 20 * 1024 * 1024) {
        alert('File "' + f.name + '" exceeds the 20MB size limit.');
        continue;
      }
      S.pendingFiles.push(f);
    }
    renderFileChips();
    var sendBtn = document.getElementById('dchat-send');
    if (sendBtn) sendBtn.disabled = (S.pendingFiles.length === 0);
  }

  /* ── Route uploaded file to admin correspondence repository ── */
  function inferCorrType(fileName) {
    var n = (fileName || '').toLowerCase();
    if (n.includes('eob') || n.includes('explanation'))           return 'EOB';
    if (n.includes('denial') || n.includes('denied'))             return 'Denial Letter';
    if (n.includes('appeal'))                                      return 'Appeal';
    if (n.includes('reconsider'))                                  return 'Reconsideration';
    if (n.includes('recoup'))                                      return 'Recoupment Notice';
    if (n.includes('refund'))                                      return 'Refund Request';
    if (n.includes('credenti'))                                    return 'Credentialing Letter';
    if (n.includes('record') || n.includes('medical'))            return 'Medical Records Request';
    if (n.includes('auth') || n.includes('prior'))                return 'Prior Authorization Notice';
    return 'Other';
  }

  function routeFileToCorrRepository(file) {
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var existing = JSON.parse(localStorage.getItem('docusistant_sc_corr_v1') || '[]');
        var meta     = S.user && S.user.user_metadata || {};
        var item = {
          id:           'CORR-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          fileName:     file.name,
          dataUrl:      ev.target.result,
          mimeType:     file.type,
          uploadedBy:   meta.full_name || (S.user && S.user.email) || 'Clinician',
          uploadedByEmail: S.user && S.user.email || '',
          uploadedByUserId: S.user && S.user.id || '',
          dateUploaded: new Date().toISOString(),
          uploadedAt:   new Date().toISOString(),
          source:       'chat-upload',
          provider:     meta.practice_name || '',
          client:       '',
          insurance:    '',
          type:         inferCorrType(file.name),
          relatedTicket:'',
          status:       'Pending Review',
          notes:        'Uploaded via support chat' + (S.selectedTopic ? ' (' + S.selectedTopic + ')' : ''),
        };
        existing.unshift(item);
        localStorage.setItem('docusistant_sc_corr_v1', JSON.stringify(existing));
      } catch (e) {}
    };
    reader.readAsDataURL(file);
  }

  function renderFileChips() {
    var container = document.getElementById('dchat-file-chips');
    if (!container) return;
    container.innerHTML = S.pendingFiles.map(function (f, i) {
      return '<span class="dchat-file-chip">' + esc(f.name.length > 20 ? f.name.slice(0, 18) + '…' : f.name) +
        '<button class="dchat-chip-rm" data-i="' + i + '" aria-label="Remove file">✕</button></span>';
    }).join('');
    container.querySelectorAll('.dchat-chip-rm').forEach(function (btn) {
      btn.addEventListener('click', function () {
        S.pendingFiles.splice(parseInt(this.getAttribute('data-i')), 1);
        renderFileChips();
      });
    });
  }

  /* ══════════════════════════════════════════════════════════
     PRESENCE UI
  ══════════════════════════════════════════════════════════ */
  function updatePresenceDot() {
    var dot  = document.getElementById('dchat-dot');
    var txt  = document.getElementById('dchat-presence-txt');
    var obar = document.getElementById('dchat-offline-bar');
    if (!dot || !txt) return;
    if (S.staffOnline) {
      dot.className  = 'dchat-dot online';
      txt.textContent = 'Support Online — Typically responds in minutes';
    } else {
      dot.className  = 'dchat-dot offline';
      txt.textContent = 'Support Offline — Responds within 2 business hours';
    }
    if (obar) {
      obar.style.display = S.staffOnline ? 'none' : '';
    }
  }

  /* ══════════════════════════════════════════════════════════
     BADGE
  ══════════════════════════════════════════════════════════ */
  function updateBadge() {
    var badge = document.getElementById('dchat-badge');
    if (!badge) return;
    if (S.unread > 0) {
      badge.style.display = 'flex';
      badge.textContent   = S.unread > 9 ? '9+' : S.unread;
    } else {
      badge.style.display = 'none';
    }
  }

  /* ══════════════════════════════════════════════════════════
     TOGGLE PANEL
  ══════════════════════════════════════════════════════════ */
  function openWidget() {
    S.isOpen = true;
    S.unread  = 0;
    updateBadge();
    var panel = document.getElementById('dchat-panel');
    if (panel) panel.classList.add('dchat-open');
    if (!document.getElementById('dchat-content').innerHTML) renderMenu();
    requestNotifPermission();
    updateUserPresence('online');
  }

  function closeWidget() {
    S.isOpen = false;
    var panel = document.getElementById('dchat-panel');
    if (panel) panel.classList.remove('dchat-open');
    updateUserPresence(document.hidden ? 'offline' : 'idle');
  }

  /* ══════════════════════════════════════════════════════════
     DRAG AND DROP
  ══════════════════════════════════════════════════════════ */
  function initDragDrop() {
    var panel   = document.getElementById('dchat-panel');
    var overlay = document.getElementById('dchat-drop-overlay');
    if (!panel || !overlay) return;

    panel.addEventListener('dragover', function (e) {
      e.preventDefault();
      overlay.classList.add('active');
    });
    panel.addEventListener('dragleave', function (e) {
      if (!panel.contains(e.relatedTarget)) overlay.classList.remove('active');
    });
    panel.addEventListener('drop', function (e) {
      e.preventDefault();
      overlay.classList.remove('active');
      if (e.dataTransfer && e.dataTransfer.files) {
        handleFileSelect(e.dataTransfer.files);
        if (S.view !== 'chat') renderChat();
      }
    });
  }

  /* ══════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════ */
  async function init() {
    if (S.initialized) return;
    S.initialized = true;

    injectCSS();
    buildDOM();
    initDragDrop();

    /* Load from localStorage immediately */
    loadLocal();

    /* Try to get auth user */
    var db = getClient();
    if (db) {
      try {
        var res = await db.auth.getUser();
        if (res && res.data && res.data.user) {
          S.user = res.data.user;
          S.selectedTopic = S.selectedTopic || 'General Question';
          loadLocal();
          await fetchOrCreateConversation();
          subscribeToPresence();
        }
      } catch (e) {
        /* Not authenticated — widget still works for FAQ/tickets */
      }
    }

    /* Bind main events */
    document.getElementById('dchat-btn').addEventListener('click', function () {
      S.isOpen ? closeWidget() : openWidget();
    });
    document.getElementById('dchat-close').addEventListener('click', closeWidget);

    document.getElementById('dchat-file-input').addEventListener('change', function () {
      handleFileSelect(this.files);
      this.value = '';
      if (S.view === 'upload') {
        var chips = document.getElementById('dchat-upload-file-chips');
        var btn   = document.getElementById('dchat-upload-send');
        if (chips) renderFileChips();
        if (btn) btn.disabled = !S.pendingFiles.length;
      } else if (S.view === 'chat') {
        renderFileChips();
        var sendBtn = document.getElementById('dchat-send');
        if (sendBtn) sendBtn.disabled = !S.pendingFiles.length && !document.getElementById('dchat-textarea').value.trim();
      }
    });

    /* Idle detection */
    var idleTimer = null;
    function resetIdle() {
      clearTimeout(idleTimer);
      if (S.user) updateUserPresence('online');
      idleTimer = setTimeout(function () {
        if (S.user) updateUserPresence('idle');
      }, 5 * 60 * 1000); /* 5 minutes */
    }
    ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(function (ev) {
      document.addEventListener(ev, resetIdle, { passive: true });
    });

    /* Page visibility change */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        updateUserPresence('idle');
      } else {
        updateUserPresence('online');
      }
    });

    /* Page unload */
    window.addEventListener('beforeunload', function () {
      updateUserPresence('offline');
      if (S.presenceChannel) S.presenceChannel.unsubscribe();
      if (S.realtimeChannel) S.realtimeChannel.unsubscribe();
    });

    /* Storage event: receive admin replies written to localStorage from another tab.
       This covers the localStorage-fallback path when Supabase is not yet configured. */
    window.addEventListener('storage', function (e) {
      if (!S.conv || e.key !== getConvKey() || !e.newValue) return;
      try {
        var d = JSON.parse(e.newValue);
        if (!d || !d.messages) return;
        var knownIds = {};
        S.messages.forEach(function (m) { knownIds[m.id] = true; });
        var added = false;
        d.messages.forEach(function (msg) {
          /* Only add messages from support/admin that we haven't seen yet */
          if (!knownIds[msg.id] && msg.sender_role !== 'clinician') {
            S.messages.push(msg);
            knownIds[msg.id] = true;
            added = true;
            if (S.view === 'chat') {
              appendMessageDOM(msg);
            }
            if (!S.isOpen || S.view !== 'chat') {
              S.unread++;
              updateBadge();
              showBrowserNotif('Support replied', msg.content.slice(0, 80));
            }
          }
        });
        if (added) {
          saveLocal();
          if (S.view === 'chat') scrollMessages();
        }
      } catch (e2) {}
    });

    /* If there are unread messages from a prior session, show badge */
    if (S.messages && S.messages.some(function (m) { return m.sender_role !== 'clinician' && !m.read_at; })) {
      S.unread = S.messages.filter(function (m) { return m.sender_role !== 'clinician' && !m.read_at; }).length;
      updateBadge();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Expose for debugging */
  window.THERASSISTANTChat = { state: S, open: openWidget, close: closeWidget, renderMenu: renderMenu };

})();
