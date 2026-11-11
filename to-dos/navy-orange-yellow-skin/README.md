---
name: "A navy, orange and yellow skin for the app"
number: 309
group: waiting
status: asked 2026-11-10, after the owner picked the navy plate for the box page (v2.6899) · read against main the same day (the tokens, the Layout's bar, the portal's theme, the brand files, screenshots at 375 and 1280 in both themes) · drawn as a before and after with two directions · the owner's answer the same day, on seeing the mock-up: he does not love it, and the app's look stays as it is for now · nothing built, nothing to build
mockup: to-dos/navy-orange-yellow-skin/before-after.html
summary: >
  The owner likes navy with the safety orange and yellow the company already uses, and asked
  whether more of the app should wear them. Today the chrome wears none of the three: a pale bar,
  white cards, blue links and presses. But orange and yellow are far from unused. Orange is the
  logo's hand, Plumbing's trade colour, the Dashboard's Clock In press and every warning. Yellow is
  the app's icon, Electrical's bulb, the bill link's Pay now press and every amber state. The
  mock-up draws two directions on five screens. A skins the chrome only: the bar and the tab bar on
  the portal's ink, an orange bar as the marker for where you are, the app's yellow tile as the
  Home press, every card as it is. B goes further: a navy plate on each page head and orange for
  the one main press. Held to six rules, A holds all six. B breaks two: an orange press sits beside
  a warning on three of five screens, and it ends the one press blue the office picked, which is
  written 1,798 times in 830 files. The pick is A, with B's plate kept for a page about one thing
  (a cage, a bill, a job), and no orange press. The owner looked at it on 2026-11-10 and said
  no: the app's look is not to be changed for now.
next: Nothing. Do not build any part of this, and do not restyle the bar, the tab bar, a page head or a press toward it. The card stays as the record of what was drawn and why. It opens again only on the owner's word.
size: S as a train of four for A (XS · S · S · XS), if the owner ever asks again; B whole would be L
blocker: The owner's no of 2026-11-10. He does not want the look changed for now.
opinion: wait — the owner saw both directions and does not love either. The app keeps its pale bar, white cards and blue presses. The mock-up and the facts it found are kept so the question is not drawn twice.
---

# A navy, orange and yellow skin for the app (#309)

## The ask, in the owner's words

2026-11-10, after choosing the navy plate for the signed-out box page over a paper version, from live screenshots:

> I think navy and the safety orange and yellow we use is a good combo. Perhaps we should skin more of the app?

## Where it stands

**Not for now.** The owner, 2026-11-10, with the mock-up in front of him:

> I don't love it, we'll leave things how they are.

So the app's look stays as it is: the pale bar, white cards, blue links and presses, the signed-out pages on the portal's paper, the box page's navy plate where it already is. No part of either direction is to be built, and no session should move a surface toward it on its own. His answer covered the whole page, so none of the nine calls below was answered one by one. Everything under this section is the record of what was drawn and why, kept so the question is not worked out twice. The recommendation, the plan and the picks below are the session's, not the owner's.

## The recommendation in one line

Skin the chrome, not the pages: a navy bar and tab bar, an orange marker, the yellow tile as Home. Keep the navy plate for pages about one thing. Leave every press blue.

## What the app has today (read 2026-11-10)

