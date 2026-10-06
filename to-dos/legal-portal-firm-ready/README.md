---
name: "Legal portal: ready for the firm"
number: 85
group: ready
status: being built from the worktree legal-portal-docs-723ea9, 2026-10-05 evening — one PR per item, mockup first, each mockup beside this card
summary: >
  The portal's data model and two-way channel are a real selling point, but the firm-facing
  surface still speaks the office's language, the print packet hands the firm the office's own
  triage, and the lien grid shows every billed job in the company. Two reviews on 2026-10-05
  (four readers over the code, one over the sample portal in a browser) agreed on 29 items.
  Items 1–11 would show in a demo; 12–21 are what a firm will ask for in month one; 22–29 are
  structure. Each item gets a mockup, a hard look ("is this the best we can do?"), then the build.
next: Item 1, the firm's own print packet. Then 2 (lien grid scope), 3 (vocabulary), 4 (facts not theories), 5 (money that foots), 6 (property per job), 7 (generic errors), 8 (phone), 9 (sample matter), 11 (order). Item 10 is the owner's (fill the particulars in Settings).
size: XL (29 items; 1–11 are S each, 12–21 M, 22–29 S–M)
blocker: None. Decisions taken 2026-10-05 — share everything with counsel by default (29); one firm (27); settlement by threshold (20).
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
2. **Scope the Lien grid to referred matters.** Shape the desk rows so skip reasons, owner-call notes, owner emails and GC policies never leave. No tab while a firm has no matters.
3. **Firm vocabulary.** *Needs You list*, *From Click*, *Click's particulars*, *Their word*, *counsel's pile*, *chose to share*, stage chip *new*, *Tell me*, *waiting for their click*, raw kind names (*recovery applied*), the hard-coded *Click's legal portal* email footer.
4. **Facts, not theories.** *Sworn account holds* becomes *bill sent, crew on site with GPS, no dispute logged*. *Terms with Click* becomes the invoice's due days, not the credit posture.
5. **Money that foots.** Invoice rows at original amount with the write-down beneath; unlinked payments reduce the balance; contingency rows out of the firm's total demand; one formatter so `$-4,000.00` cannot appear.
6. **Property per job.** The project address from the job's address and owner override, not the payer's address list; the lien clock from that.
7. **Generic error messages** from both functions.
8. **Phone layout** at 375px: one column, stacked forms, tables that scroll inside their card.
9. **A consistent sample matter** (a GC, a property record, a dated payment, a demand letter, lien paper). Needs a `legal-portal` redeploy.
10. **Fill the particulars** in Settings (license, registered agent, custodian, affiant). The owner's.
11. **"Largest first"** in the guide vs release-date order on the page. Pick one.

### After the firm is heard

12. **Documents, both ways.** Invoice PDFs, the demand letter as sent, filing copies in storage, report and photo links; a firm upload act; signed links minted on click.
13. **Debtor identity.** Legal entity name, entity type, registered agent, SOS number, guarantors, surety and bond number; the invoice's bill-to party.
14. **Contract terms and interest.** Rate, fees clause, venue; the Prompt Payment interest and fee clock the demand letter already computes.
15. **Proof of delivery** per invoice: sent, delivered, opened.
16. **Lifecycle.** Settled stays visible until the office closes it; payment plan, uncollectible, dismissed, post-judgment; no silent backward moves; a pulled-back matter stays readable with the reason.
17. **Threaded conversation.** Return the acknowledged stamp; link answers to questions; close withdrawn asks; email the firm on every event.
18. **Acts a firm can trust.** Void with reason on both sides; *recorded by* from the recipient list; a date the firm sets; idempotency; a per-matter limit.
19. **A dispute block** with amount, what was disputed and resolution.
20. **Settlement authority** as a threshold the firm can see, and an ask below it.
21. **Welcome email** with the link from the desk; confirmation failures shown.

### Structure and refactors

22. **Hash-only tokens at rest**, no-store headers, a referrer policy, short PDF link life after revoke, the Rotate confirm says every emailed link dies.
23. **Shape the payload** to what the page draws.
24. **Scope contacts** to the matter's jobs.
25. **One evidence rule** for sessions.
26. **Send failures retried and surfaced**; stamp per recipient; mint unsubscribe links once.
27. **One firm**, said in schema and copy.
28. **Honeypot** wired or dropped.
29. **Share-all default** for the "what was said" entries, with a per-entry hold and reason.

## Where it plugs in

- Page: `src/pages/LegalPortal.tsx`; matter view: `src/components/jobs/legal/LegalFirmMatterView.tsx` (+ `legalFirmMatterViewShared.ts`); grid: `LegalPortalLienGrid.tsx`; the office's link button: `LegalPortalLinkButton.tsx`; the desk: `LegalDeskModal.tsx`.
- Kernels: `src/lib/legal/legalPacket.ts` (the packet), `legalPacketPrint.ts` (the office print), `legalPortalPayload.ts` (payload → packet), `legalLienPaper.ts`, `legalAsks.ts`, `legalMatters.ts`.
- Functions: `supabase/functions/legal-portal` (GET, the payload), `submit-legal-portal` (POST, the firm's acts), `legal-notify-dispatch` (emails), `_shared/legalEmails.ts`, `_shared/customerSampleFixtures.ts` (the sample matter).
- Tables: `legal_firms`, `legal_matters`, `legal_matter_entries`, `legal_portal_links`, `legal_firm_recipients`, `legal_notification_queue`.
- Guides: `share-your-attorney-their-portal`, `manage-who-at-the-law-firm-gets-emails`, `send-a-customer-account-to-your-attorney`, `review-a-collections-account-before-it-goes-to-your-attorney`.

## How to verify

The sample portal: `/legal?t=sample` draws `sampleLegalPortalResponse` with nothing saved. The real one: the Legal desk's **Firm's link → Preview ↗** (`?preview=1`, never counted as the firm's open). Function changes need `supabase functions deploy legal-portal` (and the others by name) after merge.

## Where it stands

Started 2026-10-05 evening. The reviews that produced the list are in the two sessions' transcripts (this card is their record).
