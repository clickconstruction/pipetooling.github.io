---
name: "The leader's Dashboard, distilled"
number: 365
group: close
status: assessed and drawn 2026-11-16 · the owner picked direction B, the short Dashboard · PR 1 merged the same day (v2.7466) and its migration is pushed · nobody is on Short yet · the live screen as the leader was not walked
summary: >
  One leader has been given too much on his Dashboard. He will not look at any of it, uses the app only on
  his phone, and hands even small updates to his assistants. The assessment counted 44 cards, strips and
  squares on his page, none of them folded, and found that only seven are his alone. The owner picked a
  short Dashboard: one list of what waits on him alone with one press a row, his day, and one door to
  everything else, set per person so a leader who wants everything keeps it. PR 1 builds that page and its
  setting. The office's side of the same list, a text that reaches him, and his bottom bar are what is left.
next: Set the leader to Short on his People desk, then walk his page with him on his phone. Then PR 2, the office's Waiting on card.
size: M as a train of four (M · S · M · S); left: PRs 2 to 4 (S · M · S)
blocker: The owner's answers to seven short calls, listed below. PR 1 took a default for each.
ver: v2.7466
opinion: build — the first PR changes nobody's page until the office presses Short, so the risk is in what the short page hides, and that is the owner's call to make with the leader beside him
---

# The leader's Dashboard, distilled (#365)

The mock-up is [`mockup.html`](mockup.html), also at https://claude.ai/artifact/UYBwzvLrw7CwmnY56dAqmG.
Its names and figures are made up. The repo is public, so nothing below is a real name or a real figure.

## The ask

The owner, 2026-11-16, paraphrased closely: look holistically at the leader's Dashboard. Some leaders embrace
knowing everything. Others need to focus on what they are good at. This leader was given too much, and now he
will not look at any of it without getting overwhelmed. Turn his Dashboard into something more distilled, and
still give him the tools to jump in where he needs to. He has so little interest in technology that he would
rather task the smallest updates to his assistants. He uses the app only on his phone.

## What the assessment found

Read from the code on `main` and from the dev seat reading as itself. His live screens were not seen: the
session had no sign-in as him.

- **44 cards, strips and squares** on the Dashboard page for a leader with Job Mode off. About 26 hide on a
  quiet day. Around the page: a fixed bar of 5 tabs, 14 menu entries, 17 gear entries and 6 header icons.
- **Nothing is folded for him.** `isPhoneOfficeRole` (`src/lib/dashboard/phoneOffice.ts`) gives the phone
  folds to assistant, controller, primary and estimator. The leader is not on it.
- **Needs you** can show him lines from 49 of its 56 sources (`src/lib/needsYouSources.ts`).
- **Two homes.** With Dispatch Mode on, the bar's Dashboard tab opens `/dispatch-mode`, not `/dashboard`.
- **No per-person view existed.** Only quick-button ticks, their placement, pins, daily goals and the week
  signal, and the office could set none of the layout ones for him.

### The three piles

- **Only he can do it (7 of 44).** Needs you, for the five lines the database reserves for a leader: approve
  a lien notice, sign one, approve a GC's run, sign a lien waiver, review the assumed line budgets. My
  Schedule. His HR report. And four that show now and then: a trial helper's verdict, Rate your crew, his
  partner ledger, required training.
- **The office can do it, or already does (24).** The money cards, billing, who is clocked in and the hours
  to approve, Crew Day, both inboxes, reports, inspections, and every other Needs you line.
- **Nobody needs him to see it (13).** The floating section chips, the nine quick buttons, Clock in and My
  Time (his hours are written from the schedule), the map, My Bids, the lien month, Money in, the Projects
  strip and the Job Mode card.

### What his assistants see and can do

- They see *N waiting on* him on the Lien Board's tile, and a Waiting on group on the Lien desk with a
  Remind press. Since v2.7445 anyone in the office can remind him.
- They can act for him on lien papers four ways: record his spoken word, have him draw on their screen, type
  his signing code, or record his pen on paper.
- Nothing shows them the waivers, the line budgets or the tagged notes that wait on him.
- Nothing scheduled tells him what waits. Asking him for a waiver signature sends him nothing.

