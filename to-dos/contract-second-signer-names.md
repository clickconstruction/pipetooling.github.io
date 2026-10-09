---
name: "A second signer: an agreement signed partly through the link and partly on paper"
number: 64
group: residual
status: the second-signer train shipped (v2.4590, v2.4596, v2.4657) and was walked live 2026-10-07 on J1064 · its three leftovers and the paper's day line are in (v2.4870 #4895, migration 20261008080000; v2.4871 #4897, sign-job-contract; #4898, dead code; v2.4876, the paper's day) · the mixed record built 2026-10-09 as v2.5101 (share-job-contract) · left: deploy share-job-contract, then the live walk in v2.5101's fragment; then retire this card
summary: >
  Every place a job's service agreement shows or prints its signers names both of them, and a
  paper signed by two is filed as two signatures. A PDF emailed to sign by hand keeps its link,
  so one spouse can sign there before the paper comes back signed by the other. Since v2.5101
  filing the paper keeps a signature given through the link in either frame. What is left is
  the deploy of share-job-contract and a live walk.
next: Deploy share-job-contract after v2.5101 merges, then run its fragment's walk on a ZZ TEST job.
size: S — a deploy and a walk
blocker: None.
ver: from v2.4186 · v2.4590 · v2.4596 · v2.4657 · v2.4870 · v2.4871 · v2.4876 · v2.5101
opinion: later — rare (a homestead agreement emailed as a PDF, signed half each way); the co_signed event and the consent ledger keep the lost stamp meanwhile.
mockup: not required — no new screen; each frame keeps its own way, and the lists already name frames
---

# A second signer: an agreement signed partly through the link and partly on paper

## Where it stands

[v2.4186](../docs/recent-features/v2.4186.md) gave a job's service agreement a second signature frame. [v2.4590](../docs/recent-features/v2.4590.md) and [v2.4596](../docs/recent-features/v2.4596.md) taught every reader to name both signers, in the app and in three edge functions. [v2.4657](../docs/recent-features/v2.4657.md) files a paper signed by two as two signatures.

The live walk, 2026-10-07, ran on J1064 *ZZ TEST sink*: J1053, the two-signer test job, had been folded into the sink by the ZZ sweep. The page to sign by hand printed two pairs of pen rules, and the filing sheet started with both names. The pill, the banner, the *for* line, Documents → Jobs, the customer's Agreements card and the portal's *Your agreements* named both. The Pipeline chip named nobody, as it should. The paper was taken off after.

The leftovers that followed:

- [v2.4870](../docs/recent-features/v2.4870.md) — the job's activity line names both signers (migration `20261008080000`).
- [v2.4871](../docs/recent-features/v2.4871.md) — `sign-job-contract` reads `signerNamesLine`.
- The unmounted `JobContractRecordModal` and `JobContractRecordBody` were deleted.
- [v2.4876](../docs/recent-features/v2.4876.md) — a paper filed with its *Signed on* date reads *on Sep 30, 2026*, no longer a 7:00 AM that nobody recorded.

## What is left: signed partly through the link, partly on paper

A PDF emailed to sign by hand keeps its link (v2.3631). One spouse can sign there before the paper comes back signed by the other.

- Since v2.4657, filing the paper keeps a **second** signature given through the link.
- It still replaces a **first** signature given there, and that frame's consent stamp leaves the row. The `co_signed` event and the consent ledger keep it.

Doing it right needs a record that is part link and part paper. Each frame keeps its own way (`signer_mode` and `co_signer_mode`), and the lists already say so per frame. `share-job-contract` must also stop rebuilding that kind of record as if its paper frame were typed. That is an edge change and a deploy, in its own PR.

**Built 2026-10-09 as [v2.5101](../docs/recent-features/v2.5101.md).** Filing the paper keeps a first signature given through the link, and the paper's signer becomes the second frame. Every reader that asked whether a record is a paper now asks it of both frames (`filedOnPaper`). `share-job-contract` sends the paper for such a record. Left: its deploy, then the walk in the fragment.

## The ask, in the owner's words

After the Contract window train shipped (v2.4154 → v2.4186), the recap named one residual —
*"the window's pill names only the first signer on a two-frame agreement; the banner and the paper
already name both"* — and the owner asked: **"regarding the item worth a small PR later, please
help me add that to the punchlist."** Surveying every reader of `signer_printed_name` for that
row found five more places, one of them on paper.