- **None of the three is a token.** `src/index.css` holds about 250 tokens, light and dark. The logo's orange `#e17235`, the icon's yellow `#e8c547` and the portal's ink `#16283c` are not among them.
- **The chrome has its own four tokens.** `--chrome-bg`, `--chrome-text`, `--chrome-border` and `--menu-bg`, used 44 times in 9 files, most of them in `src/components/Layout.tsx`. Light is `#fafafa` under near-black words. Dark is `#111827`, which is already a blue-black.
- **The bar's words are link blue.** The nav words (Estimates, Jobs, Schedule…) take `--text-link`. On navy that blue reads 2.9:1, so a navy bar means white words.
- **The marker is a hairline.** The page you are on is an underline in the bar's own colour (`navStyle`, `iconLinkStyle` in the Layout) and a darker word on the tab bar.
- **The bar already carries states.** Training mode puts an amber band above it. Imitating someone turns the whole bar amber on a phone with an amber line under it. A digital twin gets a violet band. Any skin must lose to these.
- **Orange already has four jobs.** The hand in the logo (`public/brand/click-mark.png`, `click-plum.png`). Plumbing's trade colour, which `src/lib/tradeColors.ts` moved from `#e17235` to a burnt `#af4f1a` because white on the logo's orange read 3.15:1. The Dashboard's Clock In press, `#c75000` under white words, 4.6:1. Needs you's warning rows, their press, the Billed dot, an open balance.
- **Yellow already has four jobs.** The app's icon and the Tooling family tiles (`public/favicon.svg`). Electrical's bulb (`click-elec.png`) and its ochre pill. The bill link's Pay now press, `#fde047` under the portal's ink (`src/pages/PayLink.tsx`). Every amber band, badge and row.
- **About 334 orange, amber and yellow literals sit in 219 files under `src/`,** beside the amber tokens.
- **The press blue is a recorded pick.** The office chose `#2563eb` on 2026-10-31 from four shades (v2.6218). It is written 1,798 times in 830 files. `check:press-blue` refuses only the old pale blue under white words, so an orange press would not fail it. The rule behind it would stop being true. `check:text-fill-words` is written around white words on a coloured fill.
- **The signed-out pages are already the combo.** The portal's paper, ink words, copper `#9a5b2b` as the word accent (v2.6067), the orange hand as the mark, and on the bill link a yellow press under navy words. The box page added the navy plate (v2.6899).
- **The sign-in page is a photo under glass** with an orange wrench, a yellow bolt and yellow family tiles. The panel behind the name is black glass.
- **The logo does not sit on navy as it is.** Its wrench and wordmark are black. On navy it needs a white chip, or new art with a white wrench.

## The six rules both directions are held to

1. Orange and yellow are never words on white (3.15:1 and 1.7:1).
2. White words never sit on orange or yellow (3.15:1 and 1.7:1).
3. A brand colour in a warning's hue never sits where a state is read.
4. The blue press is held by CI today.
5. Dark mode works.
6. Signed-out pages and prints stay light.

Contrast, computed: white on navy 15.0, yellow on navy 8.9, orange on navy 4.75, navy on orange 4.75, navy on yellow 8.9, link blue on navy 2.9, navy on the dark page 1.19, orange on the portal's paper 2.85.

## The two directions

The mock-up draws both on the Dashboard at 375, the Tally's On site tab at 375, Customers at desktop width, the sign-in page and the bill link, with a Light and Dark switch.

**A · chrome only (the pick).** The bar and the tab bar go to the portal's ink. The bar's words go white. An orange bar, 3px, marks the page you are on in the bar and on the tab bar. The app's yellow tile is the Home press. The three mode tiles take a light edge, because each is under 3:1 against navy. Nothing below the bar changes. In Dark the bar goes a shade deeper than the page, `#0d1826`, with a hairline. Holds all six rules.

**B · plates and an orange press.** All of A. Then a navy plate on each page head, as the box page has, and the logo's orange for the one main press on each screen, under navy words. Bends rule 2 (navy words pass by a quarter point, and every other filled press has white words). Breaks rule 3 on three of five screens: beside Needs you's warning press on the Dashboard, beside Due a count on the Tally, above the open balance and the Billed dots on Customers. Breaks rule 4 by design. Bends rule 5: a navy plate on the dark page is 1.19:1, so it needs an edge and reads as one more card, and a navy filter chip must flip pale.

**Both** put the navy plate on the signed-out pages as a letterhead, with the hand on a white chip. The paper, the copper words and the yellow Pay now stay. Prints are untouched.

## What each costs

