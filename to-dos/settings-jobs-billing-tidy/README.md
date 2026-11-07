---
name: "Settings → Jobs & billing: the 28 cards under six headings, the rare ones folded, a jump strip"
number: 261
group: ready
status: claude/261-settings-jobs-billing-pr2-b46e80 · proposed 2026-11-04 from Grace’s look at Settings → Jobs & billing · PR 1 (v2.6516) built on the recommended defaults · the owner’s look and PR 2 in hand 2026-11-07
summary: >
  Jobs & billing draws 28 cards for a dev in one long column, in the order they were added over a
  year: a switch about HCP numbers first, the law firms' map third, the rate card eleventh, the
  invoice footers near the bottom. Nine of them reach the office and the owner. Twelve cards stand
  open, sixteen fold behind their own ▶, and nothing says which question a card answers. The ask:
  clean it up. The suggestion keeps the tab and every link into it, puts the cards under six
  headings by the question a person brings, folds every form to its title and one line, keeps
  every switch open, pins a jump strip of the headings while the page scrolls, and gives every card
  an anchor so Go anywhere, the Settings search and the guides land on the card itself, which opens
  when it is the target. The usage ledger holds no per-card count, so the folds follow a rule and
  the fold presses start counting.
next: PR 2 (v2.6631) merges and is walked. Then the rename sweep (call 3, Jobs, bills and liens, its own PR cut from fresh main) and PR 3 (call 4, the live value on each Billing and money card's folded row).
size: S (the card) + M (PR 1: the groups kernel, the fold wrapper, the anchors and doors, the strip, the smoke, the docs and guides) + S (PR 2, three cards to other tabs, if wanted)
blocker: Nothing. The owner answered the seven calls 2026-11-07; the table below holds his answers.
ver: v2.6516 (PR 1) · v2.6631 (PR 2)
opinion: build — the tab is the company's money and paper settings, the office cannot find a card without reading all 28, and the fix is headings, a fold shape and anchors, nothing that changes what a card does
mockup: to-dos/settings-jobs-billing-tidy/mockup.html
---

# Settings → Jobs & billing: 28 cards under six headings (#261)

## For Taunya

Jobs & billing is where the company's money and paper settings live: what an hour costs the
customer, what prints on a bill, the questions the crew answers on a stage, who the collections
firm is. Today the page is one long column of cards in the order they were built, and a person
scrolls the whole thing to find one. This card puts the cards under six short headings, each
heading saying what question it answers. A card that is a form folds to its name and one line
until it is pressed. A card that is a switch stays open so its On or Off is read at a glance. A
strip of the six headings stays pinned at the top while the page scrolls, and a press on it jumps
to that heading. Every link into the page still lands on the right card, which opens itself.
Nothing a card does changes.

## The ask, in Grace's words

Grace, 2026-11-04, on Settings → Jobs & billing:

> In Settings, I am looking at the Jobs & billing section and I think that there is so much going
> on in that settings category we could potentially clean it up a little better.

## What exists today

The tab is `SettingsGroup id="settings-jobs"` in `src/pages/Settings.tsx`, mounted for a dev, a
master and the assistant-like roles (`settingsGroups.ts`). Its cards in the order drawn, for a dev.
*Opened* reads the usage ledger (Settings → Usage, `user_app_activity_page_daily` and
`ui_nav_clicks`, 60 days to 2026-11-04): the tab as a whole logged **29 minutes by one person**,
and **no card has a count**, because no Settings card carries a `data-navtrack` marker and a press
on a card's ▶ writes no row. So the column says *no count* for every card, honestly.

| # | Card, as titled | Who sees it | What it sets | Folds today | Anchor today | Opened |
|---|---|---|---|---|---|---|
| 1 | Hide the HCP field on New/Edit Job | dev | `app_settings`: the empty HCP box off the job form | open (switch) | none | no count |
| 2 | Sub portal · pay schedule | dev | the subs' pay-run weekday and the *How pay works* words on their portal | open | none | no count |
| 3 | ⚖ Collections law firms | dev | each collections firm, its people, fee model, the Texas counties it covers, the claimant's particulars (`legal_firms`, `legal_firm_counties`) | open, with the county map | `settings-legal-firm` (the Legal desk's firm window, one guide) | no count |
| 4 | The office's county for sworn statements | dev | `app_settings`: the venue county a sworn statement opens on | open | none | no count |
| 5 | Uncollectible: the accountant's list | dev | reads the bills given up on, by year, CSV | ▶ | none | no count |
| 6 | Company owner account | dev | `app_settings.company_owner_user_id`; re-assign every job from one account to another | ▶ | none (search: *Re-assign jobs*, lands on the tab) | no count |
| 7 | Default Labor Rate (dev) | dev | the $/hr a new labor job starts at | ▶ | none | no count |
| 8 | Turnaway Trip Charges (dev) | dev | the amount per turnaway reason | ▶ | none (search: *Trip charge amounts*) | no count |
| 9 | Rates charged by crew | dev | the rate card by crew shape, and *Who counts as what* (`users.charge_standing`) | ▶ | none; the Charges window links `#who-counts-as-what` inside it | no count |
| 10 | Markup on materials | dev | percent over cost on materials | ▶ | none (search: *Markup on materials*) | no count |
| 11 | Job address city line breaks (dev) | dev | extra city names the address parser knows | ▶ | none | no count |
| 12 | Property county suggestions (dev) | dev | extra city = county pairs | ▶ | none | no count |
| 13 | Manage developments | dev | the developments list: rename, default GC, archive | ▶ | none (the Development page's Edit lands on the tab) | no count |
| 14 | Job Book (Collect Payment line items) | dev · master · office | the Collect Payment line items and job numbering | ▶ | none (search: *Job book*) | no count |
| 15 | Photos | dev · master · office (set: dev · master) | the long edge a report photo is shrunk to | open (one pick) | none | no count |
| 16 | Test reports — who certifies, and the words on the paper | dev · master · office | the certifier and the sentences on hydrostatic, pinpoint and gas reports, and who sends | ▸ | none (Contracts & terms' *edit* door lands on the tab) | no count |
| 17 | Stage checklists | dev · master · office | the questions for Rough In, Top Out and Trim Set | open, the whole editor | none | no count |
| 18 | Liens · owner of record | dev · master | the nightly save-from-the-roll switch | open (switch) | none | no count |
| 19 | GC jobs · pay by card | dev · master | the Pay by card switch on certified GC bills | open (switch) | none | no count |
| 20 | GC jobs · the office's notices | dev · master | the switch for the project manager's and architect's notices, its since-day, preview and test | open (switch + preview) | none (What the team sees' *manage* door lands on the tab) | no count |
| 21 | GC jobs · the customer's notice before a bill is due | dev · master | the switch for the customer's 3-day notice, preview and test | open (switch + preview) | none | no count |
| 22 | GC jobs · the trades' cut-off | the money team | days before bill day, 2 to 20 | open (one number) | none | no count |
| 23 | Stripe invoice footer presets | dev | the plumbing and electrical Stripe footers | ▶ | none (search: *Invoice footers & issuer*) | no count |
| 24 | Physical invoice — company on PDF (customer-facing) | dev | the company block on paper bills and *Signs for the company* | ▶, opens on `?focus=issuer.*` | the `focus` param (the Lien desk, the waiver window, two guides) | no count |
| 25 | Physical invoice footer presets | dev | the paper bill's footers | ▶ | none | no count |
| 26 | Bill Customer memo presets | dev | the memo presets on Bill Customer | ▶ | none (search: *Bill-Customer memo*) | no count |
| 27 | Docsmit · certified mail from the app | dev | the certified-mail service's secrets, switches, *Test the connection* | ▶ | none (a dev door lands on the tab) | no count |
| 28 | HCP reconcile | dev | imports billing history from HouseCall Pro exports | ▶ | none (a dev door lands on the tab) | no count |

So: 28 cards for a dev, 9 for a master, 5 for the office (14, 15, 16, 17 and the cut-off for the
controller). One card has an anchor. Eight Settings search entries name the tab and land on its
top, and one of them, *Dispatch groups*, names a card that does not exist on the tab. Twenty-one
guides say *Settings → Jobs & billing → <card>* and expect the reader to scroll.

## The decision

- **Six headings, by the question a person brings.** Each is an `h3` with one line under it in
  plain words, and an anchor of its own.
  1. **Billing and money** — *What an hour, a part and a trip cost the customer, and the pay
     rhythm.* Rates charged by crew · Markup on materials · Turnaway trip charges · Default labor
     rate · Job Book · GC jobs · pay by card · GC jobs · the trades' cut-off · Sub portal · pay
     schedule.
  2. **The job's record** — *What a job carries: its stages, photos, test papers, development and
     address.* Stage checklists · Photos · Test reports · Manage developments · Job address city
     line breaks · Property county suggestions.
  3. **What a bill says** — *The company block, the footers and the memo that print on a bill.*
     Physical invoice · company on PDF · Physical invoice footer presets · Stripe invoice footer
     presets · Bill Customer memo presets.
  4. **Liens, collections and papers** — *Owners of record, the law firms, the county and
     certified mail.* Liens · owner of record · Collections law firms · The office's county for
     sworn statements · Uncollectible: the accountant's list · Docsmit · certified mail.
  5. **Notices the app sends** — *The emails the app sends on its own about GC bills.* GC jobs ·
     the office's notices · GC jobs · the customer's notice before a bill is due.
  6. **Repairs and old records** — *One-time fixes and what is left of HouseCall Pro.* Company
     owner account · Hide the HCP field · HCP reconcile.
  A heading is drawn only when the role sees a card under it, so a master sees four and the
  office two.
- **One fold shape.** Every card becomes a `SettingsFoldCard`: a header row with the ▶, the title
  and one line of what the card sets, and the body under it. A form folds by default; a switch
  stays open (call 1). The sixteen cards that fold today keep their own ▶ in PR 1 and get the
  anchor and the open-on-target from a shared hook, so the owner's look is one shape without
  rewriting sixteen cards; the twelve open cards are wrapped. A folded card opens when its
  anchor, a child anchor (`#who-counts-as-what`) or its `?focus=` field is the target.
- **Every card has an anchor** (`settings-jobs-<card>`; `settings-legal-firm` stays) registered
  in `SETTINGS_HASH_ANCHOR_TO_TAB`, so `doors.test.ts` holds a door for each: the Settings search
  entries that named only the tab gain their `anchorId`, the cards with no entry get one, the
  dev doors point at their card, Contracts & terms' two *edit* doors and the Development page's
  Edit land on theirs. *Dispatch groups*, the door to nothing, goes.
- **A jump strip of the headings**, the Pipeline's `stagesStageBar` classes as Messages reuses
  them: pinned under the tab's title, the heading being scrolled through lit, a press scrolling
  to the heading. On a phone the segments read as one wrapping line. Drawn when the role sees
  two headings or more.
- **The folds count.** Each fold header carries `data-navtrack="settings-jobs" data-navbuttons`
  and the card's slug as `data-nav`, so a press writes `settings-jobs · #<card>` to the ledger
  and Settings → Usage can rank the cards next time, which it cannot today.
- **The tab keeps its name and its cards.** No card leaves in PR 1 (call 2); the name stays (call 3).

## The critique

- **Does a fold hide the value a person came to read?** For a form, yes, and that is the cost of
  the rule: *Rates charged by crew* folds to its name and *the rate card by who was out* until
  pressed. Call 4 names the fix, a live value line on the folded row, as PR 3; this card does not
  pretend the ledger said which cards to keep open, since it said nothing.
- **Why not fold the switches too?** A folded switch is a press to learn whether a thing is on.
  The five switches cost one row each open and say their state; folding them saves four lines and
  loses the one fact the card holds.
- **Twenty-one guides name the tab.** A guide that says *Scroll to the card named Stage
  checklists* now says *Press Stage checklists*. PR 1 rewrites the sentences that say *scroll*;
  a guide that says *open the card* or links an anchor is right as it stands.
- **Does the office's shorter tab need a strip?** The office sees two headings and five cards,
  so PR 1 draws the strip only at two headings or more, which the office just meets; the master's
  four headings earn it.
- **Why keep the sixteen cards' own ▶?** Rewriting them to one wrapper is sixteen files and their
  render smokes for no change a person sees. The wrapper draws the four new folds; the hook gives
  the sixteen their anchor and their open-on-target. The one shape the owner sees is the same
  header row either way.
- **Why no move in PR 1?** Three cards sit better elsewhere (call 2), but a move changes where a
  guide and a door point, and the owner has not said. Headings make the three read as what they
  are, *Repairs and old records*, until he does.

## The calls

Each row holds the recommendation the mock-up draws. PR 1 takes it where the owner has not
answered.

| # | The call | Options | Recommended | Answer |
|---|---|---|---|---|
| 1 | Which cards fold by default? | Every card. Every form, switches stay open. Only the cards that fold today. | A switch stays open, a form folds. Open: Hide the HCP field, Photos, Liens · owner of record, GC pay by card, the two GC notices, the trades' cut-off. The other 21 fold. The ledger cannot rank them yet. | **Every card** (2026-11-07). PR 2. |
| 2 | Does any card leave the tab? | None. Three go: HCP reconcile → Data & recovery, Sub portal · pay schedule → People & teams, The office's county → Company beside the office address. | None in PR 1. PR 2 moves the three if yes, each old anchor mapped to its new tab so every link still lands. | **All three go** (2026-11-07). PR 2. |
| 3 | Does the tab's name change? | Jobs & billing. Jobs, bills and liens. Money and papers. | Jobs & billing stays: twenty-one guides and every door name it, and the headings now carry the other words. | **Jobs, bills and liens** (2026-11-07). Its own sweep PR after PR 2: the name sits in twenty-nine guides and some seventy source files. |
| 4 | Does a folded card show its live value on its row? | Not yet. Yes, every card. Yes, the money cards only. | Later, PR 3: the row reads *$260 master with a helper · $170 a tech alone*, *Medium, 1600 px*, *Friday*. Each card then exposes its value line; PR 1 draws the static line of what the card sets. | **Yes, the money cards** (2026-11-07). PR 3. |
| 5 | Should a fold's press count in Usage? | No. Yes, the fold presses. Yes, every press on the tab. | Yes, the fold presses, in PR 1, so the next look at this tab reads the ledger instead of a rule. | **Yes, the fold presses** (2026-11-07). As built. |
| 6 | Does the page remember which cards were opened? | No, each visit starts folded. Yes, per device. | No. The tab is opened a few times a month; a remembered open state hides the headings' work, and a link opens its card anyway. | **No** (2026-11-07). As built. |
| 7 | Does the strip draw on the office's two-heading tab? | At two headings or more. At three or more. Always. | At two or more. The office's five cards are short, but the strip is the same shape everywhere and costs one row. | **At two or more** (2026-11-07). As built. |

## Where it plugs in

- `src/lib/settings/jobsBillingGroups.ts` (new): the six groups in order, each card's id, title,
  line, who sees it, `defaultOpen`; `jobsBillingGroupsFor(role)`, `jobsBillingAnchors`, the
  child anchor map (`who-counts-as-what` → the rate card). Test beside it, holding every card the
  tab mounts.
- `src/components/settings/SettingsFoldCard.tsx` (new): the wrapper; `useSettingsCardOpen(id)`
  (new hook): opens on the target hash, the `settings-target` event the deep-link effect and the
  search pick fire, and a `?focus=` field.
- `src/components/settings/SettingsJobsBillingStrip.tsx` (new): the strip over the Pipeline's
  bar classes; `--settings-jobs-jump-offset` for the headings' `scroll-margin-top`.
- `src/pages/Settings.tsx` → the `settings-jobs` group draws the groups kernel; `SettingsJobsTab`
  hands its dev cards back as a map by id.
- `src/lib/settingsDeepLink.ts` (the anchors), `src/lib/settingsSearch.ts` (anchors and the
  missing entries), `src/lib/settings/devDoors.ts`, `src/lib/contracts/customerContractCatalog.ts`,
  `src/lib/teamEmails.ts`, `src/pages/DevelopmentPage.tsx`, `src/lib/usageDashboard.ts`
  (`controlLabel`: *Jobs & billing card*).
- Guides: `settings-basics` gains *Jobs & billing*; the guides that say *scroll to* say *press*.
- `docs/SETTINGS_TABS_ARCHITECTURE.md` → 3. Jobs & billing rewritten to the new order;
  `docs/PROJECT_DOCUMENTATION.md`'s Settings line; `docs/GLOSSARY.md`.

## The plan

1. **PR 1, this card's defaults**: the kernel and its test, the wrapper and the hook, the
   anchors and every door, the strip, a render smoke that walks every anchor and finds its card
   open, `doors.test.ts` and the search tests green, the docs and the guides. Walked on the dev
   server as the dev and as a master at 1,280 and 375 wide in both themes.
2. **PR 2 (v2.6631)**: the three cards to their tabs, the old anchors mapped; every card folds (call 1).
3. **The rename sweep (call 3)**: *Jobs & billing* → *Jobs, bills and liens* across the tab, the guides, the doors and the docs, a script-driven PR cut from fresh main.
4. **PR 3 (call 4)**: the live value line on each Billing and money card's folded row.

## How to verify

- `npx vitest run src/lib/settings/jobsBillingGroups.test.ts src/lib/search/doors.test.ts src/lib/settingsSearch.test.ts src/lib/settingsDeepLink.test.ts src/pages/Settings.jobsBilling.render.test.tsx`.
- On the dev server as the dev, `/settings?tab=settings-jobs`: six headings in order, the strip
  pinned while the page scrolls with the heading in view lit, every form folded to its name and
  line, the seven switches open. Press a heading on the strip: the page lands on it. Open
  `/settings?tab=settings-jobs#settings-jobs-rates`: the rate card is open and on screen. Open
  `/settings?tab=settings-jobs#who-counts-as-what`: the same card open, scrolled to the list.
  Open `/settings?tab=settings-jobs&focus=issuer.signerName`: the company block open with the
  signer ringed. Pick *Markup on materials* in the Settings search: its card opens. View as a
  master: four headings, nine cards. Resize to 375: the strip is one wrapping line, the headings
  and folds stack. Switch the theme: the strip and the folds hold.
- Settings → Usage after a few presses: *Jobs & billing card* under clicks by control with
  `#rates`, `#stage-checklists` and the like.

## Where it stands

Proposed 2026-11-04. PR 1 (v2.6516) built the recommended defaults the same day: the six headings, the fold wrapper on every form, the anchors and doors, the strip, the counted fold presses. The owner looked at the live tab and answered the seven calls 2026-11-07 (the table above): every card folds, all three cards move, the tab becomes *Jobs, bills and liens*, the money cards get their live value, the rest as built. PR 2 (v2.6631) built calls 1 and 2 the same day: the switches fold, HCP reconcile sits under Data & recovery, Sub portal · pay schedule under People & teams, the office's county under Company beside the office address, every old anchor still landing (`src/lib/settings/settingsFoldCards.ts`). Left: the rename sweep and PR 3.
