# Collab Docs — v2

A Google Docs-style collaborative document editor with permission-based access, anonymous viewer tracking, and admin-controlled change reviews.

---

## How to run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Permission system

The app resolves your role from the URL `?role=` parameter on first load, then stores it in `sessionStorage`.

| Role | URL param | What you can do |
|------|-----------|-----------------|
| Admin | `?role=admin` | Edit directly, save without review, accept/reject proposals, see all viewer identities |
| Contributor (Editor) | `?role=edit` | Write changes and submit for admin review |
| Viewer | `?role=view` | Read-only, identity hidden from contributors |

**First visit with no `?role=` param defaults to Viewer.**

---

## Share links

Click **Share** in the topbar. The modal shows three links:

- **View link** — read-only, anonymous identity
- **Contributor link** — can submit changes for review
- **Admin link** — full control (share carefully)

---

## Architecture

```
src/
├── types/
│   └── index.ts                    — Permission, SessionUser, Writer, ChangeProposal, ViewerPresence…
│
├── utils/
│   ├── session.ts                  — resolveCurrentUser(), buildShareLinks(), buildWriterForUser()
│   ├── documentSession.ts          — getCurrentDocumentId()
│   ├── activityLog.ts              — createActivityEntry(), appendToLog()
│   ├── text.ts                     — formatBodyText(), countWords(), escapeHtml()
│   └── writers.ts                  — kept for CSS class compatibility (ADMIN_WRITER color)
│
├── hooks/
│   └── useCollaborativeDocument.ts — useReducer state machine; all business logic lives here
│
├── components/
│   ├── Topbar.tsx                  — Title bar with viewer count pill, permission badge, Share button
│   ├── EditorPanel.tsx             — Title + body editor with toolbar, save/submit button
│   ├── DocumentCanvas.tsx          — Read-only live document preview (center)
│   ├── CollaboratorsPanel.tsx      — Active editors, viewer count (identity gated by isAdmin)
│   ├── PendingChanges.tsx          — Admin-only proposal queue with accept/reject+note
│   ├── ActivityFeed.tsx            — Time-stamped action log
│   ├── ViewerBanner.tsx            — "You are viewing read-only" strip
│   └── ShareModal.tsx              — Three-link share sheet
│
├── styles/
│   └── global.css                  — All CSS: tokens, layout, components, responsive, print
│
├── App.tsx                         — Root — assembles everything, passes props
└── main.tsx                        — ReactDOM entry
```

### State machine (useReducer actions)

| Action | Who can dispatch |
|--------|-----------------|
| `UPDATE_DRAFT` | Admin + Contributors |
| `SAVE_DOCUMENT` | Admin only |
| `SUBMIT_PROPOSAL` | Contributors only |
| `ACCEPT_PROPOSAL` | Admin only |
| `REJECT_PROPOSAL` | Admin only |
| `UPSERT_VIEWER` | Viewers (self-register on mount) |
| `REMOVE_VIEWER` | Viewers (self-remove on unmount) |
| `SYNC_FROM_STORAGE` | Storage event handler (cross-tab sync) |

### Cross-tab sync

State (minus viewer sessions) is persisted to `localStorage` keyed by document ID. A `storage` event listener propagates changes made in other tabs. Viewer sessions are ephemeral (`sessionStorage`) and never persisted.

---

## Improvements made vs v1

- **`useReducer`** replaces nested `useState` spreads — all transitions are typed and testable
- **`React.memo`** on `ActivityFeed`, `CollaboratorsPanel`, `DocumentCanvas`, `PendingChanges`, `EditorPanel`
- **`useMemo`** for `wordStats`, `pendingProposals`, `writer` identity
- **Permission system** — view / edit / admin resolved from URL, stored in sessionStorage
- **Viewer privacy** — count shown to all; names shown only to admin
- **Share modal** — three typed links (view, edit, admin) with one-click copy
- **Reject with note** — admin can add a reason when rejecting a proposal
- **Proposal timestamps** — shown on each pending change card
- **Anonymous viewer names** — stable per-document ("Swift Penguin 1") generated on join
- **Print CSS** — `Ctrl+P` hides UI chrome, prints just the paper
- **Viewer mode layout** — slimmer left column with a placeholder instead of a blank panel
- **Dynamic writer identity** — each contributor gets a unique color derived from their session ID, supports unlimited contributors (not just Alice/Bob)
