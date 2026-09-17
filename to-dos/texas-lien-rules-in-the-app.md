---
name: The Texas lien rules, in the app
group: ready
status: PR 1 shipped v2.3516 (the help guide) · PR 2 (the § The rules doors) waits on the owner picking where it lives and who sees it
summary: >
  **The Texas lien rules, exposed in the app** for the office to read: the verified rules table
  (chapter 53, CPRC ch. 38, Rule 185, Fin. Code ch. 392 and § 302.002, Prop. Code ch. 28, § 31.04,
  § 27.031) with what the app does about each; proposed as a help guide *the Texas lien rules the
  app follows* plus a `§ The rules` door on the Lien desk and the Lien window.
next: >
  PR 1 the help guide 'the Texas lien rules the app follows' with per-row anchors — unblocked,
  write it today. PR 2 the § The rules doors on the Lien desk header and the Lien window, plus a
  LIEN_RULE_CITES constant.
size: S
blocker: "PR 2 only: you pick where it lives and who sees it."
ver: PR 1 v2.3516
---

# The Texas lien rules, exposed in the app — so the office can read the code the app is following

## The ask, in the owner's words

> We have recorded the important rules of liens in texas. I would like to expose them somewhere in the app for user Tanya to see the code.

## The reading

- The app already carries a user-facing map of the lien law: the help guide *understand how liens work and which lien tool to use* (`src/content/help/understand-how-liens-work-and-which-lien-tool-to-use.md`) — the month rule, sub vs original contractor, the four instruments, which tool does what, who can do what. It cites sections in prose but not as a table the office can scan, and it predates the demand-letter statutes (attorney's fees, sworn account, the Debt Collection Act, Prompt Payment interest, the legal rate, the justice-court cap, the repealed owner demand).
- The demand letter's own switches already show their basis inline (v2.3433: *Prop. Code § 28.004 — the bill was a written payment request; from …*), and the Lien desk's readiness gate names the facts the statute needs. What is missing is one place that lists **every rule the app applies, with its cite and what the app does about it** — readable by an assistant without opening a modal.
- Help guides render for every role and are searchable from the {{icon:help}} menu, so a guide is the cheapest door; a *Rules* pane inside the Lien desk / Lien window is the closest door to the work.

## The rules

The verified rules table moved into the app on 2026-09-16 as the help guide [`texas-lien-rules-the-app-follows.md`](../src/content/help/texas-lien-rules-the-app-follows.md) (PR 1, v2.3516). The guide is the single copy to keep current; this file no longer carries it.

## The decision (proposed — owner to pick where it lives)

Two doors, one source:

1. **A help guide** — *the Texas lien rules the app follows* (`src/content/help/texas-lien-rules-the-app-follows.md`, category Billing & Money, all office roles): the table above as the guide's body, each row linking to the tool that applies it, with the *verified on* date at the top and the attorney list at the foot. Searchable from the help menu; renders for every role, so the office reads it without a dev.
2. **A `Rules` door on the surfaces** — a small {{button:outline|§ The rules}} in the Lien desk header and the Lien window's tab row that opens the guide in the help drawer at the row that matters (the desk → the month rule and the notice; the demand tab → presentment, sworn account, debt collection, interest).

Keep one copy: the guide is the source; the to-do's table is deleted when the guide ships. The demand letter's inline basis text and the desk's gate labels keep quoting the section numbers so the guide and the surfaces never disagree.

Rejected: a dev-only Settings panel (the office is the reader); a PDF in Drive (drifts); embedding the full statute text (cite and paraphrase; link to the statute).

## Where it plugs in

| Exists | New |
|---|---|
| `src/content/help/understand-how-liens-work-and-which-lien-tool-to-use.md` (the map), the help drawer + search, the demand letter's inline basis strings (`demandLetter.ts`, `LienInstrumentsModal.tsx`), the Lien desk header (`LienDeskModal.tsx`), `lienDeadlines.ts` (the comment block already cites § 53.003 / § 53.055) | the guide; a shared `LIEN_RULE_CITES` constant (section → guide anchor) so the surfaces' cites deep-link; the two doors |

## The plan

1. **PR 1 — the guide.** The table as a guide with anchors per row; the *verified on* line; the attorney list; a line in *understand how liens work…* pointing to it. Docs-only apart from the guide file (a help guide ships with a release note + fragment per CLAUDE.md).
2. **PR 2 — the doors.** The `§ The rules` button on the Lien desk header and the Lien window, opening the help drawer at the relevant anchor; the demand letter's basis strings become links to the same anchors.

## Open decisions

- **Where it lives** (owner): the help guide plus the two doors (proposed), the guide alone, or a pane inside the Lien desk?
- **Audience**: all office roles (proposed) or the assistant/controller only?

## How to verify

Help menu → search "lien rules" → the guide opens with the table, the verified-on date, and links; Lien desk header → *§ The rules* opens the drawer at the notice row; Lien window → Demand letter → *§ The rules* opens at the presentment row; every cite in the guide matches the cite the surface shows.
