---
name: "Customer reviews: one link that is theirs, and the ask after a paid job"
number: 185
group: gated
status: proposed 2026-10-26 · waiting on the owner's yes and his call on the Google ask
summary: >
  The customer's side, lens 9 of the 2026-10-26 look at the whole app. Today a homeowner gets
  up to four different links over one job (the estimate's accept link, Stripe's Pay now, the
  pay page, the portal's short address on the bill email's code), and nothing asks how we did:
  the residential flow already seeds a Review asked step after Paid, but no page takes a review
  and no line carries a link. The refinement: {portal}, the customer's short address, as the
  close of every text that has no link of its own, and a portal worth bookmarking (the job's
  steps, the bill, the papers, the review). The add: a review page of its own, /r/<token>, two
  taps for the stars and a line in their words, stored on the job; at five stars the ask to
  put it on Google; at fewer, "what could we have done better" and a Needs you line so someone
  calls. Google's policy forbids asking only the happy customers to post, so the Google ask is
  the owner's call, with the recommendation to show it to everyone after the direct review.
next: The owner's three calls (the Google ask to everyone or only at five stars; the morning after Paid; a page of its own), then PR 1, the table and the page.
size: M, as four PRs after this one, S M S M
blocker: The owner's call on the Google ask. Google's policy names asking only the happy ones as rating manipulation.
ver: proposed
opinion: build — the direct review page first (PR 1), the Google ask to everyone after it, offered the morning after the job pays so a person presses
mockup: to-dos/customer-reviews/mockup.html
---

# Customer reviews: one link that is theirs, and the ask after a paid job (#185)

## The ask

The owner, 2026-10-26, in a look at the whole app's user experience one lens at a time. On lens
9, the customer's side, he chose:

> Refine: reuse the portal slug in every text so a customer has one bookmark. Add: a review ask
> after a paid job.

And on the review:

> I think we should add the tooling for reviews, I think we should see a review directly and
> then if they say 5 stars ask them if they would be willing to put it on google for us.

Two pieces, one customer. The first is a refinement of the texts that already go; the second is
new tooling. This to-do plans both, argues against the plan, and asks the owner the one question
the plan cannot answer for him: whether the Google ask goes to everyone or only to the five-star
customers, as he asked, with the policy risk named.

## Today: which texts and emails carry which links

Read from [`tellCustomer.ts`](../../src/lib/tellCustomer/tellCustomer.ts) (the app's own lines),
[`blanks.ts`](../../src/lib/quickReplies/blanks.ts) (the fill table), [`nudgeDispatch.ts`](../../src/lib/flows/nudgeDispatch.ts)
(the morning run's lines), [`stageSends.ts`](../../src/lib/flows/stageSends.ts) (a board move's
text), [`customerJourneys.ts`](../../src/lib/customerJourneys.ts) (every outside surface) and the
residential flow's seed ([`seed.ts`](../../src/lib/flows/seed.ts)).

| Moment | How it goes | The link it carries |
|---|---|---|
| Booked, Rescheduled | Tell the customer, a text | none. *{tech} will text you when on the way.* |
| On the way, Arrived | the tech's phone press, a text | none |
| Estimate sent | Tell the customer: the email and a text | `{link}`, the accept page `clicktooling.com/estimate/accept?t=…`, a token kept as a hash, filled when the email goes; `{estimate}` for a link shared from a thread |
| Approved (the reminder) | the morning run, Off · Offers · Sends | none. *Any word on the estimate?* |
| Working, Done, Billed | a Pipeline move with the step set to Asks, a text | none. *Your bill follows by email. Text me here with any question.* |
| Billed | the Stripe bill email | Stripe's **Pay now**, the PDF, and the QR code and short address `my.clickplumbing.com/<slug>` to their statement. The bill email mints the slug on its own (`ensurePortalShortAddress`) |
| Paid (the reminder on the pay-by day) | the morning run | `{bill}`, the pay page `clicktooling.com/pay/<id>` of the job's newest bill (v2.5628) |
| A lien notice | paper | the pay code, the same `/pay/<id>` |
| Review asked | nothing goes. The strip's **Ask for a review** fills the reply box while the app's own send is off (v2.5413); the step's fact `review_asked` is read from any text of ours on the job that says *a review* or *review us* | none: *there is no blank for a review link yet* (#127's note) |
| The portal | `/p/<slug>`, short `my.clickplumbing.com/<slug>` | their open bills with Pay, Your payments, Your papers (agreements, waivers, test reports), Request a visit, Ask for a bid. A GC customer's job page draws *Where you are*; a homeowner's portal does not draw the residential flow's steps |