| | A | B |
|---|---|---|
| Touched | Four chrome tokens, one new marker token, the bar's word colour, the tab bar, the Home press, the mode tiles' edge | All of A, then a page head on each of 81 routes with no shared page head to change, then the one main press picked by hand on every screen |
| Checks | None change | `check:press-blue` and `check:text-fill-words` rewritten, a new check for navy words on orange |
| Size | Three or four small PRs | Dozens of PRs over many weeks, on the busiest files |
| If wrong | Four token values go back | A second sweep |

## Is this the best we can do?

- **A wins.** The brand goes in the frame, where nothing is read as a state. The page keeps the colour language the crew knows: blue is a press, amber is late, red is wrong, green is done.
- **Keep the plate from B for a page about one thing.** A cage, a bill, an estimate, a job and a customer have a name worth a plate. A list, a board and the Dashboard do not: there the plate is a tall title that pushes the work down.
- **The orange press loses.** Orange already asks for attention as a warning. White words fail on it. It is 830 files by hand. The app already has one orange press, Clock In, and that is the right amount.
- **Yellow is the weakest of the three as paint.** It cannot be a word, cannot hold white words, and is amber's neighbour wherever a state is read. It is safe inside the app's tile and on Pay now, and it is already in both.
- **Thought about and not drawn:** the portal's paper inside the app. The pages are dense tables tuned on grey under white cards, and every token would need a new pair on cream.
- **What a drawing cannot settle:** a navy bar in full sun on a phone, which mark feels like Home, and whether Dark needs any change. A is cheap to try live and cheap to take back.

## The plan, had the owner said yes

Each step is its own PR with a release note, a fragment and a walk in both themes.

1. **Signed-out pages take the plate, one page a PR.** The bill link (`src/pages/PayLink.tsx`), the estimate link (`src/pages/EstimateAccept.tsx`), then the sign-in page's name panel (`src/components/authPublicLanding.css`). The plate's colours move out of `BoxPublicPage.tsx` into `src/lib/portal/portalTheme.ts` on the first of these, so every page shares one plate.
2. **The bar and the tab bar go navy.** The four chrome tokens in `src/index.css`, light and dark, and the bar's words off `--text-link`. Walk the menus, the search overlay and the health strip.
3. **The marker and the mark.** One new token for the orange marker, used by `navStyle` and `iconLinkStyle` in the Layout and by the tab bar. The Home press. The light edge on the mode tiles.
4. **What the walk finds.** Training mode, the imitate bar and the twin band on a phone, each checked against the navy bar.
5. **Later, its own train:** the plate on pages about one thing, the cage's screen on the Tally first, after a week of living with steps 1 to 4.
6. **Not planned:** an orange press.

## The owner's calls, left unanswered

1. A, B, or A with the plate kept for pages about one thing? *Pick: A, with the plate later.*
2. Which mark is the Home press: the yellow ClickTooling tile, or the logo's hand on a white chip? *Pick: the tile inside the app, the hand on what a customer sees.*
3. Which navy: the portal's ink `#16283c`, or a new one? *Pick: the ink.*
4. Is the marker the logo's own orange `#e17235`? *Pick: yes, as a bar and never as a word.*
5. Does the main press turn orange? *Pick: no.*
6. Dark mode: leave the bar, or a shade deeper with the marker and the tile? *Pick: a shade deeper with both.*
7. Pay now stays yellow under navy words? *Pick: yes.*
8. Does copper stay as the signed-out pages' word accent? *Pick: yes. Orange on paper is 2.85:1.*
9. Prints stay as they are? *Pick: yes.*

## How to verify, when it is built

- `npm run dev`, then `/dev-login?as=1&to=/dashboard`. Walk the Dashboard, Jobs, Customers and `/tally?tab=on-site` at 375 and at 1280, in Light and in Dark (the gear menu's theme override).
- Turn on training mode on a ZZ Test account and imitate one from People → Users on localhost. The amber band and the amber bar must still replace the skin.
- `/pay/sample` is the bill link's own made-up bill. The signed-out pages must stay light with the app in Dark.
- `node scripts/theme-tokenize.mjs --check src`, `npm run check:press-blue`, `npm run check:dead-press`, `npm run check:text-fill-words`: all four must pass unchanged under A.