## The three directions

| | What he sees | Build | What it risks |
|---|---|---|---|
| **A. Fold what is there** | Today's page as about 12 one-line bars, his lines first | Small, no database change | Still a list of everything |
| **B. The short Dashboard** (picked) | What waits on him, his day, one door to everything else | Medium, one added column | Money over 30 days, crew problems and hours to approve leave his first screen |
| **C. Bring it to him** | A text that opens one signing screen | Medium to large: a daily send | Texts become the next thing he ignores |

The owner picked **B** on 2026-11-16. C reads best later on top of B, since the text needs a screen to land
on. A's folds came along free: a person on Short who opens Everything else on a phone gets them.

## Where it plugs in

Built in PR 1 (v2.7466):

- `src/lib/dashboard/shortDashboard.ts`: the view, who may have it, the six keys that are his alone, the
  three-way split over `needsYouActor`, the read state that stops a false *Nothing waiting on you*, every word.
- `src/components/dashboard/DashboardShortView.tsx`: the page. It reads `useNeedsYouInputs` once and presses
  through `useNeedsYouPress`, and draws v2.7435's `LienLeaderSignCardView` for the lien notices.
- `src/pages/Dashboard.tsx`: an early return after Job Mode's, and **Back to the short Dashboard** on the
  full page.
- `users.dashboard_view` and `set_dashboard_view` (`20261117030000_dashboard_view.sql`), `useDashboardView`,
  `DashboardViewPicker` in Settings, and the People desk's **Dashboard view** section.

## The plan

1. **The short page and its setting.** Built, v2.7466.
2. **The office's Waiting on card (S).** The same rows on an assistant's Dashboard: *Waiting on Marcus*, each
   with Remind, and one press for *he is here, sign with his code*. The lien rows are already in the desk's
   data. The waivers, the line budgets and the tagged notes need a read the office is allowed, so a small
   definer function that counts them for a named leader.
3. **A text when a paper is ready (M).** Direction C, on top of the short page: one text at an hour the owner
   picks, with a link that opens the signing screen. A daily send, a schedule and a per-person switch.
4. **His bottom bar (S).** The first half is built, v2.7572: on Short, the Dashboard tab opens the short page
   whichever mode is on, and one press on it leaves Everything else. Left: the bar holds the four tabs the
   owner picks (call 5). The phone dock's four slots and its More sheet, the assistant's today, are where
   they would go.

## The owner's calls

PR 1 took the default in brackets for each.

1. Are the five leader-only lines the whole of what stays his alone? [The five, plus a job note that tagged him.]
2. May he sign several notices with one press after reading the list, or one paper at a time? [One at a time.]
3. Who owns what leaves his screen: money over 30 days, hours to approve, bank label approvals? There is no
   controller account today. [It stays behind Everything else, and the door says how many are his.]
4. Does his day belong on the page, or only the list? [His day is on it.]
5. Which four tabs sit at the bottom of his phone? [The bar is untouched.]
6. Should a text reach him when a paper is ready, and at what hour? [No text yet.]
7. Is Short the default for every leader, or set person by person? [Person by person. Everyone is on Full
   until someone presses Short.]

## How to verify

- `npx vitest run src/lib/dashboard/shortDashboard.test.ts src/components/dashboard/DashboardShortView.render.test.tsx src/components/personDesk/sections/PersonDeskDashboardViewSection.render.test.tsx`.
- Live, after the migration is pushed: on People, open the leader's desk and press **Short** under
  **Dashboard view**. Imitate him at 375 px wide. The Dashboard opens on the short page. Each press opens
  what the Needs you card's press opens. **Everything else** opens the full page folded, and **Back to the
  short Dashboard** returns.
- Read only as him: press nothing that signs, approves or sends.
- A dev's own account can be set to Short too, which is the quick way to look without imitating anyone.

## Where it stands

PR 1 is on `main` (v2.7466) and its migration is pushed (2026-11-16). The page was looked at with sample
rows at phone width in both themes. The live page as the leader has not been walked, and he has not been
set to Short: every leader's and dev's row reads Full. That press is the owner's or the office's.