A sent file's link `/f/:link` is a trade partner's surface (`gc-file-link`), not a homeowner's; a
homeowner's papers are on the portal. So one homeowner, one job, can hold four links in four
places: the accept page in a text, Pay now in an email, the pay page in a reminder, the portal on
a code. None of them is the one to bookmark, and the one that could be, the portal, does not say
where the job stands.

## One link that is theirs

**The refinement.** A `{portal}` blank in the fill table (*their portal's short address, from
the page*), filled from the customer's slug the way `{bill}` is filled from the newest bill, the
slug minted on first use by the shared kernel the bill email already uses
([`portalShortAddress.ts`](../../../supabase/functions/_shared/portalShortAddress.ts)). Then the
rule, in the app's own lines and offered as the starter lines' close: **a text carries the link
for its moment; a text with no link of its own closes with the portal.** The estimate text keeps
the accept link and the pay reminder keeps the pay page, because each is the press that matters
that day and a text with two links is worse than one. Booked, Working, Done and Billed gain one
close: *Everything about this job is at {portal}.* The bill email keeps the code.

**What the portal must show for the bookmark to be worth it.** Today it shows the money and the
papers. It must also show:

- **Where the job stands**, the residential flow's steps as the customer feels them: Booked,
  On the way, Estimate sent, Approved, Working, Done, Billed, Paid. The kernel exists,
  [`portalSteps.ts`](../../src/lib/flows/portalSteps.ts)'s `customerJobSteps` over
  [`portalPage.ts`](../../src/lib/flows/portalPage.ts), drawn today for a GC customer's job
  page only. The homeowner's portal draws the same card over the residential reading.
- **The estimate to approve**, as a door: *Your estimate for the water heater is ready, $1,850.
  Open it to approve.* The signing stays on the tokened accept page, since the page records the
  consent, the IP and the signature; the portal only carries the door.
- **The bill**, already there, and **the papers**, already there.
- **The review**, below: *How did we do?* while the ask is open; *Thank you for your 5 stars*
  after.

**What it costs.** S for the blank and the closes (the fill table, `tellFills`, `replyFills`,
the four default lines, their Spanish). M for the portal: `customer-portal` reads the
residential flow for a homeowner (the kernel copy under `_shared/gcKernels/` already carries
`flows/state.ts`), the Where you are card on the homeowner's Home, the estimate door, the review
card. The portal's payload grows by one read per job; the page is already the heaviest public
page, so the flow read is one query over `messages`, `jobs_ledger_invoices` and
`job_schedule_blocks` scoped to that customer's open jobs, not a second portal.

## The review ask

**What exists.** The residential flow seeds **Review asked** as its last step (`review`, our
move, usual 2 days after Paid, *After you pay.*), with the fact `review_asked` and the strip's
**Ask for a review** press. The seed says *the review ask waits for the stage sends after paid.*
Nothing sets the fact but a text that happens to say *a review*; nothing takes a review.

**The plan**, as the owner described it, with the policy point raised below.

1. **The text.** The step's own line, the office's to change in Settings → Flows:
   *{first}, thank you for paying for {job}. Would you tell us how we did? It takes two taps:
   {review}.* Spanish beside it. `{review}` is a new blank, *their review page's link*, minted
   on the press.
