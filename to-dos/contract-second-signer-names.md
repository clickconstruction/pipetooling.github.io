---
name: "A second signer: every place a signed agreement shows or prints its signers"
number: 64
group: close
status: PR A v2.4590 and PR B v2.4596 merged, their three functions deployed · v2.4657 built (a paper signed by two is filed as two signatures, the owner's answer) · left: a live read, then the small PRs under Left after this row
summary: >
  v2.4186 gave a job's service agreement a second signature frame, and the page the customer
  signs, the stored PDF, the window's banner and its paper all carry both signers — checked live
  on J1053. Six other places still read only the first signer's columns. The one that matters:
  the **agreement printed to sign by hand** (*Download the PDF*, and *On paper → Download & mark
  handed over*) has one signature line, so a homestead contract handed over on paper has no line
  for the second spouse. The rest are words: the window's status pill, the Pipeline chip (which
  also never says *1 of 2 signed*), the History and Documents audit line, the customer portal's
  *Your agreements*, and the browser print (*Print / save as PDF*, *Open full size*), which shows
  one signature block where the stored PDF has two.
next: Merge v2.4657; read J1053 live, with v2.4657's filing tried on a throwaway job; then the small PRs under Left after this row.
size: S — one merge and a live read
blocker: The v2.4657 merge.
ver: from v2.4186 · the window v2.4175 / v2.4183
opinion: build — the owner chose to record each signature on a paper signed by two (v2.4657); what is left is small tidy work.
mockup: not required — no new screen; the printed page gains the second pen rules and signature block the stored PDF already prints, and the pill, chip and lines gain a second name
---

# A second signer: every place a signed agreement shows or prints its signers

## Where it stands

Both PRs merged, and their three edge functions are deployed. **PR A** ([v2.4590](../docs/recent-features/v2.4590.md)) moves the names into one kernel and fixes items 1–5. It also fixes the app-side readers the survey below missed: the legal desk, the share sheet's attachment line, the signed rail's banner, the filing sheet's default name and the covers kernel. **PR B** ([v2.4596](../docs/recent-features/v2.4596.md)) carries item 6, the customer portal, plus the signed copy's email and the firm's page. **[v2.4657](../docs/recent-features/v2.4657.md)** answers the owner's paper question: a paper signed by two is filed as two signatures. The filing sheet has a **Second signer** box, filled with the second signer the draft named, and a paper for several jobs carries both.

## Left after this row

Outside these PRs, each for its own small PR:

- **The job's activity line.** *Contract signed by Sam Owner* is written by the `job_contracts` trigger in `20260903141146_job_contracts.sql`. It names the first signer only. Fixing it needs a migration.
- **The signing function joins names on its own.** `sign-job-contract` builds its *signed by* line by hand. It should read `signerNamesLine` from `supabase/functions/_shared/jobContractSigners.ts`. The words are the same today, so this is tidy work, plus a redeploy.
- **Dead code.** The default export of `src/components/jobs/JobContractRecordModal.tsx` is mounted nowhere. Neither is its `JobContractRecordBody`, whose facts grid names one signer. Delete both. Keep `buildJobContractRecordHtml` and `useJobContractRecordUrls`, which are in use.
- **Signed partly through the link, partly on paper.** A PDF emailed to sign by hand keeps its link, so one spouse can sign there before the paper comes back signed by the other. Since v2.4657 the filing keeps a second signature given through the link. It still replaces a first signature given there, and that frame's consent stamp leaves the row. The `co_signed` event and the consent ledger keep it. Doing it right needs a record that is part link and part paper: each frame keeps its own way, the lists say so, and `share-job-contract` stops rebuilding that kind of record as if its paper frame was typed. That is an edge change and a deploy, in its own PR.

## The ask, in the owner's words

After the Contract window train shipped (v2.4154 → v2.4186), the recap named one residual —
*"the window's pill names only the first signer on a two-frame agreement; the banner and the paper
already name both"* — and the owner asked: **"regarding the item worth a small PR later, please
help me add that to the punchlist."** Surveying every reader of `signer_printed_name` for that
row found five more places, one of them on paper.

## The decision

One row, not six: every item is the same fault (a reader of `job_contracts` that predates the
second frame) and the same fix (read both frames through `lib/jobs/jobContractSigners.ts`). The
second frame stays in its own `co_signer_*` columns, as v2.4186 decided; nothing here changes the
table or the signing function.

## The items, in the order to build them

