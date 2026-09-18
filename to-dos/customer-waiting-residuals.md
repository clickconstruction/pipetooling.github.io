---
name: "Customer Waiting: three wording calls"
group: gated
status: >
  the eligibility hook shipped v2.3434 · Hide for me v2.3524 · the `tel:` sweep v2.3571 (34 links,
  one sanitizer, a re-runnable codemod) · left: three wording / policy decisions, each one constant
summary: >
  Callback-promise wording, sub-portal priority, auto-lower overnight — three owner decisions.
  The code side is done: the eligibility hook, the per-caller mute and the `tel:` sweep.
next: The three answers; each is one string or one flag.
size: XS once decided
blocker: Three decisions are yours.
ver: hook v2.3434 · hide for me v2.3524 · sweep v2.3571
opinion: your call — the callback promise is the only one customers read; say what the office can keep and it is one string.
mockup: not required — three constants — no screen changes
---

# Customer Waiting — residuals

## The ask, in the owner's words

"When a customer sends a request it should be a high priority request in the dispatch or estimator inbox … a banner at the top of the page following them around the app … if they downgrade the request it should remove the high priority status … messages from customer portals should offer a phone number button to call the customer right away." Shipped in full. What follows is what the build and the review deferred.

## Decisions still waiting on the owner

- **The callback promise on the portal's sent state.** It reads *We'll call you at (number) as soon as we can during office hours.* The mockup proposed *within the hour, weekdays 7–5*; the office never said what it can keep. One string in `CustomerPortal.tsx` → `RequestCard` sent state.
- **Sub-portal requests** (`submit-sub-portal`) stay `normal`. If a sub's *availability* or *decline* should ever shout, set `priority: 'high'` in that function the same way.
- **Auto-lower overnight?** Nothing lowers itself; a person acts. If a request left high past close of business should calm on its own, a cron on `priority_changed_at`/`created_at` is the place.

## Follow-ups the build noted

- ~~**Mute for the caller.**~~ Shipped v2.3524: on the called state the caller alone gets *Hide for me* — hides the strip on their device (`localStorage`, per viewer), never for the team; the row stays open, and a later call by someone else brings the strip back. `canHideForMe` / `rowsVisibleToViewer` in `customerWaiting.ts`.
- ~~**Shared call button sweep.**~~ Shipped v2.3571: 34 links in 25 files read `telHrefFor` through `scripts/codemods/tel-href-sweep.mjs` (re-runnable).
- **Squash titles.** The merge queue titled PR #2968's squash commit with the branch name; the release note carries the version, but `git log` on main reads "claude/customer waiting 2 inbox".

## How to verify

Headless Playwright from `node_modules/.scratch/*.mjs` against a worktree dev server with `/dev-login` (the in-app Browser pane can go hidden → zero-size viewport). A hand-filed Task Dispatch request has no portal payload; insert a portal-shaped `dispatch_requests` row as yourself (`priority: 'high'`, `pending_payload: { source: 'portal', kind: 'visit', customerName, description, phone, phoneSource }`) to exercise Call, or send one real request through the deployed `submit-portal-request` with the "ZZ Split Test Claude" portal link (fires push to the dispatch group + the portal email stream). Close and dismiss the rows when done.
