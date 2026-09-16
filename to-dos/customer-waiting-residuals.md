---
name: "Customer Waiting: the tel: sweep and the mute"
group: ready
status: >
  the eligibility hook shipped v2.3434 · left: the `tel:` sweep, the caller mute, three wording
  decisions
summary: >
  Callback-promise wording, sub-portal priority, auto-lower overnight (owner decisions);
  per-caller mute, one eligibility hook, the shared `tel:` sweep.
next: "The tel: sweep as one script-driven PR cut from fresh main."
size: M + S
blocker: None for the sweep; three decisions are yours.
ver: hook shipped v2.3434
---

# Customer Waiting — residuals

## The ask, in the owner's words

"When a customer sends a request it should be a high priority request in the dispatch or estimator inbox … a banner at the top of the page following them around the app … if they downgrade the request it should remove the high priority status … messages from customer portals should offer a phone number button to call the customer right away." Shipped in full. What follows is what the build and the review deferred.

## Decisions still waiting on the owner

- **The callback promise on the portal's sent state.** It reads *We'll call you at (number) as soon as we can during office hours.* The mockup proposed *within the hour, weekdays 7–5*; the office never said what it can keep. One string in `CustomerPortal.tsx` → `RequestCard` sent state.
- **Sub-portal requests** (`submit-sub-portal`) stay `normal`. If a sub's *availability* or *decline* should ever shout, set `priority: 'high'` in that function the same way.
- **Auto-lower overnight?** Nothing lowers itself; a person acts. If a request left high past close of business should calm on its own, a cron on `priority_changed_at`/`created_at` is the place.

## Follow-ups the build noted

- **Mute for the caller.** The banner is deliberately undismissable; the "called" state is the answer to a five-person group all seeing it. If that is still too loud, the next lever is hiding the strip for the viewer who made the call (they have the row open), never a dismiss. `CustomerWaitingBanner` + `last_called_by_user_id`.
- **Shared call button sweep.** `CallPhoneButton` + `phoneContact.ts` are the first shared `tel:` affordance; ~35 hand-rolled `tel:` links with five sanitizers remain (Customers, Prospects, Bids call queue, People). Mechanical sweep — merge alone per CLAUDE.md.
- **Squash titles.** The merge queue titled PR #2968's squash commit with the branch name; the release note carries the version, but `git log` on main reads "claude/customer waiting 2 inbox".

## How to verify

Headless Playwright from `node_modules/.scratch/*.mjs` against a worktree dev server with `/dev-login` (the in-app Browser pane can go hidden → zero-size viewport). A hand-filed Task Dispatch request has no portal payload; insert a portal-shaped `dispatch_requests` row as yourself (`priority: 'high'`, `pending_payload: { source: 'portal', kind: 'visit', customerName, description, phone, phoneSource }`) to exercise Call, or send one real request through the deployed `submit-portal-request` with the "ZZ Split Test Claude" portal link (fires push to the dispatch group + the portal email stream). Close and dismiss the rows when done.