1. **The page printed to sign by hand has one signature line.** The window's *Download the PDF*
   and the rail's *On paper → Download & mark handed over* both call `fetchContractDraftPdf` with
   `{ job_id, draft }` (`JobContractModal.tsx` `downloadPdf`), and the draft carries no
   `co_signer_name` — so `share-job-contract` (`draft_pdf`) prints one pair of pen rules. *On paper
   → Email the PDF* is right: `send_to_sign` sends the row's id and the function reads
   `co_signer_name` from it. Fix: add `co_signer_name` to the draft type in
   `src/lib/jobs/contractDraftPdf.ts` and pass `coSigner.name` from the window. The function
   already reads it (v2.4186); no deploy.
2. **The browser print shows one signature block.** `buildJobContractDocumentHtml`
   (`src/lib/jobs/jobContractDocument.ts`) takes one `signature` and draws one *Customer signature*
   block. Its callers — `buildJobContractRecordHtml` (`JobContractRecordModal.tsx`; the signed
   rail's *Print / save as PDF*), the window's `viewHistoryRow` (*Open full size* on a signed row)
   and `preview` (*Open full size* on a draft) — pass only `signer_*`. Fix: `coSignerName` and
   `coSignature` inputs mirroring `_shared/jobContractPdf.ts` — a *Second signature* block, signed
   or with pen rules and the name, drawn only when a second signer is named.
3. **The Pipeline chip names one signer and never counts frames.** The coverage kernel
   (`src/lib/jobs/jobContractCoverage.ts`) sets `signerName: signed.signer_printed_name`, so the
   signed chip reads *✍ Signed Sep 29 · ZZ TEST Owner On Notice*; its `sent` kind has no frames,
   so a half-signed agreement reads plain *Sent*. The two batch reads behind it —
   `src/hooks/useStagesRowFlags.ts` and `src/hooks/useJobContractsNudge.ts` — list columns
   without `co_*`. Fix: select `co_signer_name, co_signed_at, co_signer_printed_name`, carry
   both names and `framesLabel` through the kernel, and add *· 1 of 2 signed* to the sent label
   and title, as `jobContractChips` already does in History (v2.4186). This reaches the Pipeline
   row, the bill's contract strip and the Job window's Contract row.
4. **The window's status pill names one signer.** `JobContractModal.tsx` passes
   `signedView.row.signer_printed_name` to `windowStatusPill`. Fix: pass both names.
5. **The audit line in History and Documents → Jobs names one signer.**
   `jobContractSignatureAuditLine` (`src/lib/jobs/jobContractLifecycle.ts`) reads `signer_*`
   only. Fix: name both signers when the row has a filled second frame.
6. **The customer portal's *Your agreements* names one signer.** `supabase/functions/customer-portal/index.ts`
   selects `signer_printed_name` alone for `signerName`. Fix: select the co columns and join the
   names; redeploy `customer-portal`.

## Where it plugs in

- The kernel: `src/lib/jobs/jobContractSigners.ts` (v2.4186) — `signerFrames`, `framesLabel`,
  `framesProgress`. Add one `signerNamesLine(row)` (*Sam and Alex*) for items 3–6.
- Already right, as references: the stored signed PDF and the unsigned emailed PDF
  (`supabase/functions/_shared/jobContractPdf.ts` `coSignerName` / `coSignature`), the customer's
  page (`src/pages/JobContractSign.tsx`), the signed rail's banner
  (`src/components/jobs/JobContractSignedRail.tsx`), the paper (`JobContractPaper.tsx`
  `coSigner` / `coSignature`), the History chips (`jobContractChips`).

## How to verify

- **Test data:** ZZ test job **J1053** carries a signed two-frame agreement (*ZZ TEST Owner On
  Notice* and *ZZ TEST Second Signer*, signed live 2026-09-29) — items 2–6 can be read on it with
  no new signature. Open it from the Pipeline (Ready to Bill) or the Job window's Edit tab →
  *View record*.
- **Item 1** needs a draft with a second signer: on J1053, *Start a new agreement…*, name a
  second signer on the paper, press *Download the PDF* (it records nothing), and read the file —
  two pairs of pen rules, each with its name. Do not press *Download & mark handed over* on it
  unless the handed-over row is wanted; void it after.
- The Browser pane was hidden for most of the 2026-09-29 pass; the headless Playwright script
  that signed J1053 and read its PDF back is described in the v2.4186 fragment's *Verified*
  section.
- Tests: extend `jobContractSigners.test.ts` (the names line), `jobContractCoverage` tests (the
  signed label with two names; the sent label with *1 of 2 signed*), a render test of the print
  HTML with two frames, and `contractDraftPdf` passing `co_signer_name`.
