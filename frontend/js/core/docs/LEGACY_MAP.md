# Revised JS package legacy map

## Keep / replace with canonical files
- `shared.js` -> `core/shared.js`
- `auth-guard.js` -> `core/auth-guard.js`
- `permissions.js` -> `core/permissions.js`
- `sidebar.js` -> `nav/sidebar.js`
- `admin-ops.js` -> `support/admin-ops.js`
- `chat-widget.js` -> `support/chat-widget.js`
- `note-engine.js` -> `notes/note-engine.js`
- `phrase-library.js` -> `notes/phrase-library.js`
- `signal-library.js` -> `notes/signal-library.js`
- `signal-parser.js` -> `notes/signal-parser.js`

## Deprecate / delete after migration
- `admin-sidebar.js`
- `clinician-sidebar.js`
- `sidebar-nav.js`
- `app.js`

## Merge rules
- Role and permission truth must live in `core/permissions.js`
- Page/session guard must live in `core/auth-guard.js`
- Sidebar UI must live in `nav/sidebar.js`
- Signal dictionary must live in `notes/signal-library.js`
- Signal parsing must consume the signal library, not redefine it
- Chat uploads and ticket creation must be backend-owned
