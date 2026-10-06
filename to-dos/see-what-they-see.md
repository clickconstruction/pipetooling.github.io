---
name: "See what they see: a live view of the GC's room (and the portal) while you work"
number: 62
group: close
status: DONE 2026-10-05 — the five pieces shipped: v2.4593 (the line and the window say what the link shows), v2.4595 (the sample through the room's kernel, deployed), v2.4599 (the room refuses the office's session and the preview, deployed), v2.4606 (the page's own header and chips in the window), v2.4608 (the door to the real page in preview; the "What customers see" rule in GLOSSARY) · Layers 3 and 4 dropped by the owner 2026-10-06 · the emailed-revision question went to its own build (Helper 8, 2026-10-06)
summary: >
  On Bids → Submittals the office edits rows and never sees what the GC or the architect will
  see until after sharing. The owner's ask (2026-09-29): "an active view of what they change and
  how it changes what the customer can see". Five layers, each usable on its own — a live
  sentence under Share, a side pane rendering the review room from the current draft, the
  package cover and the portal card the same way, a what-changed-for-them line after a share,
  and the sample views in What customers see — all rendered from the same kernels the real pages
  use, so a preview can never lie.
next: >
  Nothing to build here. Two follow-ons live elsewhere: a revision answered by email landing in
  the GC's room (its own PR, from the dated findings below), and the other hand-built samples in
  What customers see (the bid room, the customer portal) built through their kernels, a new row.
  Delete this folder once the emailed-revision PR has merged.
size: M (Layer 1 S; Layer 2 M; Layers 3–5 S each)
blocker: None.
ver: v2.4174 · 4187 · 4189 · 4593 · 4595 · 4599 · 4606 · 4608
opinion: soon — Wendi and Stephen are on the tab this week and first shares are coming; the pane is what teaches "why the reason matters" without a tour.
---

# See what they see

**The ask** (owner, 2026-09-29, with a screenshot of a fresh submittal): later stages invited clicks before stage 2 was done — fixed as v2.4169 — and "how can we present to the user an active view of what they change and how it changes what the customer can see?"

**The pieces already there**: `src/pages/SubmittalRoom.tsx` renders the reviewer's page from `get-submittal-room`'s payload; the package cover is built client-side (`buildCoverModel`, `renderCoverPdf`); Settings → *What customers see* shows customer-facing samples (v2.4138 for emails); Contracts has *Read it as the customer sees it* (v2.4098); the room records opens and who identified themselves; the rows carry *Since Rev N*.

**The principle**: every "as they see it" view renders from the same kernel the real page uses. A preview that can differ from the real thing is worse than none.

## The layers

1. **The sentence** (under the rows, live as you edit) — shipped v2.4174. *The GC's page will read: "1 row needs a call" — 3 rows match the plans and are marked approved. 1 differs — each says why. The GC sees nothing until you share.* `describeForReviewer(items, shared)` in `seeWhatTheySee.ts` runs the room's own kernel (`roomRowsFrom` → `roomCounts` → `roomHeadline` / `roomSubline`) on the draft, so the words are the reviewer's exact words, not a paraphrase.
2. **The pane** — *See what the GC sees* on the strip — shipped v2.4187 (the room's rows as `RoomRevisionBody`, read-only capable) + v2.4189 (`SeeWhatTheGcSees`: a 400px pane beside the road on a desktop, a sheet on a phone; `roomRowsFrom` → `roomCounts` on the draft; nothing minted). Desktop: a side pane beside the road that stays open; phone: a sheet. It renders `SubmittalRoom`'s read-only view from the current draft — no room minted, nothing shared — through `buildRoomPayload` in `src/lib/submittals/`, a client-side twin of the edge function's kernel, with `roomPayload.test.ts` pinning both to the same fixtures (the function's kernel moves to `_shared/` if it is not already pure). Re-renders on every row edit; rows still owing something show exactly as the GC would see them. A *why* line at the top: *This is the page the GC opens from your link.*
3. **The package and the portal.** ~~The cover PDF as a live thumbnail in the pane; for a job with a portal, the customer's submittal card the same way.~~ Dropped 2026-10-06 (the owner): the pane became a window (v2.4358), so nothing in it is live as you edit, and Build → Open package already gives the exact PDF; the portal carries no submittal data, so a card would be a new feature, not a preview. A sample package cover in What customers see is the one piece worth its own row.
4. ~~**What changed, for them** (after a share).~~ Dropped 2026-10-06 (the owner): rooms have two view events ever, both test opens, so the line would read "not opened" for everyone; Their call (v2.4560) already says who answered and when. Revisit if rooms get real traffic. *Dana opened Rev 2 on Sep 17. 4 rows changed since. She has not opened Rev 3.* From the room's opens and the Since-Rev column; sits under Their call.
5. **One place to learn it without a bid.** *What customers see* gains the review room and the portal card on the sample bid; the strip's door links there when the bid has nothing to show yet.

## Decisions (taken 2026-09-29)

- The pane is a split view that stays open while editing, not a modal — that is the "active" part. A sheet on phones.
- The GC's review room first; the portal card in Layer 3.

## Gates

Layer 1: the sentence on BP398 changes as a row's reason is added. Layer 2: on BP398, the pane shows the same rows the real room shows for the shared Rev 2 (open both side by side); edit a draft row and watch the pane follow; the payload test pins client and function to the same fixtures.

## 2026-10-05 · findings (helper 5, directed by PUNCHLIST)

A re-read of Layers 1 and 2 on main after a week of Submittals work (the tab split v2.4499–v2.4504, parts and per-part calls v2.4319 / v2.4322, *GC sees it · Order only · Left out* v2.4439, the window v2.4358, the GC's words v2.4482, Their call v2.4560). Proposals below wait on the owner; the layers above are unchanged until he answers.

- **The rows were right; the words about the link were not.** Both views run `roomRowsFrom` → `roomCounts`. Order-only rows drop in `gcRoomItems`, order-only parts in `roomPartsFrom`, and a left-out fixture or part never becomes a row. But on BP398, a Rev 4 draft over a shared Rev 2, both said *The GC sees nothing until you share* while Dana's link showed Rev 2. A closed room still read *That is what the link shows now*. Fixed in v2.4593.
- **The window's chrome is a hand copy of the page's.** It reads *Product review · Rev 4* where the page says *Product review*. It has no revision chips, no procurement card and no PDF line. Proposed next (PR 1b): the page's own header and chips, and a door to the real page in preview once PR 1c is deployed.
- **Layer 3 as written.** The customer portal carries no submittals: `customer-portal` and `CustomerPortal.tsx` read bills, stages, test reports, papers, lien releases and notices, nothing from `bid_submittal_*`. So there is no portal card to preview. The cover thumbnail was planned for a pane beside the rows, and the window covers them now. *Build package* then *Open package* on a draft is already the exact PDF, and `open-submittal-pdf` never serves an unshared revision. Proposed: drop both halves.
- **Layer 4.** As the office sees them, the app holds 2 review rooms and 2 view events ever, both anonymous test opens on BP398 (Sep 16). Submittals go out as the package PDF by email and the answers are typed in. Their call (v2.4560) and the Share step's trail already say who answered and when they opened. Proposed: drop until the rooms see real traffic.
- **Layer 5.** What customers see has carried the review room since v2.3511. But `sampleSubmittalRoomResponse` writes its rows by hand, so the sample says things the real room cannot. A to-follow row reads *Not in our scope — by others.* and one row gives two reasons. It also predates parts, per-part calls and the proposed card. Proposed (PR 2): build the sample through `roomRowsFrom`; it ships with a `get-submittal-room` redeploy.
- **Left open on purpose by v2.4595 (the sample through the kernel).** The sample room still says *The PDF is on its way* (`hasPackage: false`), while its card on What customers see promises *download the package*. That waits on the owner's call on a sample package cover (PR 3), not a link to nothing. The sample also has no procurement card, which a real room shows once anything is approved.
- **A defect on a real bid, for the owner (not fixed here).** BP398's Rev 3 was answered by email and typed in on Oct 2, and never shared. `get-submittal-room` serves only revisions with a share date, so the room has no Rev 3. Once Rev 4 is shared, the GC's page lists Rev 4 and Rev 2. Its procurement card was traced read only, by running `SubmittalRoom.tsx`'s own `ProcurementCard` steps on BP398's rows and log as if Rev 4 were shared:
  - Kitchen sinks (ordered Oct 1) and Toilets (ordered Sep 30) are not on it at all. `buildProcurementLog` keeps a tagged record only when a row in the room carries its tag, and no shared revision carries those two.
  - It shows WC-1 alone, standing on Rev 2: the fixture's line *ordered*, CT728CUVG *released*, TET1LA32 *sent back*. Rev 3 records WC-1 approved, so the GC's card contradicts the office's record.
  - Nothing on BP398 was shared or changed to find this.
- **The room's writes trust the token alone.** `get-submittal-room` already refuses to count an office open, on the preview flag or a verified session. But `submit-submittal-review` never reads either. So an office user in a signed-in browser can identify on a GC's link, ask, and decide, and the room records a GC answer nobody at the GC gave. Fixed in v2.4599 (PR 1c, before the door): the function refuses identify, ask and decide from a verified office session or the preview flag, with a plain reason the page shows.
- **How the office learns what a customer sees, app wide.** There are three ways: the real page in preview wherever the record exists; a draft drawn only through the page's own components; samples built only through the real kernels, never by hand. Its one home lands with PR 1b.

## 2026-10-05 · What the room's office guard is not (v2.4599)

The guard refuses a write from a verified office session or the office's preview. It is not a wall, and two limits are design, accepted by PUNCHLIST:

- **A private window is an outsider.** The link and a self-given name are the room's credential (decision 6). Nothing on the server can tell an office person on another device, or in a window with no session, from the architect.
- **An unverifiable token fails open.** A token the auth server cannot resolve reads as no session. That protects real reviewers, who never send one, and it means a staff browser whose session cannot be checked is treated as an outsider.
- **The case to watch:** a company person reviewing for a building the company itself owns or builds. They enter the answer from the Submittals tab under their own name, or open the link in a private window as any reviewer would. On 2026-10-05 none of the four people named on review rooms was a company account.

