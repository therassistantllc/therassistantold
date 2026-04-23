/**
 * support/chat-widget.js
 * Safer client-only support widget.
 *
 * Differences from legacy version:
 * - no file content persistence in localStorage
 * - no direct ticket creation in browser
 * - backend endpoints own uploads and ticket creation
 *
 * Expected globals:
 *   window.__THERA_SUPPORT__ = {
 *     uploadEndpoint: "/api/support/uploads",
 *     conversationEndpoint: "/api/support/conversations",
 *     ticketEndpoint: "/api/support/tickets"
 *   }
 */
(function (global) {
  'use strict';

  var state = {
    open: false,
    topic: '',
    draft: '',
    pendingFiles: []
  };

  function cfg() {
    return Object.assign({
      uploadEndpoint: '/api/support/uploads',
      conversationEndpoint: '/api/support/conversations',
      ticketEndpoint: '/api/support/tickets'
    }, global.__THERA_SUPPORT__ || {});
  }

  function esc(value) {
    return global.TheraShared ? global.TheraShared.esc(value) : String(value || '');
  }

  function root() {
    return global.document.getElementById('thera-chat-widget');
  }

  function render() {
    var host = root();
    if (!host) return;
    host.innerHTML = [
      '<div class="ta-chat-shell">',
      '<button type="button" class="ta-chat-toggle">Support</button>',
      state.open ? (
        '<div class="ta-chat-panel">' +
          '<label>Topic <input class="ta-chat-topic" value="' + esc(state.topic) + '"></label>' +
          '<label>Message <textarea class="ta-chat-draft">' + esc(state.draft) + '</textarea></label>' +
          '<label>Files <input type="file" class="ta-chat-files" multiple></label>' +
          '<div class="ta-chat-actions">' +
            '<button type="button" class="ta-chat-send">Send</button>' +
            '<button type="button" class="ta-chat-ticket">Create ticket</button>' +
          '</div>' +
        '</div>'
      ) : '',
      '</div>'
    ].join('');

    bind();
  }

  function bind() {
    var host = root();
    if (!host) return;

    var toggle = host.querySelector('.ta-chat-toggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        state.open = !state.open;
        render();
      });
    }

    var topic = host.querySelector('.ta-chat-topic');
    if (topic) {
      topic.addEventListener('input', function (event) {
        state.topic = event.target.value;
      });
    }

    var draft = host.querySelector('.ta-chat-draft');
    if (draft) {
      draft.addEventListener('input', function (event) {
        state.draft = event.target.value;
      });
    }

    var files = host.querySelector('.ta-chat-files');
    if (files) {
      files.addEventListener('change', function (event) {
        state.pendingFiles = Array.prototype.slice.call(event.target.files || []);
      });
    }

    var send = host.querySelector('.ta-chat-send');
    if (send) send.addEventListener('click', sendMessage);

    var ticket = host.querySelector('.ta-chat-ticket');
    if (ticket) ticket.addEventListener('click', createTicket);
  }

  async function uploadFiles() {
    var endpoints = cfg();
    if (!state.pendingFiles.length) return [];

    var form = new FormData();
    state.pendingFiles.forEach(function (file) { form.append('files', file); });

    var response = await fetch(endpoints.uploadEndpoint, {
      method: 'POST',
      body: form,
      credentials: 'include'
    });

    if (!response.ok) throw new Error('Upload failed');
    var data = await response.json();
    return Array.isArray(data.files) ? data.files : [];
  }

  async function sendMessage() {
    var endpoints = cfg();
    var files = await uploadFiles();

    var response = await fetch(endpoints.conversationEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        topic: state.topic,
        message: state.draft,
        attachments: files
      })
    });

    if (!response.ok) throw new Error('Send failed');

    state.draft = '';
    state.pendingFiles = [];
    render();
  }

  async function createTicket() {
    var endpoints = cfg();

    var response = await fetch(endpoints.ticketEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        topic: state.topic,
        description: state.draft
      })
    });

    if (!response.ok) throw new Error('Ticket creation failed');
  }

  global.TheraChatWidget = Object.freeze({
    render: render
  });

  if (global.TheraShared) {
    global.TheraShared.onReady(render);
  } else {
    global.document.addEventListener('DOMContentLoaded', render, { once: true });
  }
})(window);
