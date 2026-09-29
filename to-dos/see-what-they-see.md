---
name: "See what they see: a live view of the GC's room (and the portal) while you work"
number: 62
group: ready
status: opened 2026-09-29 · the gating fix that prompted it shipped as v2.4169 · Layer 1 shipped v2.4174 (the reviewer's own headline under the rows, live as you edit) · Layer 2 (the pane) next
summary: >
  On Bids → Submittals the office edits rows and never sees what the GC or the architect will
  see until after sharing. The owner's ask (2026-09-29): "an active view of what they change and
  how it changes what the customer can see". Five layers, each usable on its own — a live
  sentence under Share, a side pane rendering the review room from the current draft, the
  package cover and the portal card the same way, a what-changed-for-them line after a share,
  and the sample views in What customers see — all rendered from the same kernels the real pages
  use, so a preview can never lie.
next: >
  Layer 2 (two PRs): "See what the GC sees" on the strip opens a side pane (a sheet on phones)
  that renders `SubmittalRoom`'s read-only view from the current draft through a client-side twin
  of get-submittal-room's payload kernel (`buildRoomPayload`), with a test pinning both to the same
  fixtures; the pane stays open and re-renders on every row edit.
size: M (Layer 1 S; Layer 2 M; Layers 3–5 S each)
blocker: none for Layers 1–2; Layer 3's portal card needs a job with a portal to verify live.
ver: v2.4174 (Layer 1)
opinion: soon — Wendi and Stephen are on the tab this week and first shares are coming; the pane is what teaches "why the reason matters" without a tour.
---

# See what they see

**The ask** (owner, 2026-09-29, with a screenshot of a fresh submittal): later stages invited clicks before stage 2 was done — fixed as v2.4169 — and "how can we present to the user an active view of what they change and how it changes what the customer can see?"

**The pieces already there**: `src/pages/SubmittalRoom.tsx` renders the reviewer's page from `get-submittal-room`'s payload; the package cover is built client-side (`buildCoverModel`, `renderCoverPdf`); Settings → *What customers see* shows customer-facing samples (v2.4138 for emails); Contracts has *Read it as the customer sees it* (v2.4098); the room records opens and who identified themselves; the rows carry *Since Rev N*.

**The principle**: every "as they see it" view renders from the same kernel the real page uses. A preview that can differ from the real thing is worse than none.

## The layers

1. **The sentence** (under the rows, live as you edit) — shipped v2.4174. *The GC's page will read: "1 row needs a call" — 3 rows match the plans and are marked approved. 1 differs — each says why. The GC sees nothing until you share.* `describeForReviewer(items, shared)` in `seeWhatTheySee.ts` runs the room's own kernel (`roomRowsFrom` → `roomCounts` → `roomHeadline` / `roomSubline`) on the draft, so the words are the reviewer's exact words, not a paraphrase.
2. **The pane** — *See what the GC sees* on the strip. Desktop: a side pane beside the road that stays open; phone: a sheet. It renders `SubmittalRoom`'s read-only view from the current draft — no room minted, nothing shared — through `buildRoomPayload` in `src/lib/submittals/`, a client-side twin of the edge function's kernel, with `roomPayload.test.ts` pinning both to the same fixtures (the function's kernel moves to `_shared/` if it is not already pure). Re-renders on every row edit; rows still owing something show exactly as the GC would see them. A *why* line at the top: *This is the page the GC opens from your link.*
3. **The package and the portal.** The cover PDF as a live thumbnail in the pane (its model is client-side already); for a job with a portal, the customer's submittal card the same way.
4. **What changed, for them** (after a share). *Dana opened Rev 2 on Sep 17. 4 rows changed since. She has not opened Rev 3.* From the room's opens and the Since-Rev column; sits under Their call.
5. **One place to learn it without a bid.** *What customers see* gains the review room and the portal card on the sample bid; the strip's door links there when the bid has nothing to show yet.

## Decisions (taken 2026-09-29)

- The pane is a split view that stays open while editing, not a modal — that is the "active" part. A sheet on phones.
- The GC's review room first; the portal card in Layer 3.

## Gates

Layer 1: the sentence on BP398 changes as a row's reason is added. Layer 2: on BP398, the pane shows the same rows the real room shows for the shared Rev 2 (open both side by side); edit a draft row and watch the pane follow; the payload test pins client and function to the same fixtures.
