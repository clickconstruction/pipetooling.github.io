---
name: What customers see — residuals
group: residual
status: >
  the nine-PR train shipped 2026-09-16 (v2.3505–v2.3513, all live, functions deployed, migration
  pushed) · three small leftovers and one real bug the tab exposed (the firm's confirm page
  renders as raw HTML)
summary: >
  What the What-customers-see train left: a full sample matter on the law firm's portal (today the
  sample is the portal before its first matter), the signed-copy agreement email as its own step,
  the Job window's *Their journey* door (the Customer page has it), and **a real bug**: the firm's
  confirm / unsubscribe pages are served as `text/plain` by the platform and render as raw HTML.
next: >
  Any of the three in a quiet hour; the firm's sample matter is the largest (a fixture that
  satisfies `parseLegalPortalPayload`).
size: S each
blocker: >
  None.
ver: shipped 09-16
---

# What customers see — residuals

The train in `what-customers-see-journeys/` (deleted at the shipping commit; the mock-up and the data map live in git history there, and the release notes v2.3505–v2.3513 carry the record) left three small things:

1. **A full sample matter on the firm's portal.** `sampleLegalPortalResponse` returns the firm, its recipients and no matters. A sample matter needs a fixture that satisfies `parseLegalPortalPayload` (a job with invoices and payments, a contact, an agreement, a demand letter) — half a day.
2. **The signed-copy agreement email as its own step.** `share-job-contract` emails the signed PDF; the builder `signedAgreementEmail.ts` is already client-side. Today it is folded into the *Signed* step's note.
3. **The Job window's *Their journey* door.** The Customer page has the panel (v2.3508); `DetailJobModal` could show the same strips filtered to that job.
4. **The firm's confirm / unsubscribe pages render as raw HTML (bug, found 2026-09-16 by v2.3518).** `legal-notify-dispatch` answers `GET ?confirm=<token>` and `?unsubscribe=<token>` with `Content-Type: text/html`, but the platform serves the response as `content-type: text/plain; x-content-type-options: nosniff` (a JSON function's `application/json` passes through — verified with curl on prod). Every recipient who clicked *Yes, email me* since v2.3405 saw the page source; the confirmation itself still recorded, so the emails flow. Fix: serve the two pages from the app (a public route such as `/legal/confirm?t=` and `/legal/unsubscribe?t=` that POSTs the token to the function and shows the same `legalConfirmedPageBody` / `legalUnsubscribedPageBody` from `_shared/legalEmails.ts`), then point the links in `submit-legal-portal` and `legalWrapHtml` at them. `job-share`'s OG card may have the same problem — check a real share link's headers.