2. **When it goes.** The Review asked step is our move, so the morning run's `nudgeDue` never
   fires on it. The run gains one rule, scoped to this step: **an our-move step with a reminder
   reads due from the day the step before it turned true.** The morning after a job's last bill
   is paid, the run offers the review text in **Today's sends** on the Dashboard, where a person
   presses it (the step's switch, **Off · Offers · Sends**, default Offers). The same gates as
   every reminder: snoozed, no number, STOP, sent lately. One new hold: **the customer waits in
   Needs a reply**, with why, so nobody is asked how we did while they are waiting on us. The
   strip's **Ask for a review** and Tell the customer fill the same line, so the office can send
   it by hand any day.
3. **The page.** `/r/<token>`, public, light theme (`data-theme="light"`), English and Spanish
   by the customer's language (`customerLang`), the estimate accept page's shape: the company
   name, *How did we do on the water heater, Dana?*, five stars, one line *A sentence in your
   words, if you like*, one press **Send**. The token is kept as a hash on the row, the
   estimate's pattern; the page is dead after the row is answered or 60 days.
4. **The row.** A new table `customer_reviews`: the job, the customer, the contact, the token's
   hash, `stars` 1 to 5, `words`, `lang`, `asked_at` and `asked_by`, `opened_at`, `answered_at`,
   `google_pressed_at` (they pressed the Google button; we never learn whether they posted),
   `better` (their answer to what we could have done better), `called_at` and `called_by` (the
   office's follow-up), one row per job. RLS for the office roles
   (`is_dev_or_master_or_assistant()`, as `office_inbox_papers`), the three fences, lock timeout.
5. **Then, at five stars:** *Thank you. Would you put this on Google for us? It takes a minute.*
   and one press **Post it on Google**, which opens the company's Google review link and copies
   their words to the clipboard so they can paste. The link is an `app_settings` key,
   `google_review_link_v1`, that a dev sets under Settings → What customers see → **Reviews**;
   while it is empty the page never mentions Google. Nothing is fabricated: the link is the one
   Google's own help page makes (*Create a Google link or QR code to request reviews*,
   support.google.com/business/answer/16816815).
6. **At fewer:** *Thank you for telling us. What could we have done better?* one more line, and
   *Someone from the office will call you.* The row keeps it; the Dashboard's **Needs you** gains
   the line *Dana gave 2 stars on job 1312 · call her* (kicker Customers, amber, the revenue
   tier), its door the customer's thread in Messages with **Add to my calls**; the thread gets
   the app's event line *⚠ Dana left 2 stars on job 1312: "the mess on the floor."*
7. **Where the office reads it.** The thread's event line at any score (*⭐ Dana left 5 stars
   on job 1312: "Luis was in and out in an hour."*, the estimate line's pattern); the job
   window's Job tab, a **Review** line under the money; the Customer Hub's timeline, one line
   per review; the Pipeline's Paid in Full rows, the stars beside the job (*not asked* dim, *asked
   Oct 27* until answered); and the Reviews block on What customers see: the Google link field,
   this month's count, the average, the last five, the Google presses.

## Google's policy, said plainly

Google's Maps user-contributed content policy, under *Rating Manipulation*, lists what merchants
may not do, and one item is to "discourage or prohibit negative reviews, or selectively solicit
positive reviews from customers" (support.google.com/contributionpolicy/answer/7400114, read
2026-10-26). Showing the Google button only to the five-star customers is that, in the words of
the policy; the trade calls it review gating. What Google does when it finds it is at its own
discretion, and the reports are of reviews taken down and listings suspended.

Two honest ways, and a recommendation:

- **A · The Google ask to everyone, after the direct review.** Every customer who answers sees
  the same Google line and the same button. A customer who gave 2 stars sees the *what could we
  have done better* question first and the office's promise to call, then the Google line under
  it, the same words. This is the policy's own shape. The cost is real: a 2-star customer may post
  2 stars. The counter is that the direct review caught them first, the office calls the same
  day, and a customer who has been called rarely runs to Google.
- **B · The Google ask only at five stars, as asked.** The page does what the owner described.
  The risk is the listing itself, the thing the reviews are for.

**The recommendation is A.** The owner's two goals both hold: we see every review directly, and
the happy ones are asked to post. The five-star page leads with the Google ask; the lower page
leads with the question and the call. The office keeps the choice in one constant,
`GOOGLE_ASK_AT`, set to *everyone*, so the page can be made B in one line if the owner decides
the risk is his to take. The decision is his, and this to-do does not build until he makes it.

## Is this the best we can do?

Argued against, and changed where the argument wins.

**The day the job pays, or the week after?** The pay moment is a money moment, not a work
moment; a text one minute after the card clears reads as a machine. The week after, the tech's
name is gone from memory. The goodwill peak is the Done step, the hour the tech leaves and the
water is hot, but a review asked before the bill reads as a trade, and a surprise on the bill
would then land on Google after a 5-star page. The seed's two days is the middle. **Changed:**
the run offers it **the morning after** the last bill is paid, never the same hour, through
Today's sends so a person reads the thread first, and holds it while the customer waits on us.
The strip keeps the by-hand door for the office that wants to ask at Done.

