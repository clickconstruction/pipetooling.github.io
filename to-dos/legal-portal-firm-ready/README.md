---
name: "Legal portal: ready for the firm"
number: 85
group: waiting
status: 23 of 29 built and merged 2026-10-05/06 (v2.4615–v2.4681); item 17 PR 2 (#4640) queued, its migration (#4690) held until the new dispatcher is live; 12–15 and 19 wait for the firm; 10 is the owner's
summary: >
  The portal's data model and two-way channel are a real selling point, but the firm-facing
  surface still speaks the office's language, the print packet hands the firm the office's own
  triage, and the lien grid shows every billed job in the company. Two reviews on 2026-10-05
  (four readers over the code, one over the sample portal in a browser) agreed on 29 items.
  Items 1–11 would show in a demo; 12–21 are what a firm will ask for in month one; 22–29 are
  structure. Each item gets a mockup, a hard look ("is this the best we can do?"), then the build.
next: Arm #4690 once `legal-notify-dispatch` is live with #4640, then push its migration. Redeploy `legal-send-firm-link`. After the firm meeting, shape items 12–15 and 19 from what the firm asked for; the owner fills the particulars (item 10).
size: XL (29 items; 1–11 are S each, 12–21 M, 22–29 S–M)
blocker: The firm's answers for 12–15 and 19. Decisions taken 2026-10-05 — share everything with counsel by default (29); one firm (27); settlement by threshold (20); the Lien grid keeps the whole book, stripped (2).
opinion: build in the order below; ship each as its own PR so the firm's demo copy improves tonight and the month-one items can be shaped by what the firm says.
---

# Legal portal: ready for the firm

## The ask

The owner, 2026-10-05, the evening before presenting the portal to a collections law firm he wants to retain: *"can you help me give it a review and help me spot some of its weaknesses so we can fix"*, then *"help me come up with a list of everything we should fix, improve, or refactor so this is as useful as it can be"*, then *"let's work through the list, I want to work through all 29"*, and *"for each one, make a mockup and ask yourself is this the best we can do, and then refine and build it"*.

## The decisions (2026-10-05)

- **Held entries (item 29):** share everything with counsel by default. The office can still hold one entry back, with a reason. Records are discoverable either way; hiding them from your own lawyer only sets up a surprise.
- **Firms (item 27):** one firm. Say so in the copy and the schema; the portal and the lien grid serve that firm.
- **Settlement authority (item 20):** a threshold. The office sets a dollar or percent floor per matter; the firm settles freely above it and asks below.

## The list

Each item: a mockup file beside this card (`mockup-<n>-<slug>.html`), then its PR. Struck through once merged, with its version.

### Before the meeting (would show in a demo)

1. ~~**A firm print packet.**~~ (v2.4615) Its own builder: no *Before release* gaps, no worth-it verdict, no *a firm has not been assigned*, no *nothing held back* (the function hard-codes the count to zero); the firm's own fees and steps printed. The desk keeps the office packet.
2. ~~**Scope the Lien grid to referred matters.**~~ (v2.4616 — the owner kept the whole book, stripped) Shape the desk rows so skip reasons, owner-call notes, owner emails and GC policies never leave. No tab while a firm has no matters.
3. ~~**Firm vocabulary.**~~ (v2.4625) *Needs You list*, *From Click*, *Click's particulars*, *Their word*, *counsel's pile*, *chose to share*, stage chip *new*, *Tell me*, *waiting for their click*, raw kind names (*recovery applied*), the hard-coded *Click's legal portal* email footer.
4. ~~**Facts, not theories.**~~ (v2.4634) *Sworn account holds* becomes *bill sent, crew on site with GPS, no dispute logged*. *Terms with Click* becomes the invoice's due days, not the credit posture.
5. ~~**Money that foots.**~~ (v2.4677) Invoice rows at original amount with the write-down beneath; unlinked payments reduce the balance; contingency rows out of the firm's total demand; one formatter so `$-4,000.00` cannot appear.
6. ~~**Property per job.**~~ (v2.4678) The project address from the job's address and owner override, not the payer's address list; the lien clock from that.
7. ~~**Generic error messages**~~ (v2.4646) from both functions.
8. ~~**Phone layout**~~ (v2.4639) at 375px: one column, stacked forms, tables that scroll inside their card.
9. ~~**A consistent sample matter**~~ (v2.4638) (a GC, a property record, a dated payment, a demand letter, lien paper). Needs a `legal-portal` redeploy.
10. **Fill the particulars** in Settings (license, registered agent, custodian, affiant). The owner's.
11. ~~**"Largest first"**~~ (v2.4635, largest balance first) in the guide vs release-date order on the page. Pick one.

### After the firm is heard

12. **Documents, both ways.** Invoice PDFs, the demand letter as sent, filing copies in storage, report and photo links; a firm upload act; signed links minted on click.
13. **Debtor identity.** Legal entity name, entity type, registered agent, SOS number, guarantors, surety and bond number; the invoice's bill-to party.
14. **Contract terms and interest.** Rate, fees clause, venue; the Prompt Payment interest and fee clock the demand letter already computes.
15. **Proof of delivery** per invoice: sent, delivered, opened.
16. ~~**Lifecycle.**~~ (v2.4681, v2.4645) Settled stays visible until the office closes it; payment plan, uncollectible, dismissed, post-judgment; no silent backward moves; a pulled-back matter stays readable with the reason.
17. ~~**Threaded conversation.**~~ (v2.4626; PR 2 v2.4649 queued, migration held) Return the acknowledged stamp; link answers to questions; close withdrawn asks; email the firm on every event.
18. ~~**Acts a firm can trust.**~~ (v2.4640, v2.4648) Void with reason on both sides; *recorded by* from the recipient list; a date the firm sets; idempotency; a per-matter limit.
19. **A dispute block** with amount, what was disputed and resolution.
20. ~~**Settlement authority**~~ (v2.4643) as a threshold the firm can see, and an ask below it.
21. ~~**Welcome email**~~ (v2.4624) with the link from the desk; confirmation failures shown.

### Structure and refactors

22. ~~**Hash-only tokens at rest**~~ (v2.4669, v2.4647), no-store headers, a referrer policy, short PDF link life after revoke, the Rotate confirm says every emailed link dies.
23. ~~**Shape the payload**~~ (v2.4644) to what the page draws.
24. ~~**Scope contacts**~~ (v2.4642) to the matter's jobs.
25. ~~**One evidence rule**~~ (v2.4637) for sessions.
26. ~~**Send failures retried and surfaced**~~ (v2.4662); stamp per recipient; mint unsubscribe links once.
27. ~~**One firm**~~ (v2.4641), said in schema and copy.
28. ~~**Honeypot**~~ (v2.4622) wired or dropped.
29. ~~**Share-all default**~~ (v2.4680) for the "what was said" entries, with a per-entry hold and reason.

## Where it plugs in

- Page: `src/pages/LegalPortal.tsx`; matter view: `src/components/jobs/legal/LegalFirmMatterView.tsx` (+ `legalFirmMatterViewShared.ts`); grid: `LegalPortalLienGrid.tsx`; the office's link button: `LegalPortalLinkButton.tsx`; the desk: `LegalDeskModal.tsx`.
- Kernels: `src/lib/legal/legalPacket.ts` (the packet), `legalPacketPrint.ts` (the office print), `legalPortalPayload.ts` (payload → packet), `legalLienPaper.ts`, `legalAsks.ts`, `legalMatters.ts`.
- Functions: `supabase/functions/legal-portal` (GET, the payload), `submit-legal-portal` (POST, the firm's acts), `legal-notify-dispatch` (emails), `_shared/legalEmails.ts`, `_shared/customerSampleFixtures.ts` (the sample matter).
- Tables: `legal_firms`, `legal_matters`, `legal_matter_entries`, `legal_portal_links`, `legal_firm_recipients`, `legal_notification_queue`.
- Guides: `share-your-attorney-their-portal`, `manage-who-at-the-law-firm-gets-emails`, `send-a-customer-account-to-your-attorney`, `review-a-collections-account-before-it-goes-to-your-attorney`.

## How to verify

The sample portal: `/legal?t=sample` draws `sampleLegalPortalResponse` with nothing saved. The real one: the Legal desk's **Firm's link → Preview ↗** (`?preview=1`, never counted as the firm's open). Function changes need `supabase functions deploy legal-portal` (and the others by name) after merge.

## Where it stands

Built 2026-10-05 evening to 2026-10-06 morning: item 1 and 2 by the coordinating session; the rest by five lanes (A copy and phone, B money and property, C functions and the sample, D lifecycle and acts, E emails), each reviewed by an adversarial reader before an integrator fixed, rebased and merged it. Every mockup is beside this card. Every migration on main is applied and every train function is deployed, except:

- **#4690**, the migration that makes the queue carry office events (`20261006170000`). The deployed dispatcher words any event it does not know as *Pulled back*, so it merges only after `legal-notify-dispatch` from #4640 is live; then `supabase db push` and redeploy `submit-legal-portal`.
- **`legal-send-firm-link`** bundles shared email words committed after its deploy (its own folder did not change, so the drift check calls it current). Redeploy it.

Found by the reviews and left for later:

- A message the mail service accepts and then bounces is not caught; that needs Resend's webhook events.
- Anyone holding the firm's link can make the company send up to 12 confirmation emails, as often as they like; no rate cap on adding a person or resending.
- Two overlapping dispatcher runs can send the same email twice (claim rows with `FOR UPDATE SKIP LOCKED`); 50 events stuck retrying can hold back new ones for up to an hour.
- The contact-scope rule (item 24) reads job numbers out of prose, so a year or a phone fragment that equals a job number matches; `customer_contacts` has no job column.
- *Recorded by* is the firm's own claim; anyone holding the link can pick any name.
- A GC who is not the payer reads *GC* on the portal; the grid's *Paid out to GC* and *10 % reserved* stay *?* after the owner answers.
- A second agreed write-down overwrites `agreed_write_down_previous_amount`, so the bill prints at the amount before the last write-down.
- After the hash-only migration the Lien desk share says a link is live but cannot show it; the office sees the link only when it mints or rotates one.
- Every public page is eager in `App.tsx`, so the main chunk is 4.9 MiB; PR CI does not run the production build, which is how v2.4655 broke every deploy for six hours (fixed v2.4687).
