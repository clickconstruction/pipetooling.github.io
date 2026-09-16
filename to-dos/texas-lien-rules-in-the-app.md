---
name: The Texas lien rules, in the app
group: ready
status: not started · noted 2026-09-14 · owner picks where it lives
summary: >
  **The Texas lien rules, exposed in the app** for the office to read: the verified rules table
  (chapter 53, CPRC ch. 38, Rule 185, Fin. Code ch. 392 and § 302.002, Prop. Code ch. 28, § 31.04,
  § 27.031) with what the app does about each; proposed as a help guide *the Texas lien rules the
  app follows* plus a `§ The rules` door on the Lien desk and the Lien window.
next: >
  PR 1 the help guide 'the Texas lien rules the app follows' with per-row anchors — unblocked,
  write it today. PR 2 the § The rules doors on the Lien desk header and the Lien window, plus a
  LIEN_RULE_CITES constant.
size: S + S
blocker: "PR 2 only: you pick where it lives and who sees it."
ver: noted 09-14
---

# The Texas lien rules, exposed in the app — so the office can read the code the app is following

## The ask, in the owner's words

> We have recorded the important rules of liens in texas. I would like to expose them somewhere in the app for user Tanya to see the code.

## The reading

- The app already carries a user-facing map of the lien law: the help guide *understand how liens work and which lien tool to use* (`src/content/help/understand-how-liens-work-and-which-lien-tool-to-use.md`) — the month rule, sub vs original contractor, the four instruments, which tool does what, who can do what. It cites sections in prose but not as a table the office can scan, and it predates the demand-letter statutes (attorney's fees, sworn account, the Debt Collection Act, Prompt Payment interest, the legal rate, the justice-court cap, the repealed owner demand).
- The demand letter's own switches already show their basis inline (v2.3433: *Prop. Code § 28.004 — the bill was a written payment request; from …*), and the Lien desk's readiness gate names the facts the statute needs. What is missing is one place that lists **every rule the app applies, with its cite and what the app does about it** — readable by an assistant without opening a modal.
- Help guides render for every role and are searchable from the {{icon:help}} menu, so a guide is the cheapest door; a *Rules* pane inside the Lien desk / Lien window is the closest door to the work.

## The rules (verified 2026-09-14 against statutes.capitol.texas.gov; case cites checked on FindLaw/Justia)

| Rule | What it says | What the app does with it | Cite |
|---|---|---|---|
| The month rule | Every lien deadline counts from the **month labor or materials were furnished**, never from the bill date. One clock per unpaid month; the clock keys on approved clock sessions. | The Payment forecast's month panel (v2.3400), the Lien desk queue (`list_lien_notice_months`), the notice's *months covered*. | Prop. Code § 53.056(a-1), § 53.052 |
| Residential shortens everything by a month | A house, duplex, triplex, fourplex, or an owner-occupied condo unit. | The property record's kind; the notice and filing dates shift a month earlier; unknown kind shows commercial dates and says so. | § 53.001(10), § 53.052(b), § 53.056(a-1) |
| Sub vs original contractor | A GC on the job → we are a subcontractor: every unpaid month needs a notice to the owner **and** the GC before any lien. No GC → we contracted with the owner: no monthly notice, the affidavit alone. | *Role* line on the notice tab; the Lien desk lists only jobs with a GC. | § 53.056, § 53.052 |
| The § 53.056 notice | Statutory form, to the owner of record and the original contractor, by the 15th of the 3rd month after the work month (2nd if residential); certified mail or another traceable service. **May include the invoice.** | The notice tab and the Lien desk run; the invoice enclosed behind it (v2.3437). | § 53.056(a-1)–(a-3), § 53.003 |
| What the notice does for the owner | The owner may withhold what we are owed from the GC (fund trapping) and is liable for money paid out afterward. | The Lien desk's cover note; the demand letter points the owner to the notice, not a demand (v2.3425). | § 53.081, § 53.082, § 53.084 |
| The owner demand is gone | The old § 53.083 "demand for payment to the owner" was **repealed** for contracts on or after 2022-01-01. | No owner-demand instrument in the app; the notice is the owner-facing paper. | HB 2237 (87th Leg.) § 36(8) |
| The affidavit | The lien itself: sworn, filed with the County Clerk of the property's county by the 15th of the 4th month after the last month worked (3rd if residential); needs owner of record, county + legal description, a recorded notice on sub jobs, and not a homestead; a copy served on the owner and the GC within 5 days of filing. | The Mechanic's lien tab's four-fact gate, *Record filing*, the serve-by watch (red Needs-you card), *Record service*. | § 53.052, § 53.054, § 53.055, § 53.254 (homestead) |
| Weekends roll, holidays are not modeled | A deadline on a Saturday, Sunday or legal holiday moves to the next business day. The app rolls weekends only — a holiday 15th shows the earlier, safe date. | `lienDeadlines.ts` and the SQL twins `lien_notice_deadline` / `lien_filing_deadline`. | § 53.003 |
| Releases and waivers | Once paid, the customer is owed a release (conditional with an unpaid bill, unconditional once paid); a recorded affidavit gets a release of record. Waivers we ask a sub to sign follow the four statutory forms; an unconditional waiver may not be required before payment. | Release of Lien window, Bill Customer → Lien releases, Release of record tab; Subs → Pay → Lien waiver… | § 53.281, § 53.284, § 53.286 |
| Attorney's fees need presentment | Fees on a claim for services, labor, materials, a sworn account or a contract require the claim to be **presented** and unpaid for **30 days**. No form; a demand letter is presentment. | The demand letter's fee-clock sentence and date (v2.3433). | CPRC § 38.001(b), § 38.002; *Jones v. Kelley*, 614 S.W.2d 95 (Tex. 1981) |
| Demand exactly what is owed | Demanding more than is due, or refusing tender of the true amount, forfeits the fee claim. | The statement of account is read from the bill, never typed (v2.3425). | *Findlay v. Cave*, 611 S.W.2d 57 (Tex. 1981) |
| Sworn account | A suit on an account needs a systematic, itemized record — the name, date and charge of each item, with all payments and credits allowed. | The statement of account per invoice; the invoice enclosed as Exhibit A (v2.3429). | Tex. R. Civ. P. 185; *Panditi v. Apostle*, 180 S.W.3d 924 (Tex. App.—Dallas 2006) |
| Debt collection (homeowners) | Texas's act binds the original creditor for a **consumer** debt (a homeowner, not a GC): no threatening a criminal charge over a payment dispute, no threatening an action prohibited by law, no charge no agreement or statute authorizes, no misrepresenting the amount, never "fees will be added". Civil suit and lien threats are allowed. | The lien line offered only while a lien can be filed; every charge names its statute; "seek" fees, never "will be added"; § 31.04 off. | Fin. Code § 392.001, § 392.301(a)(2),(6),(8), (b)(2), § 392.303(a)(2), § 392.304(a)(8),(12),(13) |
| Interest: Prompt Payment | Applies to **every** contract to improve real property — homeowner jobs included; there is no residential carve-out. A written payment request is due by the 35th day after receipt; from the day after, the unpaid amount bears 1.5 % a month; fees at the court's discretion; suspension of work is unavailable on 1–4-family residential. | The interest line reads § 28.004 from the 36th day after the bill went out. | Prop. Code § 28.001, § 28.002(a), § 28.003, § 28.004, § 28.005, § 28.009(e) |
| Interest: the legal rate | With no agreed rate and no written request, 6 % a year from the 30th day after the amount is due. | The interest line's fallback when the bill was never sent. | Fin. Code § 302.002 |
| Theft of service | The presumption of intent needs a written demand by certified/registered mail with return receipt (or a commercial delivery service) to the address on the service agreement, unpaid 10 days after receipt — the source of the app's 10-business-day default. | The § 31.04 line ships **off** until the attorney package. | Penal Code § 31.04(a)(4), (b)(2), (c) |
| Justice court | Hears claims to $20,000 exclusive of interest. | The demand letter's court line. | Gov't Code § 27.031(a)(1) |
| Delivery | Certified mail is required only for chapter 53 notices and the § 31.04 presumption; for presentment it is optional but evidentiary. | Certified mail is the default channel everywhere; email is the second channel and is recorded as one (v2.3436). | Prop. Code § 53.003 |

Unverified or for the attorney: whether a bill counts as chapter 28's "written payment request" on a homeowner job (the letter says so today); the CPRC ch. 38 sentence on every letter; the § 31.04 line and § 31.04(c) delivery; the § 53.284 statutory release text; TRCP 500.3's treatment of fees in the justice-court amount; the Texas Supreme Court on ch. 392 reaching original creditors (the Fifth Circuit's *Miller v. BAC*, 726 F.3d 717, does).

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
