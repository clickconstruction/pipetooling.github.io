---
name: GC failure playbook — what counsel's memo asks beyond the letter
number: 33
group: ready
status: >
  counsel's memo of 2026-09-22 answered the § 53.081 brief; the letters, fills, timely claim and
  the § 53.254(g) statement shipped (v2.3744, v2.3745) · mock-up of the six pieces drawn 2026-09-23
  (mockup.html), the owner said build it all · PR 1 (the § 53.057 form and its clock, the
  retainage inside the § 53.056 claim, the signer's phone) built 2026-09-23 · left: PR 2 letter
  two, PR 3 the owner's answers, the piles and the grid
summary: >
  **GC failure playbook**: the pieces counsel's memo asks for that the app does not have — the
  § 53.057 retainage notice (the statute's own form, sent within 30 days of our contract ending),
  the second owner letter when we believe the owner has paid the GC out, the 10–14 day cadence
  for letter two, a payment-bond check per job, the signer's own phone on the letter, and the
  per-job grid the memo tells the office to build (paid-out Y/N, reserved 10% Y/N, bond Y/N,
  contract-completion date). Memo in the folder.
next: >
  PR 2 — letter two from a sent notice (the paid-out and the unresponsive letter as the two
  choices, the days-since count, the Needs-you reminder); then PR 3 — the owner's call recorded on
  the notice, the affidavit piles A / B / C, the grid as step 5 of the GC run. Counsel reads the
  drafted § 53.057 form before the first one is mailed; the WARNING-block question is still with
  them.
size: M
blocker: none — the retainage form wants counsel's read of § 53.057(a-2) before the first one is mailed.
ver: v2.3744 · 3745 · 3753
opinion: build — the memo is the collection path for a GC that goes dark, and the app stops one instrument short of it.
---

# GC failure playbook — what counsel's memo asks beyond the letter

The memo ([`counsel-memo-2026-09-22.md`](./counsel-memo-2026-09-22.md)) answered the eight questions of the *Put a GC on notice* brief (punch list #16). The letter side shipped the same day: counsel's three letters plus the unresponsive one, the fills, the timely-only claim with the stale-month footnote, and the § 53.254(g) statement in the statute's words (v2.3744, v2.3745). Everything below is what the memo asks the office and the app to do *around* the notice, none of it built.

## 1. The § 53.057 retainage notice — built (v2.3753)

The Code's second instrument: a notice of claim for unpaid retainage, in the form § 53.057(a-2) prescribes (the same lines as § 53.056's form with *Total retainage unpaid* in place of *Claim amount*), sent to the owner and the original contractor by the **earlier of** 30 days after our contract is completed, terminated or abandoned, or 30 days after the original contract is terminated or abandoned. Required only to the extent unpaid retainage was not already inside a § 53.056 claim — so the memo's rule is belt and suspenders: **put unpaid subcontract retainage in the § 53.056 claim amount while the job is open**, and send § 53.057 within the 30 days. An owner may withhold on a § 53.057 notice only once they receive a copy of the filed affidavit (§ 53.081(c)), so a retainage-only notice without a prompt affidavit is a weak trap.

- The app has no § 53.057 form, no 30-day clock, and no retainage line on the § 53.056 claim. The desk knows the last work month; it does not know when our contract on a job ended.
- Build: the form as a third document kind on the desk; a *contract complete / terminated / abandoned* date on the job that starts the 30-day clock; the claim on the § 53.056 notice includes unpaid retainage when the subcontract provides for it, with the invoice enclosure split *progress vs retainage*.

## 2. The second owner letter — when we believe the owner has paid the GC out

The memo's *paid-out* letter replaces the next-draw pitch: it asks three questions (do you still owe the GC anything, did you reserve the 10 percent and is it still in your hands, when was the original contract completed), names the § 53.101 reservation and the § 53.105 failure-to-reserve lien, and dates the affidavit. It goes as **letter two, 10–14 days after the first packet**, when the GC has not paid and has not authorized a direct payment — or first, when the office already believes the owner paid out.

- Build: a *Send letter two* door on a sent notice (the desk's Sent pile), with the paid-out letter and the unresponsive letter as the two choices, the GC copied by the same traceable mail; a reminder at 10–14 days.

## 3. The grid — three facts the app does not hold

The memo's grid per job: owner of record, homestead Y/N, commercial vs residential, last day on site, unpaid months and dollars, the § 53.056 date per month, the affidavit date, **payment bond Y/N**, **paid-out-to-GC Y/N/unknown**, **reserved 10 % Y/N**, the original contract's completion date. The desk holds everything but the four in bold.

- Build: the four facts on the property record / job (the bond on the job; the owner's answers on the notice's record, typed from the call the letter invites); the affidavits pile sorts into the memo's three piles — A the owner still owes the GC (trap it), B paid but did not reserve (reserved-funds lien, shared), C paid in full and holds nothing (property lien, foreclosure calendar).

## 4. The signer's own phone — built (v2.3753)

`{{phone}}` prints the letterhead's number today. The memo wants the master plumber who signs, not a generic office line. `users.phone` exists; the signer resolver (`lienDeskSignerFor` in `JobsStagesTab.tsx`) reads the users rows already — a sibling `signerPhoneFor` threads through the desk, the GC window and the preview.

## 5. Kept out on purpose, per the memo

- No Chapter 28 interest, CPRC ch. 38 fee sentence or Penal Code § 31.04 line on the owner's envelope — those go on the separate GC demand (the per-job demand letter, v2.3425–v2.3437).
- No joint check anywhere: Click cannot deposit one. Direct pay from the owner only after the GC's written authorization — the memo's one-line email is in the guide.
- One envelope per property; a multi-property GC failure is a stack of single-property files. (The run mails one envelope per name and address, v2.3720 — per property already.)
- Counsel signs off per job before the office accepts an owner's direct payment while the GC is silent.

## 6. One question back to counsel

The memo says the § 53.056 form is not usable until *the statutory WARNING block is restored*. § 53.056(a-2) as amended by HB 2237 (eff. 2022-01-01) prescribes no warning lines (read 2026-09-22); the app prints the form as the Code now reads. Logged in `owner-decisions-pending.md`.
