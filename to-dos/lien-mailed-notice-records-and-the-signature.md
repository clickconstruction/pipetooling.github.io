---
name: "Lien desk: a record on a mailed notice makes its signature read as gone"
number: 370
group: residual
status: found 2026-11-16 while building Sign it again · nothing built · the owner put it here for a later session
summary: >
  A lien notice's signature is tied to the notice by a hash of the whole of its `fields`. Four records the
  desk writes into a mailed notice's `fields` (a promise, the owner's call, the GC's okay, a courtesy notice)
  change that hash, so the signature then reads as gone. Nothing on screen reads a mailed notice's signature
  today, so nobody sees it yet. It is a trap for the first screen that does.
next: Pick one of the three fixes below (the card recommends the first) and build it as one PR, before any screen shows a mailed notice's signature.
size: S (one PR, no migration)
blocker: None. It needs a careful test, since the rule decides whether a legal paper is signed.
mockup: not required — the fix changes a rule and no screen
opinion: later — nothing reads a mailed notice's signature today, so build it with, or just before, the first screen that does
ver: v2.7491 · 7502 · 7503
---

# Lien desk: a record on a mailed notice makes its signature read as gone (#370)

## The ask

Found by the session that built *Sign it again* (v2.7502) and the take-back that clears a signature (v2.7503).
It was put to the owner as the one piece left open. His answer, 2026-11-16: *"add the promise to the
punchlist, we'll have someone else build it later"*.

## What is wrong

- A signature is ten columns on `job_lien_desk_items`. One of them, `signed_fields_hash`, is the hash of the
  notice's `fields` at signing (`lienFieldsHash`, in `supabase/functions/_shared/lienFieldsHash.ts` since
  v2.7491, re-exported by `src/lib/jobs/lienNoticeSignature.ts`).
- The hash covers the **whole** of `fields`. `lienRowUnsigned` and `lienSignatureStale` call a notice
  unsigned when the stored hash no longer matches. That is right for an edit to the paper.
- The desk also keeps its own records in `fields`, and four of them are written on a notice that has already
  been **mailed** (the first packet's sent item):
  - `fields.promise`: `notePromiseOnNotice` in `src/lib/jobs/lienDeskIo.ts` (`withPromiseRecord`,
    `PROMISE_FIELDS_KEY`).
  - `fields.ownerCall`: `noteOwnerCall`, same file.
  - `fields.gcAuthorizedDirectPay`: `noteGcAuthorizedDirectPay`, same file.
  - `fields.courtesy`: `writeCourtesyRecord` in `src/lib/jobs/lienCourtesyIo.ts` (`withCourtesyRecord`,
    `COURTESY_FIELDS_KEY`).
- None of the four changes what the mailed paper said. Each changes the hash. So a mailed, signed notice
  that gains one of them reads as unsigned from then on, with its signature columns still on the row.

## Why nobody sees it today

Every reader of a notice's signature looks only at an **approved** notice: the Ready and Printed footers and
the paper in `LienDesk.tsx`, the run (`runNoticeSignature` in `lienDeskRun.ts`), the Board and To do
(`lienItemUnsigned`), and the leader's reminder (`lienApprovalPush.ts`, which stops at `status = approved`).
The desk's pane draws no signature at all for a sent notice: its `item` is null once the status is `sent`.

So the stale hash has no symptom yet. It becomes one the day a screen shows a mailed notice's signature: the
sent pane drawing the paper as it went, a reprint of a mailed notice from its desk item, a legal packet that
prints the signing record. The first electronically signed run was printed on 2026-11-16, so signed, mailed
notices exist from about then.

## Already settled, do not reopen

- **A take-back clears the signature on purpose** (v2.7503, the owner's call: *"I like the idea of wiping
  the signature when it is sent back"*). `fields.runTakenBack` and `fields.signatureCleared` are written in
  the same update that clears the signature columns, so they never meet a standing signature. The same holds
  for `fields.redrawn` (the redraw from the bills). Leave those three inside the hash.
- **A closed paid notice** (`fields.runClosedPaid`) is set aside in the same write. It does not matter.

## Three ways to fix it

1. **The hash leaves the four record keys out** (recommended). In `lienFieldsHash`, drop the top-level keys
   `promise`, `ownerCall`, `gcAuthorizedDirectPay` and `courtesy` before hashing. A list of record keys, never
   a list of printed keys: an unknown key stays covered, so a new field on the paper still voids a signature.
   One form is enough if no signed notice held one of the four keys at signing. Check that first, read only:
   every row with `signed_at` set, and whether its `fields` held any of the four before that instant. If one
   did, also honour the old whole-`fields` hash so no signed notice flips.
2. **A mailed notice is never asked.** Staleness applies while a notice can still change. Once `status` is
   `sent`, its signature is what went. This needs the status at each reader, and the rule lives in more than
   one place.
3. **The records move out of `fields`.** A column or a table of their own. Cleanest, and it needs a migration
   and a change to every reader of the four records (`lienCourtesyNotice.ts`, `lienOwnerCall.ts`,
   `lienLetterTwo.ts`, the portals).

## Where it plugs in

- `supabase/functions/_shared/lienFieldsHash.ts`: the hash and `lienRowUnsigned`. It is the source; the
  client imports it. `notify-lien-approval` reads it, so that function is redeployed after the merge
  (`npm run check:edge-drift` names what is behind).
- `src/lib/jobs/lienNoticeSignature.ts` is mirrored for the edge functions under
  `supabase/functions/_shared/gcKernels/`. If it changes at all, even a comment, run
  `npm run gen:edge-kernels`; `edgeKernels.test.ts` fails a hand edit.
- `sign_lien_desk_item_with_code` takes the hash from the client (`p_fields_hash`), so the database holds no
  second copy of the rule.
- The key names live in `src/lib` (`PROMISE_FIELDS_KEY`, `COURTESY_FIELDS_KEY`). The hash file is read by
  Deno and cannot import from `src`, so it names the keys itself and a test holds the two lists together.

## The tests that must exist

- Each of the four writers' output leaves the hash as it was: `withPromiseRecord`, `withCourtesyRecord`, an
  `ownerCall`, a `gcAuthorizedDirectPay`.
- Every other change still voids a signature: a notice field, the GC's email, the cover letter, the wording,
  the pay lines, the months, and an unknown new key.
- `runTakenBack`, `signatureCleared` and `redrawn` still change the hash.
- `lienFieldsHash.shared.test.ts` still holds the desk's rule and the function's rule to one answer.
- The key list in the hash file equals the constants in `src/lib/jobs/lienCourtesyNotice.ts`.

## How to verify

- Unit tests as above, then `npm run typecheck && npm run lint && npm test`.
- Read only, on production: after the deploy, a mailed signed notice that carries a promise reads as signed
  by `lienRowUnsigned`. No write is needed to see it.
- Nothing to walk on screen until a screen shows a mailed notice's signature.

## Notes

- The finding and the production reads behind it are in the session notes outside the repo
  (`lien-sign-it-again-v2.7502.md`, the 2026-11-16 Lien desk group). They hold no customer data in the repo.
- The release fragments are `docs/recent-features/v2.7502.md` and `docs/recent-features/v2.7503.md`; the
  second one's *Still open* section points here.