**A new page, or ride the portal?** The portal is public by slug, light, bilingual, already
theirs; a review card on it would make the refinement and the ask one PR. Against it: the portal
is the heaviest public page the app serves and the review must be two taps from the text; the
portal's slug is a read door, and an answer should be tied to the ask (which job, which text,
which day) by a token that dies, not a slug that lives. **Kept:** the page is its own,
`/r/<token>`, small and fast. **Changed:** the portal shows the review's state and carries the
same door, so the bookmark reaches it too, and the review page's footer links the portal.

**Only at five stars, or everyone?** Above. A.

**Is a review that never reaches Google worth the customer's time?** For the office, yes three
ways: the unhappy customer is caught before Google and called; the words are ours to quote, with
the customer's leave, where the app already shows testimonials (the hazmat notice names them);
and the tech's name on a 5-star review is a record the crew can see. For the customer the page
costs ten seconds, and the words line is optional. The honest cost is that a five-star customer
is asked twice, here and on Google. **Changed:** the page says so up front, *Two taps here. If
you have a minute more, Google*, and copies their words for the paste, so the second ask is one
press and no retyping.

**The smallest version that brings the first review in.** A `{google}` blank filled from the
same `app_settings` key, and the Review asked step's starter line *{first}, thank you for your
business. Would you leave us a review on Google? {google}*, pressed from the strip. XS, no
table, no page, and it asks everyone, so it is policy-safe. It skips what the owner asked for
first, seeing the review directly, and it never catches the unhappy customer. **Not taken as the
plan, named as the fallback:** if the owner wants a review this week, PR 0 is that blank and
that line, and PR 1 replaces the line's link.

## Decisions for the owner

1. **The Google ask:** A, everyone after the direct review, or B, five stars only. The
   recommendation is A.
2. **When:** the morning after the job pays, offered on Today's sends by default (Offers), or
   sent by the app at 9 AM (Sends). The recommendation is Offers until twenty have gone.
3. **The page:** its own `/r/<token>`, with the portal showing its state. The recommendation
   is yes.
4. **The refinement's rule:** a text carries its moment's link and closes with the portal only
   when it has none, or the portal in every text as asked. The recommendation is the first, so
   the estimate and the pay reminder stay one press.
5. **The fallback:** PR 0, the `{google}` blank alone, this week, or straight to PR 1.

## The mock-up

[`mockup.html`](./mockup.html), served at `/to-dos/customer-reviews/mockup.html`. Phone width
first, since the customer reads it on a phone: the text as it lands, the review page with the
stars (tap a star to walk the two paths), the five-star path with the Google ask, the lower path
with the question, and the Spanish of each. One desktop panel for the office: Today's sends with
the offer, the thread's event line, the job window's Review line, Needs you's line for a low
score, and the Reviews block on What customers see. Every name and number is made up: Dana
Whitfield, job 1312 the water heater on Larkspur Lane, Luis Ortega the tech, Rosa at the office,
$1,850.

## Where it plugs in

