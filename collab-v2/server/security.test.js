import assert from "node:assert/strict";
import test from "node:test";

process.env.API_SECRET = "test-secret";

const {
  createShareTokens,
  getAccessRole,
  normalizeMetadata,
  safeEqual,
  sanitizeHtml,
  sanitizeState,
} = await import("./index.js");

function req(headers = {}) {
  return { headers };
}

test("share tokens resolve roles without trusting URL role parameters", () => {
  const metadata = normalizeMetadata({
    documentId: "doc-1",
    creatorId: "creator",
    creatorName: "Creator",
    createdAt: "2026-05-15T00:00:00.000Z",
    admins: ["creator"],
    shareTokens: createShareTokens(),
  });

  assert.equal(getAccessRole(req({ "x-access-token": metadata.shareTokens.admin }), metadata), "admin");
  assert.equal(getAccessRole(req({ "x-access-token": metadata.shareTokens.edit }), metadata), "edit");
  assert.equal(getAccessRole(req({ "x-access-token": metadata.shareTokens.view }), metadata), "view");
  assert.equal(getAccessRole(req({ "x-access-token": "not-a-real-token" }), metadata), null);
  assert.equal(getAccessRole(req({ role: "admin" }), metadata), null);
});

test("metadata normalization backfills tokens and admin member records", () => {
  const metadata = normalizeMetadata({
    documentId: "doc-1",
    creatorId: "creator",
    creatorName: "Creator",
    createdAt: "2026-05-15T00:00:00.000Z",
    admins: ["creator", "admin-2"],
  });

  assert.ok(metadata.shareTokens.view);
  assert.ok(metadata.shareTokens.edit);
  assert.ok(metadata.shareTokens.admin);
  assert.deepEqual(metadata.adminMembers.map((admin) => admin.sessionId), ["creator", "admin-2"]);
  assert.equal(metadata.adminMembers[0].isCreator, true);
});

test("sanitizer removes active content before persistence", () => {
  const dirty = `<p onclick="alert(1)">Hi</p><script>alert(1)</script><img src="javascript:alert(1)"><iframe src="x"></iframe>`;
  const clean = sanitizeHtml(dirty);

  assert.equal(clean.includes("<script"), false);
  assert.equal(clean.includes("onclick"), false);
  assert.equal(clean.includes("javascript:"), false);
  assert.equal(clean.includes("<iframe"), false);
  assert.equal(clean.includes("<p"), true);
});

test("document state sanitization covers document, drafts, and proposals", () => {
  const state = sanitizeState({
    document: { title: "A".repeat(400), body: "<p onmouseover='x'>Body</p>" },
    drafts: {
      writer: { title: "Draft", body: "<script>x</script><p>Draft</p>" },
    },
    proposals: [
      { id: "p1", draft: { title: "Proposal", body: "<iframe></iframe><p>Proposal</p>" } },
    ],
    viewers: [{ sessionId: "viewer" }],
  });

  assert.equal(state.document.title.length, 300);
  assert.equal(state.document.body.includes("onmouseover"), false);
  assert.equal(state.drafts.writer.body.includes("<script"), false);
  assert.equal(state.proposals[0].draft.body.includes("<iframe"), false);
  assert.deepEqual(state.viewers, []);
});

test("constant-time equality helper only accepts exact matches", () => {
  assert.equal(safeEqual("secret", "secret"), true);
  assert.equal(safeEqual("secret", "SECRET"), false);
  assert.equal(safeEqual("secret", "secret-longer"), false);
});
