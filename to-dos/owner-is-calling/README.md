---
name: "The owner is calling: a call sheet the assistant reads and records"
number: 47
group: gated
status: built as the door + the conversation cards (v2.3854, 2026-09-26) · the assistant's guide shipped v2.3876 (when to press it, where it is, what may be said) · the door searches every job on the desk and has a practice call (v2.4249, Taunya's ask of 2026-09-30) · left: option 3 (the printed sheet), the Dashboard and header-search doors
summary: >
  An owner who just got a lien letter calls the office. Today the answer lives in three places —
  counsel's memo, the letter, and the Owner call dialog's three bare questions — and whoever
  picks up has to know the desk to find the job. Give the assistant one sheet: find the caller,
  see the letter they are holding, read the words counsel allows for what they say, and record
  their situation as they say it. Three placements: the sheet inside the Owner call dialog
  (option 1), a "someone's calling about a letter" door that finds the job (option 2), a printed
  sheet per run (option 3).
next: Counsel reads the script's words (they are the memo's sentences for the phone); option 3 and the other doors if the office asks for them (v2.3854 left them as is on purpose).
size: S + M + XS
blocker: none — counsel's read of the words is on the pending list.
ver: v2.3854 · v2.3876 · v2.4249
opinion: build 2 + 1 together — the door is what makes it usable by someone who does not know the Lien desk; option 3 is cheap and worth having on the run's print row.
---

# The owner is calling: a call sheet the assistant reads and records

## The ask

The owner, 2026-09-26, after the retainage letter redraft (v2.3850): *"I need something in the app that an assistant can read off based on what the customer says, how could I offer this, and potentially record the situation the customer is in based on when the customer calls us asking about the letter that was just sent."*

## What is missing today

- **Finding the caller.** The owner of record is a name on the property (`customer_addresses`), not a customer. An owner who says "I got a letter about 9703 Lenox Hill" has to be found by someone who knows to open the Lien desk, switch to Sent, and pick the job. Nothing takes a caller's name or address to the notice.
- **The words.** Counsel's memo of 2026-09-22 says what may and may not be said to an owner (owner-protective, one number, no joint check, never "the Code requires you to pay us", never the GC's other jobs, never fees). Those words are in the letters and in `docs/COUNSEL_MEMO_GC_ON_NOTICE_2026-09-22.md`; nothing puts them in front of the person on the phone, and nothing changes them by what the owner says.
- **The record.** `LienOwnerCallDialog` (v2.3767) takes the three answers — owes the GC, the 10%, their contract's completion — and a note. It does not take *when* the 10% was released (which decides § 53.105), whether the owner wants to pay us directly (which needs counsel's sign-off, #41), whether the GC is answering them, or what the office told them.

## The mock-up

[`mockup.html`](mockup.html) — the door, the sheet with one call drawn through it (the owner paid everything, released the 10% on Sep 10, their job finished Aug 30, wants to pay us), what gets recorded and where it shows, and the printed sheet.

**Second draft — [`conversation.html`](conversation.html).** The owner, the same day: *"it is not intuitive for a user to see the questions and click through."* The sheet redrawn as a conversation: it starts from **what the owner says** (chips in their words — *paid my builder · still owe some · am I being sued? · builder's gone quiet · can I pay you?*), shows **one card at a time** (the line to say in big type, two or three replies in the owner's words, a tap opens the next card), collects the statutory facts **as by-products** (the 10% asked as "did that stay with you, or has it gone to RMC?"), and builds the record **as a sentence** at the bottom; cites hide behind ⓘ; the chips stay one tap away and *Back* undoes a tap. Same facts recorded as the first draft. This is the draft to build.

**Third draft — [`search-and-practice.html`](search-and-practice.html), built v2.4249.** Taunya, 2026-09-30, after typing "lenn" and getting *No sent notice matches*: *"I need to be able to search by job or address or owner or gc, and would like the option to click on a sample one to explore how this page works."* The door searched sent notices only, by exact letters, and an empty box taught nothing. Now it searches every job the desk holds (a sent letter opens the call sheet, a job with nothing mailed opens on the desk), forgives a slip by shortening the last word, shows words to try and the letters that are out before anything is typed, and offers a practice call on a made-up letter that saves nothing. Still open from this draft: whether a *Letter sent* row should also offer *Open the job*, and whether Taunya meant a walkthrough of the whole desk rather than the call sheet.

## The three options

1. **The call sheet inside the Owner call dialog** — `LienOwnerCallDialog` grows a *Say* column beside the picks: the opening (which letter they hold, mailed when, for how much), a script line under every pick that changes with the answer, the closing (the affidavit date, the release the same day), and a *Never say* strip. New facts recorded on `OwnerCall`: `releasedOn` (the day the 10% went to the GC), `wantsToPayUs`, `gcSilentToThem`, `told` (the script branches read), `askedAbout` (§ 53.056 / § 53.057 / letter two). `affidavitPileFor` and the grid read them; `wantsToPayUs` opens the counsel sign-off door (#41). Kernel `lienOwnerCallScript.ts` (pure: the letter's facts + the answers → the lines), tests, the guide. Size S.
2. **The door: "Someone's calling about a letter"** — built on the Lien desk header (v2.3854, `LienCallerDoor.tsx` + `lienCallerMatch.ts`) and from a sent job's footer; not yet on the Dashboard's lien card or as a row in the header search: type the caller's name, the property address or the job number; it matches the sent notices (owner name, mailing address, job address, job number, the GC's name for a GC calling) and opens option 1's sheet on that job with the letter's facts at the top. Nothing new is loaded — the desk already holds the sent items, owners and properties; the matcher is a kernel over `LienDeskData`. Size M.
3. **The printed call sheet** — *Print the call sheets ↗* beside *Print the grid ↗* on Put a GC on notice: one page per owner in the run, the same script with blanks for the answers, for a front desk without the app open. Size XS once option 1's kernel exists.

Recommended: 2 + 1 as one PR, 3 after.

## The script's rules (counsel, 2026-09-22)

Say: you did nothing wrong by paying the GC; this is not a lawsuit; you did not hire us; you may hold back the claim from what you still owe; the 10% and the 30 days; the affidavit date; the release the same day; a direct payment is your decision, call us first, payable only to Click, a copy to the GC. Never: the GC's other jobs or "not paying subs generally"; interest, fees, theft of service; "the Code requires you to pay us"; a joint check; "you are in default". Counsel's sign-off per job before an owner's direct check is accepted.

## How to verify

Dev-login on localhost, the Lien desk, press *☎ Someone's calling ›* (beside *§ The rules*; the guide *answer an owner who calls about a lien letter*, v2.3876, walks an assistant through it). Since v2.4249 the box opens with words to try, the letters that are out and *▶ Practice call* (the whole sheet on a made-up letter, no Save); a job with nothing mailed is found too and opens on the desk. Type "Lenox" — once its notice is sent, the notice on 9703 Lenox Hl opens with its letter's facts; pick *No* / *Released · Sep 10* / *Done Aug 30* / *Wants to pay us*; the Say column changes at each pick; save; the since-sent line reads *Owner called … · Pile C · wants to pay us → counsel*; the affidavit pane and the grid show the same.
