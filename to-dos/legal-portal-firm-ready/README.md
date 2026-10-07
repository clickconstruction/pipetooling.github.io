---
name: "Legal portal: ready for the firm"
number: 85
group: waiting
status: 23 of 29 built, merged and live 2026-10-06 (v2.4615–v2.4681, v2.4649 with its migration); follow-ups v2.4701 (the exhibits), v2.4711 (the firm's door), v2.4712 (replace the firm, migration 20261006234500) and v2.4749 (the grid reads better), all live; 12–15 and 19 wait for the firm; 10 is the owner's
summary: >
  The portal's data model and two-way channel are a real selling point, but the firm-facing
  surface still speaks the office's language, the print packet hands the firm the office's own
  triage, and the lien grid shows every billed job in the company. Two reviews on 2026-10-05
  (four readers over the code, one over the sample portal in a browser) agreed on 29 items.
  Items 1–11 would show in a demo; 12–21 are what a firm will ask for in month one; 22–29 are
  structure. Each item gets a mockup, a hard look ("is this the best we can do?"), then the build.
next: The owner swaps ZZ Test Firm for the real firm with *Replace with a new firm…* in the Legal desk's firm window, and fills the particulars (item 10, 0 of 8 on 2026-10-06). At the meeting, ask the firm what it needs at intake, and ask it to review and sign off the guide *read the Texas lien rules the app follows*. After it, shape items 12–15 and 19 from the firm's answers.
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

1. ~~**A firm print packet.**~~ (v2.4615; follow-up v2.4701: each exhibit on the portal says where it really is) Its own builder: no *Before release* gaps, no worth-it verdict, no *a firm has not been assigned*, no *nothing held back* (the function hard-codes the count to zero); the firm's own fees and steps printed. The desk keeps the office packet.
2. ~~**Scope the Lien grid to referred matters.**~~ (v2.4616 — the owner kept the whole book, stripped) Shape the desk rows so skip reasons, owner-call notes, owner emails and GC policies never leave. No tab while a firm has no matters.
3. ~~**Firm vocabulary.**~~ (v2.4625) *Needs You list*, *From Click*, *Click's particulars*, *Their word*, *counsel's pile*, *chose to share*, stage chip *new*, *Tell me*, *waiting for their click*, raw kind names (*recovery applied*), the hard-coded *Click's legal portal* email footer.
4. ~~**Facts, not theories.**~~ (v2.4634) *Sworn account holds* becomes *bill sent, crew on site with GPS, no dispute logged*. *Terms with Click* becomes the invoice's due days, not the credit posture.
5. ~~**Money that foots.**~~ (v2.4677) Invoice rows at original amount with the write-down beneath; unlinked payments reduce the balance; contingency rows out of the firm's total demand; one formatter so `$-4,000.00` cannot appear.
6. ~~**Property per job.**~~ (v2.4678) The project address from the job's address and owner override, not the payer's address list; the lien clock from that.
7. ~~**Generic error messages**~~ (v2.4646) from both functions.
8. ~~**Phone layout**~~ (v2.4639) at 375px: one column, stacked forms; since v2.4808 every table and the Lien grid fold into labelled cards when their box is narrow, and small type reads 12px on a phone.
9. ~~**A consistent sample matter**~~ (v2.4638) (a GC, a property record, a dated payment, a demand letter, lien paper). Needs a `legal-portal` redeploy.
10. **Fill the particulars** in Settings (license, registered agent, custodian, affiant). The owner's.
11. ~~**"Largest first"**~~ (v2.4635, largest balance first) in the guide vs release-date order on the page. Pick one.

### After the firm is heard

12. **Documents, both ways.** Invoice PDFs, the demand letter as sent, filing copies in storage, report and photo links; a firm upload act; signed links minted on click.
13. **Debtor identity.** Legal entity name, entity type, registered agent, SOS number, guarantors, surety and bond number; the invoice's bill-to party.
14. **Contract terms and interest.** Rate, fees clause, venue; the Prompt Payment interest and fee clock the demand letter already computes.
15. **Proof of delivery** per invoice: sent, delivered, opened.
16. ~~**Lifecycle.**~~ (v2.4681, v2.4645) Settled stays visible until the office closes it; payment plan, uncollectible, dismissed, post-judgment; no silent backward moves; a pulled-back matter stays readable with the reason.
17. ~~**Threaded conversation.**~~ (v2.4626, v2.4649 with its migration) Return the acknowledged stamp; link answers to questions; close withdrawn asks; email the firm on every event.
18. ~~**Acts a firm can trust.**~~ (v2.4640, v2.4648) Void with reason on both sides; *recorded by* from the recipient list; a date the firm sets; idempotency; a per-matter limit.
19. **A dispute block** with amount, what was disputed and resolution.
20. ~~**Settlement authority**~~ (v2.4643) as a threshold the firm can see, and an ask below it.
21. ~~**Welcome email**~~ (v2.4624) with the link from the desk; confirmation failures shown.

### Structure and refactors

22. ~~**Hash-only tokens at rest**~~ (v2.4669, v2.4647), no-store headers, a referrer policy, short PDF link life after revoke, the Rotate confirm says every emailed link dies. Since v2.4750 the office reads a live key back from Vault through `list_legal_portal_links` (the owner's ask: every link on the window, copyable); the table still holds no key.
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

Built 2026-10-05 evening to 2026-10-06 morning: item 1 and 2 by the coordinating session; the rest by five lanes (A copy and phone, B money and property, C functions and the sample, D lifecycle and acts, E emails), each reviewed by an adversarial reader before an integrator fixed, rebased and merged it. Every mockup is beside this card. Every migration on main is applied, and every train function is deployed and current as of 2026-10-06 14:30Z, checked with no grace window (`EDGE_DRIFT_GRACE_HOURS=0`; the default waits 72 hours before calling a function behind). The site deployed at 13:54Z, the first deploy since v2.4655 broke the build.

**The firm's door** (2026-10-06, the owner's ask after the train): the firm's name in the Legal desk's header opens the firm's window over the desk, the Settings block itself for a dev and read only for the office (v2.4711). *Replace with a new firm…* in that window retires a stand-in and adds the real firm in one call (v2.4712, `legal_replace_firm`, migration `20261006234500`). Mockup: `mockup-firm-door.html`.

**The grid reads better** (2026-10-06, the owner's second ask, v2.4749): the address under the job, the property in words, the unpaid total before its months, § 53.056 without the closed windows, and a rail of GCs with each one's count and dollars in place of the select. Mockup: `mockup-lien-grid-reads.html`.

**Which court** (2026-10-06, the owner's ask; plan and mockup `mockup-justice-precinct.html`, reordered on the holistic look): step 1, v2.4764, the Court column and *Where to file* from the county, the cap, TRCP 502.4's two venues and the lien line; steps 2–5 are the office's own court-areas layer on the Map page (areas table and kernel; draw, name and save with the jobs as pins; import Bexar, Travis and Hays; nightly classification, the hand override, the desk gap, the precinct on the portal). Step 3, v2.4769: the Map page's Court areas mode. Step 4, v2.4770 (migration `20261007120000`, function `court-precinct-nightly`): the nightly classification, Classify now, the county import script. Step 5, v2.4771: the precinct on the portal, the print and the property record. The owner wants every county with a job drawn: import Bexar, Travis and Hays; draw Guadalupe, Comal and Williamson by hand.

**Documents and the narrative** (2026-10-07, the owner's ask after an evidence pull for a live matter; mockup `mockup-documents-and-narrative.html`): v2.4810 puts documents on a matter (`legal_matter_documents`, the private `legal-matter-documents` bucket, migration `20261007230000`): the desk's Evidence tab takes files with a title and one line on what each shows, the portal lists them under Evidence with 15-minute links, the print letters them as one exhibit.
**The narrative** (2026-10-07, the owner's ask; mockup `mockup-documents-and-narrative.html`): v2.4812 (migration `20261007234000`) adds the office's account of a matter in markdown: the desk's first tab with an outline, a preview and `legal_set_narrative`; the firm's first tab when one is written, labelled as the office's with who and when; the printed packet's first section.

**Who the firm calls** (2026-10-06, v2.4755): a strip under the letterhead with the office number and the assistants to ask for, the controller's own number, and what each is for; the same two lines on the printed packet; the desk's firm window flags a controller with no phone. Mockup: `mockup-reach-the-office.html`. Needs `supabase functions deploy legal-portal`.


Found by the reviews and left for later:

- A message the mail service accepts and then bounces is not caught; that needs Resend's webhook events.
- Anyone holding the firm's link can make the company send up to 12 confirmation emails, as often as they like; no rate cap on adding a person or resending.
- Two overlapping dispatcher runs can send the same email twice (claim rows with `FOR UPDATE SKIP LOCKED`); 50 events stuck retrying can hold back new ones for up to an hour.
- The contact-scope rule (item 24) reads job numbers out of prose, so a year or a phone fragment that equals a job number matches; `customer_contacts` has no job column.
- *Recorded by* is the firm's own claim, since anyone holding the link can pick any name, and the link never expires. Per-person access, a link for each person on the firm's list or an expiry and a fresh link, is the structural fix if the firm asks who can see the portal.
- A GC who is not the payer reads *GC* on the portal; the grid's *Paid out to GC* and *10 % reserved* stay *?* after the owner answers.
- A second agreed write-down overwrites `agreed_write_down_previous_amount`, so the bill prints at the amount before the last write-down.
- After the hash-only migration the Lien desk share says a link is live but cannot show it; the office sees the link only when it mints or rotates one.
- Every public page is eager in `App.tsx`, so the main chunk is 4.9 MiB; PR CI does not run the production build, which is how v2.4655 broke every deploy for six hours (fixed v2.4695, #4689).