- **The flow:** [`seed.ts`](../../src/lib/flows/seed.ts)'s `review` step gains `nudge: { days: 1,
  how: 'text', send: 'app', dayFact: 'paid' }` and `callScript`; a seed change moves the
  `messages_flows` and `residential_flow` bed counts and `flowsSql.test` pins the facts to the
  newest migration, so the step's change ships in PR 2's migration.
  [`facts.ts`](../../src/lib/flows/facts.ts)'s `review_asked` reads the row's `asked_at` first
  (kept *yes*), the text's words as before.
- **The run:** [`nudges.ts`](../../src/lib/flows/nudges.ts)'s due reading gains the our-move
  rule for a step whose `dayFact` names the step before it; [`nudgeDispatch.ts`](../../src/lib/flows/nudgeDispatch.ts)'s
  `NUDGE_LINES.review` and the Needs a reply hold; the edge copy under
  `_shared/gcKernels/` follows (`check:edge-drift` names `messages-nudge-dispatch`).
- **The blanks:** [`blanks.ts`](../../src/lib/quickReplies/blanks.ts) gains `portal` and
  `review` (from `page`); `tellFills` and `replyFills` fill them; the review link is minted on
  the press by the RPC `customer_review_ask(job_id)`, which inserts or returns the job's row and
  answers the link once (the token itself is never stored).
- **The table:** `customer_reviews`, migration numbered from `origin/main`'s newest
  (`20261025170000_rider_cap_at_bill_amount.sql` today), `SET lock_timeout = '3s';` first, the
  three fence appliers last, `docs/migrations/<version>_customer_reviews.md`.
- **The function:** `customer-review`, `verify_jwt = false`, GET answers the page by token
  (the job's name, their first name, the company, the language, whether answered), POST takes
  the stars, the words and `better` once, stamps `google_pressed_at` on the press, writes the
  thread's event line through a shared `reviewThreadLine.ts` (the
  [`estimateThreadLine.ts`](../../../supabase/functions/_shared/estimateThreadLine.ts) pattern,
  best effort). Deployed after the merge; its section in `docs/EDGE_FUNCTIONS.md`.
- **The page:** `src/pages/CustomerReview.tsx` at `/r/:token` outside `ProtectedRoute`, the
  estimate accept page's shell and sample mode (`sampleStateFromToken`). The four registrations
  an outside surface needs: the texts land in the thread through `quo-send` as every text does
  (no email, so `fileSentCopy` does not apply); [`customerSurfaceRegistry.ts`](../../src/lib/customerSurfaceRegistry.ts)
  gains the route and the function; [`customerJourneys.ts`](../../src/lib/customerJourneys.ts)
  gains `review-text` and `review-page` on the homeowner strip with a sample from a shared
  builder; [`personJourney.ts`](../../src/lib/journeys/personJourney.ts) answers the step
  (asked, opened, answered with the stars, Google pressed). `docs/twins/APP_DIRECTORY.md` gains
  the route.
- **The office:** [`dashboardNeedsYou.ts`](../../src/lib/dashboardNeedsYou.ts)'s `review-low`
  key at tier 40 with its input in `useNeedsYouInputs`; the job window's Job tab line; the
  Customer Hub's timeline; the Paid in Full rows; the Reviews block on
  [`SettingsWhatCustomersSeeTab.tsx`](../../src/components/settings/SettingsWhatCustomersSeeTab.tsx)
  over `app_settings.google_review_link_v1` (`appSettingsKeys.ts`).
- **The portal:** `customer-portal` reads the residential flow for a homeowner and the review's
  state; `CustomerPortal.tsx` draws Where you are and the review card.
- **Words:** the guide *ask a customer for a review* in `src/content/help/` in plain words, and
  one paragraph on *see what a customer sees on their portal*; the Glossary's **Flows** and
  **Tell the customer** entries; `PROJECT_DOCUMENTATION.md`; `MESSAGES_ARCHITECTURE.md`'s table.

## The plan

1. **PR 1, this folder** (docs only).
2. **PR 2, the table and the page** (one version, S): the migration, `customer-review`, the
   page in both languages, the sample, the registry and journey entries, the thread's line, the
   guide. Pushed and deployed after the merge. The office can mint a link by hand from the
   strip and paste it; the first review can come in from this PR alone.
3. **PR 3, the step and the text** (one version, M): `{review}` and `{portal}`, the step's
   line and script, the run's our-move rule and the Needs a reply hold, the offer on Today's
   sends, the four closes, the bed counts.
4. **PR 4, the Google ask and the office's view** (one version, S): the `app_settings` key
   and its block, the five-star page's ask, the lower page's question, `review-low` on Needs
   you, the job window's line, the Customer Hub's line, the Paid in Full stars.
5. **PR 5, the portal** (one version, M): Where you are for a homeowner, the estimate door, the
   review card. Last, since the first four stand without it.

## How to verify

PR 2 on prod, as the dev, on a ZZ test job with a ZZ test customer whose number is the dev's:
mint the link from the strip, open it on a phone, send 5 stars and a line; read the row, the
thread's event line and the Paid in Full stars. Open the link again and read *already answered*.
PR 3: pay the test job's bill by check at the bank deposits window, wait for the next morning
run or fire `messages-nudge-dispatch` with the cron secret, and find the offer on Today's sends
with the test customer's name; press it and read the text on the dev's phone. Leave a Needs a
reply line from the test number first and read the hold's why. PR 4: send 2 stars, read the
Needs you line and press through to the thread; set the Google link on the block and read the
five-star page's button. Nothing is pressed on a real customer; every test row is deleted after.

## The decision

Not yet made. The owner reads this and answers the five calls above, or says *build it* and the
build takes every recommendation.
