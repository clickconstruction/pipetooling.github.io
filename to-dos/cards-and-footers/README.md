---
name: "Cards and footers: a business card and an email footer made from a person's facts and photo"
number: 313
group: close
status: asked 2026-11-11, the assistant for a new photo on her email and the owner for a tool that makes cards and footers · the designer's media read the same day (four footers, two card fronts and backs, the letterhead, the banners) · what the app holds on a person read on main and counted in prod through the dev seat, reads only · the footer and the card back rebuilt as templates in code and laid over the designer's files · three ways of the tool drawn, each at a desk and a phone width · the assistant's footer made by the template with her new headshot and saved beside the designer's files on the owner's Mac · a make command added the same day on the owner's ask, which draws footers and print files from a list, run on the six made-up people with photos and on the assistant · the templates reworked the same day on the owner's go-ahead into a brand, layouts as data and parts, with the logo's words as type and the card front in layers, laid over the designer's files again · the design rework drawn the same day as five before and after pairs, each with a pick · the owner took all five the same day, so that look is what the pages and the make command now draw · the owner said to build it all the same day · built the same day as way A on the picks: the facts and the photo's home (v2.6941, pushed to prod), the designs as kernels (v2.6942), and the screens, Your card and footer on Your account with the People doors (v2.6943) · the owner then asked for other looks, navy and safety yellow among them, and a plan to offer approved alternatives: three candidates drawn beside the look in use, with how the owner approves a look and how a person picks one, none approved or built · the owner took two of the three the same day, navy and orange and navy and yellow with the orange hand kept, passed on the yellow hand, and said to build the plan: built as v2.6951, the looks in the kernels, the owner's card and the Look row, with its migration · nothing changed in anyone's mail
mockup: to-dos/cards-and-footers/a-in-place.html
summary: >
  Every footer and card today is a flat picture a designer made for one person, so a new photo
  means a new file by hand. The owner asked for a tool in the app that makes them. The app already
  holds most of the words: a name, an email, a phone and a title per person, and one office line
  for the company. It holds no photo anywhere, the title is empty on every login, and most names
  are a first name only. The two designs are rebuilt here as code: the footer and the card back
  are drawn from a person's facts, checked by laying each over the designer's file, and the
  typeface is Lexend, an open font. The code is three layers, a brand, layouts as data and the
  parts that draw, so a new line or a new colour is one edit. Two pictures remain until the
  designer sends them clean: the wrench-and-hand mark and the pipe photo on the card front. Three ways of the tool are drawn. A puts one card on Settings → Your
  account and one line in a person's row menu on People → Users. B gives People a tab of its own
  with the team down the left. C is a three-step walk on a phone where the office asks and each
  person adds their own photo. The pick is A, with the team window from B's list and C's photo
  sheet. The first proof is real: the assistant's footer was made by the template and matches
  the designer's file to hairline edges. The owner then took five changes to the designs
  themselves: one orange, even lines on the card, a title, a phone on the footer, and the photo
  front kept.
next: The owner tries it: his own card on Settings → Your account, then a teammate's from People → Users. A real photo save was not walked by the session, since it writes to prod. Then the designer's two files, the owner's word on calls 1 to 10, and the three checks on a device in v2.6943's fragment.
size: M as a train of six (S · S · S · S · S · S), built as three PRs; left: the designer's vector and photo dropped in (XS), then on a call each the footer with live words (S), Gmail set by the app (M), the letterhead (S)
blocker: The owner's try of it. For print at size, the wrench and hand as a vector and the pipe photo by itself, both from the designer.
opinion: built as recommended, way A with the footer and the card together. Next the designer's two files, since the mark is a cut-out and the card front still carries the designer's own logo under the drawn one.
---

# Cards and footers (#313)

## The ask

The assistant, to the owner, 2026-11-11:

> Also can we update my photo on my email?

The owner, on top of it, the same day:

> Help me come up with a tool in the app to make business cards and email footers. This is the media we currently have

The media is a designer's hand-off: flat pictures, one made per person. No vector logo and no font files came with it. A new photo, a new hire or a new phone number each mean a new file by hand.

## Where it stands

**Built, 2026-11-11.** Way A, on the picks, in three PRs: v2.6941 (the migration, pushed to prod the same day), v2.6942 (the kernels) and v2.6943 (the screens). Five mock-up pages sit beside this card as the record of what was drawn. Nothing was sent to anyone and nothing was changed in anyone's mail.

**What is in the app.** Settings → Your account → *Your card and footer*: the photo sheet, the name on the card and the title, the footer as a picture, the card as a print file and as a sheet of ten. People → Users: *Card and footer…* in a person's row menu, and *Cards and footers* for the team. The help guide is `make-my-email-footer-and-business-card`.

**What was not walked.** A real photo save, since it writes to prod: the session walked the screens on the dev server with every write refused, and the migration on a local database. The owner's first photo is the first real one.

**What is left.** The designer's two files. The owner's word on calls 1 to 10, which went with their picks. The footer with live words, Gmail set by the app and the letterhead, each on its call. Footers 02, 03 and 05 and card 2 as layouts, if wanted.

The record of the day, as it went:

The owner, 2026-11-11, after taking the rework's five picks:

> Please build it all and let me know when it is live so I can play with it

He did not answer calls 1 to 10 one by one. The build goes with each call's pick, way A included, and any of them can still be turned.

- [`templates.html`](templates.html): the two designs rebuilt as code, with made-up people. Type in a field or drag the ring and every picture redraws.
- [`rework.html`](rework.html): five changes to the designs themselves, each before and after. The owner took all five.
- [`looks.html`](looks.html): three other looks beside the one in use, how well each reads, and how an approved look is offered. None is approved.
- [`a-in-place.html`](a-in-place.html): way A, the pick. One card on Your account, one line in a row menu.
- [`b-desk.html`](b-desk.html): way B. A tab of its own on People.
- [`c-walk.html`](c-walk.html): way C. A three-step walk, phone first.
- [`make.mjs`](make.mjs): the same templates run from a command. See [Make them on command](#make-them-on-command).

**The first proof is made.** The assistant's footer was drawn by the template from her account's facts and her new headshot, at 2709 × 625, the size of the files in use. It is saved on the owner's Mac in the same folder as the designer's four footers, as two new files. Nothing was overwritten. One carries her full name as her mail's sender name reads. The other carries the name exactly as her account holds it, which is her first name alone. Her photo is not in this repo and never goes under `to-dos/`. Nothing was changed in her mail. She puts the file in herself: see [Where the footer goes](#where-the-footer-goes).

## The recommendation in one line

Build A: the photo and the facts on Your account, the same card for a teammate from People → Users, the footer as a picture first, the card's print file second.

## The media, as given

| What | Size | What it holds |
|---|---|---|
| Four email footers, designs 01, 02, 03 and 05 | 2709 × 625 | The logo at left, a round photo in an orange ring, the name in bold, the email under it. 01 is black with three orange pipe runs. 02 has an orange band. 03 and 05 sit on a dark pipe photo. All four show the same sample person. |
| Two card fronts | 1125 × 675 | The logo. Front 1 splits a dark pipe photo and flat orange on a diagonal. Front 2 is the photo with pipe runs. No personal fact on either. |
| Two card backs | 1125 × 675 | Back 1 has an orange side panel, the photo straddling the seam, the name in orange, then email, mobile and office lines with small orange icons. Back 2 is black with outlined pipes. |
| Two mock-up photos of the printed card | 3000 × 2000 | The fronts and backs laid on a table. For show only. |
| The letterhead, three Word files | letter | Two are the same file under two names. Each holds a header picture and a footer picture with an office phone and the website. The words in Word are Calibri and the art is flat. |
| Two Facebook banners, one LinkedIn banner | 3546 × 1313, 6600 × 1656 | The logo, a slogan, a photo. No personal fact. |

1125 × 675 is a 3.5 × 2 inch card with an eighth-inch bleed on every side, at 300 dots to the inch.

## What the app knows about a person today (read on main, 2026-11-11)

**What is there.**

- **A name, an email and a phone.** `users.name`, `users.email`, `users.phone`. A person edits all three under My Profile on Settings → Your account (`src/components/settings/SettingsAccountTab.tsx`). The signature calls the phone the cell.
- **A title.** `users.title`, 80 characters at most (`20261012190000_quick_replies.sql`). A person sets it on the card *Your signature on an email* on the same page (`src/components/settings/SignatureCard.tsx`). Only the office roles see that card.
- **Two free signature lines.** `users.signature_lines` (`20261028230000_users_signature_lines.sql`).
- **One office line for the company.** `PORTAL_COMPANY.phone` in `supabase/functions/_shared/portalCompany.ts`. There is no address and no website field there.
- **The logo, on light only.** `public/brand/click-plum.png` is the black wordmark with the orange hand, 491 px wide. There is no white-on-dark logo in the repo and no vector of the wrench.
- **The office's door to a teammate.** People → Users, a row's menu, *Edit name, title & phone* (`src/components/people/PeopleUsersTab.tsx`, the window in `src/pages/People.tsx`).

**What is missing.**

- **A photo.** No column, no bucket and no picture of a person anywhere. An avatar in the app is initials. There is no crop tool and no crop library. A headshot's home would be new.
- **A full name.** The name field holds what the person is called in the app. Most hold a first name only. A card needs the name a customer should read.
- **A way for the office to set a teammate's title.** The window *Edit name, title & phone* saves its "Full name and title" box into `users.notes`, a free note. It does not write `users.title`. Nothing lets the office set a teammate's title or signature lines.
- **A mobile and an office number per person.** There is one phone per person and one line for the company. That is enough for the card as designed.
- **The font and the pipes in code.** Both are in this folder now. Neither is in `src/`.

**How the app foots its own mail.** It does not use this art. `messages-email` builds a plain mail: a greeting, the body, then the sender's signature lines as text (`supabase/functions/_shared/messagesEmail.ts`, lines from `signatureLines` in `src/lib/messages/compose.ts`). The function's own header says it carries no letterhead bar, no card and no footer. The mail goes out as the bids box or the team box under the service account, never as the person's own Gmail. Most of it is headed Click Construction, not Click Plumbing.

**What the service account may do in Gmail.** Three scopes: read mail, modify mail and Drive (`docs/DRIVE_INTAKE_SETUP.md`). Setting a signature needs a fourth, `gmail.settings.basic`, which a Workspace admin would have to add.

## The counts (prod, 2026-11-11, through the dev seat, reads only)

Of the 14 logins on the company's mail domain:

| Fact | Have it | Lack it |
|---|---|---|
| A title | 0 | 14 |
| A phone | 10 | 4 |
| A first and a last name in the name field | 2 | 12 |
| Signature lines | 0 | 14 |
| A photo | 0 | 14, since there is nowhere to keep one |

So the tool cannot just read what is there. On day one it has to ask each person for three things: a photo, the name on the card and a title.

## The two designs, rebuilt

[`kit.js`](kit.js) holds them in three layers, so a later change is a small edit in one place.

- **The brand.** The colours, the typeface, the two words of the wordmark and the mark.
- **The layouts.** Each piece as data: its size, where the pipes run, where the logo, the ring and the words sit, and which lines it shows. There are three: `footer01`, `cardBack1` and `cardFront1`.
- **The parts.** One function per thing drawn: a pipe run with its bends and couplings, the logo, the photo in its ring, an icon, a stack of words.

`draw(layout, person)` puts them together and returns one picture as SVG. Shapes are vectors and words are live type. `footer()`, `cardBack()` and `cardFront()` draw the look the owner chose. The three layouts listed here are the designer's own, kept as they were.

- **The footer** is design 01 at 2709 × 625: the black ground, three pipe runs, the logo, the ring with the photo, the name and the email.
- **The card back** is back 1 at 1125 × 675: the orange panel, the ring on the seam, the name, then the lines with their icons. A title sits under the name when there is one. A missing line closes up.
- **The card front** is front 1 in layers: the dark pipe photo, the flat orange cut across it on a diagonal, the logo over both.
- **`printPage`** puts one side on a 4.25 × 2.75 inch page with crop marks. **`sheetOfTen`** lays ten on a letter page, two across and five down.
- **`htmlFooter(person)`** is the footer as a small table with live words.

**A change is one edit.** A new line on the card, a license number say, is one entry in the card's rows. A new orange is one value. A second company is a second pair of words in the brand. Section 5 of `templates.html` does all three live.

**How faithful.** Each template was drawn with the designer's sample words and laid over the designer's file. The pipes were fitted by a search that drew thousands of candidate bends and kept the one with the fewest differing pixels. What is left differs along hairline edges only. The name and both lines land on the same pixels to within one. After the rework all three were laid over their files again. The footer's pipes, name and email and the whole card back came out pixel for pixel as before it. The logo, now a cut-out mark and two lines of type, and the card front, now three layers, differ from the designer's along hairline edges.

**The typeface is Lexend.** It is an open font under the SIL Open Font License, free to bundle. The name is its bold. The lines are its light. The word CLICK in the logo is Lexend bold with wide spacing, and Plumbing is its light at two thirds the size. Each word was fitted over the logo by size, spacing and weight. Bold left a quarter of the error that extra bold did. The letterhead's small phone line looks the same but was not checked by overlay.

**What is still a picture.** Two things, and both wait on the designer.

- **The wrench and hand.** Cut from the designer's largest file with a clear ground, 400 px wide ([`mark.png`](mark.png)). It is sharp on a card and a footer. It is too small for a banner or a truck, and its hand stays orange when the brand's orange changes.
- **The pipe photo behind the card front.** It is the designer's whole front made smaller ([`card-front.jpg`](card-front.jpg)), so the designer's own logo is still in it, under the logo drawn here. Move the logo and the old one would show.

[`logo-on-dark.png`](logo-on-dark.png) is the whole logo as a picture. It stays for the footer with live words, since a mail app cannot set type in Lexend. The three small icons on the card back are redrawn by hand in the designer's manner. They are close, not the same.

**Where the photo sits.** A photo is kept whole. The crop is three numbers: the point of the picture that sits in the middle of the ring, across and down, and a zoom. Zoom 1 just covers the ring. The same three numbers place it in the footer and on the card.

## What to ask the designer for

1. **The wrench and hand as a vector.** The two words are type now and need nothing. Today the mark is a picture cut from the largest file on hand.
2. **The brand orange as one value.** The files hold three: `#e17232` on the footers, `#e37334` on the cards and `#e17235` in the app's logo.
3. **The font names, to confirm.** By overlay it is Lexend throughout.
4. **The dark pipe photo by itself,** at print size, and word that the company may use it. The orange and the logo over it are drawn now.
5. **The three card icons** as vectors.
6. **Which design is the one.** There are four footers and two cards.
7. **The office number on the art.** The card sample and the letterhead print one number. The app's letterhead holds another. See call 10.

## The three ways

| | A · in place | B · a desk of its own | C · a three-step walk |
|---|---|---|---|
| Where mine lives | A card on Settings → Your account | One line on Your account that opens the desk | One press on Your account that opens the walk |
| Where the office makes one | A row's menu on People → Users | A new tab on People, the team down the left | The office asks. The person does it. |
| The photo | A sheet with the ring | The ring in the right pane | Step one, alone on the screen |
| The whole team | A window from the page's More tools menu | The page itself | A strip that counts who is done |
| New surfaces | One card, one sheet, one window | A tab, a list, three panes, a phone layout | A walk, a strip, a notice |
| Size | S and S and S | M and M | M and S |

Each page ends with what that way costs and what it buys.

## Is this the best we can do?

Held against five things the tool must do:

1. **A new photo is one move.** A and B: change the photo, press download. C: three screens to reach the press.
2. **The office can fix a teammate without that person.** A and B: yes. C: no, by design, and a new hire's card waits on a notice.
3. **Nobody hunts for it.** A: it is where the name and the title already are. B: a new tab on a page that has many. C: one press, easy to find.
4. **The team at once.** B is best. A does it in a window. C counts but does not show.
5. **It is small.** A is the smallest. B is the largest.

A holds four of five and is second on the fourth. B wins the fourth and loses the fifth. C wins the first time through and loses every time after. So A, with two things taken from the others: the team window lists everyone with a chip as B's list does, and the photo opens as its own sheet as C's first step does.

This is the first pass. The owner's way with a new surface is a second pass on his pick before anything is built.

## What each press gives

**The footer.**

- **Download the picture.** A PNG. This is the designer's look, pipes and all. It is the form the team uses today.
- **Copy the picture.** The same picture on the clipboard, for a mail app that takes a paste.
- **Copy it with live words.** The footer as a small table. A reader can copy the number and tap the email. Mail apps drop the font and the pipes, so it is plainer. The logo and the round photo must sit at a public address for it to show.

**The card.**

- **Download the print file.** A PDF of two pages, the front and the back. Each is 4.25 × 2.75 inches: the card, its eighth-inch bleed and crop marks. A print shop takes it as it is.
- **Print a sheet of ten.** A letter page, two across and five down, for scored card stock. The bleed is cropped off. An office printer drifts a millimetre or two between sides, and a black card shows it. Good for a few cards in a hurry, not for a box.

**One person or the team.** *Make 6 cards · 1 has no photo ▸* makes one print file with every ready person's front and back. It names who was held, why, and the door that fixes it. A person with no photo is held. A person with no mobile or no title is not: the line is left off. *Download 6 footers* gives one picture each, named for its person.

### Where the footer goes

| Mail app | The picture | The live words |
|---|---|---|
| Gmail on a computer | Settings, See all settings, Signature. The Insert image button, then Upload. Save Changes at the bottom. | Paste into the signature box. Gmail keeps the links. The pictures must be at public addresses. |
| Gmail on a phone | Uses the signature set on a computer, unless a phone signature is set. | The same. A phone signature of its own is plain text only. |
| Apple Mail | Paste or drag into Settings, Signatures. | Paste. |
| Outlook | Paste into the signature editor. | Paste. Some versions hide pictures until the reader allows them. |

The team is on Gmail, so the first row is the one that matters. Gmail's own help states the phone rule.

**For the assistant, now.** Gmail on a computer, the gear, See all settings, the General tab, Signature. Click her signature, delete the old picture, press Insert image, choose Upload and pick the new file from the folder that holds the designer's footers. Pick the same size she used before. Save Changes is at the bottom of the page.

## Make them on command

The owner, after seeing the first footer, 2026-11-11:

> using this spike, can you make some test footers and business cards? I would like to be able to programmatically generate them on command going forward

[`make.mjs`](make.mjs) does it today, before any screen exists. It draws the templates in `kit.js` in a headless browser, so a file it makes is the same drawing the mock-up pages show.

```bash
node to-dos/cards-and-footers/make.mjs --people <team.json> --out <folder>
```

```bash
node to-dos/cards-and-footers/make.mjs --sample --out <folder>
```

One person can be given on the line with `--name`, `--email`, `--title`, `--mobile`, `--office`, `--photo`, `--focus` and `--zoom`. `--look` picks the design. Left out, it draws the look the owner chose. `designer` draws the designer's files as rebuilt, and `reworked-no-photo` is the chosen look with the drawn card front. `--help` prints every form.

**The list** is a file of people: a name, an email, a title, a mobile, an office line, the path to a photo, and where the photo sits in the ring. The list and the photos of real people are kept outside the repo.

**What lands in the folder, per person.**

| File | What it is |
|---|---|
| `footer-<name>.png` | The footer at 2709 × 625, the size of the designer's files. |
| `footer-<name>-1200.png` | The same footer, 1200 wide, lighter for mail. |
| `card-<name>.pdf` | The print file. Front then back, each 4.25 × 2.75 inches with bleed and crop marks. The words are type, not a picture of type. |
| `card-<name>-sheet.pdf` | Ten to a letter page, fronts then backs. |
| `card-<name>-back.png` | The back alone at 1125 × 675. |

Once per run it also writes `card-front.png`, and `cards-all.pdf` when more than one person was made: every front and back in one print file.

**It makes what is ready.** A person with no name, no email or no photo is held and named at the end with the reason. The rest are still made. `--allow-no-photo` makes those with the plain ring.

**What it needs.** The repo's own Playwright, which `npm ci` installs. The network, since Lexend loads from Google Fonts. It stops with the reason when the font did not load. It never sets the words in another typeface in silence. For the card front it uses the designer's full-size file when that is on the machine, and says so when it had to use the small copy in this folder.

**Tested 2026-11-11.** The seven made-up people: six made, one held for no photo. The assistant, from a list file on the owner's Mac: her footer, her card's print file and a sheet of ten. The print file measured 4.25 × 2.75 inches a page with Lexend embedded and the front at 300 dots to the inch.

When the tool is built, PR 2's kernels replace `kit.js` and the app's presses replace this command. Until then this is the way to make one.

## The rework, drawn

The owner asked how the cards should be rebuilt and reworked, and said to draw it, 2026-11-11. [`rework.html`](rework.html) shows five changes to the designs themselves. Each has the designer's design on the left and one change on the right. Each is one small patch on a copy of the designer's layout in `kit.js`.

The owner's answer, 2026-11-11, with the page in front of him:

> Yes, all five

So the five stand as drawn, the fifth as picked: the photo front is kept and the drawn front is the fallback. This is now the look the mock-up pages and the make command draw. The designer's own layouts stay in `kit.js` and still render as they did.

| | The change | Why | Taken |
|---|---|---|---|
| 1 | One orange, `#e17232`, on every piece | The files hold three, a hair apart. A print shop is given one number. | Yes |
| 2 | Even steps and one left edge for the card's contact lines | The designer's lines step by 54 then 63, and the email sits five units right of the phones. Nobody chose that. | Yes |
| 3 | A title under the name, on the card and on the footer | Neither design has one. A person with no title gets the design as it was. | Yes, on both |
| 4 | A phone under the email on the footer | Footer 01 shows a name and an email only. The mobile, or the office line when there is no mobile. | Yes, the mobile |
| 5 | A card front with no photo: black and two pipe runs where the photo was | The pipe photo is the one piece that cannot be drawn, and there is no clean copy of it. | Keep the photo. The drawn front is the fallback. |

The words on the footer stay centred between the pipes however many rows a person has. A person with no title and no phone still gets the designer's footer, to the pixel. Four rows is the most that space holds.

## Other looks, and offering approved ones

The owner, 2026-11-11, with his own card on the live site in front of him:

> Do you like these visuals, I think we can make some alternative, such as in a navy and saftey yellow

> help me come up with a plan to offer approved alternatives

[`looks.html`](looks.html) draws it.

The owner's answer the same day, with two of the candidates in a screenshot:

> I like these as two other alternatives, the 3rd yellow hand we can pass on for now
>
> Build the approved-looks plan, with these

**Built as v2.6951.** Three looks: Classic, Navy and orange, and Navy and yellow with the orange hand kept. The four PRs of the train below went as one, for the same reason the screens did. The owner's card is on Settings → People & teams, not Company. The page still shows the yellow hand as the candidate it was.

**What a look is.** The same layouts in other colours: the ground, the accent (the pipes, the ring, the panels, the name on the card), the ink of the logo's two words where they sit on the accent, and which mark. Nothing moves, so every look fits the same names and lines. In `kit.js` a look is one entry in `THEMES`.

**The four on the page.**

| Look | What changes | What it costs |
|---|---|---|
| Classic | Nothing. Black and orange, the look in use. | The black block is heavy in a white mail. |
| Navy and orange | Navy where the black was. | Nothing. The logo is untouched. It matches the app's signed-out pages, which are navy with the orange hand. |
| Navy and safety yellow | Yellow pipes, ring and panels, and a yellow hand in the logo. | It changes the logo. The page recolours the logo's picture; the real one is the designer's to draw. |
| Navy and yellow, the orange hand kept | Yellow pipes, ring and panels. The logo as it is. | Three colours on one card. |

**How well each reads.** The page works the numbers. Yellow on navy is the strongest pair, 9.3 to 1. White words on the orange panel are the weakest, 3.2 to 1, in the look in use as well; they are the logo's two large words, so they pass.

**Who does what.**

- **A developer draws a look.** It is code: one entry of colours. It ships switched off.
- **The owner approves.** Settings → Company gets a card, *Card and footer looks*: each look with a switch, which one is the default, and how many people use it. A look nobody has approved shows there as *Drawn, not approved* and nowhere else.
- **A person picks.** *Your card and footer* gets a row, *Look*, that shows only the approved looks, each drawn with their own facts. With one approved look there is no row.
- **The office picks for a teammate** on that teammate's card. The team's batch prints each person in their own look.
- **A look that is switched off** moves the people on it to the default. Their next footer and card are drawn in the default.

**Where it is kept.** The looks in code. The approved list and the default in one company setting. A person's pick on their own row. No look is ever stored as a picture.

**The rules a look must pass.** The same bones. Every pair of colours reads, held by a test. Three looks on at once at most. The footer and the card go together. The owner approves, a person picks.

**The train**, four small PRs, after the calls below:

1. **Looks as themes in the kernels (S).** `THEMES` beside `LAYOUTS`, with a test that every look keeps the bones and every pair of its colours reads. Only the look in use is on. No screen.
2. **The setting and the pick (S).** A migration: the company setting for the approved list and the default, and a person's pick on their row.
3. **The owner's card (S).** *Card and footer looks* on Settings → Company.
4. **The Look row (S).** On *Your card and footer*, on a teammate's card, and the team's batch in each person's look.

## The calls, each with a pick

1. **Which design is the company's one?** Four footers, two cards. **Pick: footer 01 and card 1,** the two rebuilt here, for everyone. A second design is a later option, not a choice each person makes.
2. **The footer as a picture or as live words, by default?** **Pick: the picture.** It is the look that was paid for, it is what the team pastes today, and it needs no public address for anyone's photo. Live words are a second press for whoever wants a number a reader can tap.
3. **Should the app set the signature in Gmail itself?** It could, under the service account, once an admin adds the `gmail.settings.basic` scope. It would also need the footer picture at a public address, since a signature set that way points at one. **Pick: not at first.** Hand the person the file. If pasting for fourteen people proves a chore, add the scope and a press that says *Set 14 footers in Gmail*.
4. **Should the app's own mail carry the footer?** That mail goes out as the bids box or the team box, signed in plain words, mostly under the Click Construction name. **Pick: no.** The art says Click Plumbing and a person's face. A shared box is neither.
5. **Who may make a card for whom?** **Pick: anyone with a login makes their own. The office makes one for anyone.** The office here is the roles that open *Edit name, title & phone* today.
6. **Where are photos kept and who can see them?** **Pick: a new private bucket, one photo per person.** The person and the office can see it. Nobody else can. A footer is public once it is sent, and that is the person's own act.
7. **What does the card call a person?** The name field is a first name for most. **Pick: a new field, the name on the card,** that starts as the name field and is asked for once.
8. **May the office set a teammate's title here?** Nothing lets it today. **Pick: yes.** The teammate's card writes the real title field, and the "Full name and title" note stays what it is.
9. **Do the banners and the letterhead join later?** **Pick: the letterhead yes, the banners no.** A letterhead carries facts that change, the phone and the site, and the app already prints letters. A banner is one picture for the whole company and stays the designer's file.
10. **Which office number is right?** The card sample and the letterhead print an 801 number. The app's letterhead holds a 512 number. **Pick: the app's,** and the letterhead file is corrected when it joins. The owner knows which is true.
11. **One orange?** **Pick: yes, `#e17232`,** unless the designer names another. **Answered 2026-11-11: taken.**
12. **Even lines on the card back?** **Pick: yes.** **Answered 2026-11-11: taken.**
13. **A title on the card and the footer?** **Pick: yes, on both.** **Answered 2026-11-11: taken.**
14. **A phone on the footer?** It puts that number on every mail the person sends. The app's own signature already carries the cell. **Pick: yes, the mobile.** **Answered 2026-11-11: taken.**
15. **The card front: the photo or the drawn one?** **Pick: the photo,** once the designer sends it clean and says the company may use it. The drawn front until then, if cards must be printed sooner. **Answered 2026-11-11: taken.**
16. **Offer other looks at all?** One look for everyone is the simplest brand. **Pick: yes, but three on at once at most,** and only looks the owner has switched on. **Answered 2026-11-11: yes, built.**
17. **Which candidate first?** **Pick: navy and orange.** It changes no logo, it is ready today, and it matches the signed-out pages. Navy and yellow follows once call 18 is settled. **Answered 2026-11-11: both navy looks, the yellow one with the orange hand kept.**
18. **May the logo's hand turn yellow?** It is a second version of the company's mark. **Pick: only when the designer draws it.** Until then a yellow look keeps the orange hand. **Answered 2026-11-11: passed on for now.**
19. **A look by taste or by trade?** Yellow is already Electrical's colour in the app, and the logo's second word is type. So navy and yellow with *Electrical* under CLICK could be the electrical side's card, and orange the plumbing side's. **Pick: by trade first.** It gives the second look a reason, and a customer can tell the two crews apart. A free pick per person can follow. **Not answered; built as a free pick per person, as the plan drew it.** By trade is still open, and needs the logo's second word to follow the trade.
20. **What happens to people on a look that is switched off?** **Pick: they move to the default,** and their card says so once.
21. **The exact navy and yellow.** The page uses `#16283c`, the navy of the signed-out pages, and `#f6c700` as a stand-in for safety yellow. **Pick: the app's navy, and the yellow from the designer** or from the yellow the crews already wear.

## Where it plugs in

- **The facts.** `users.title` as it is. New on `users`: the name on the card, the photo's path and its three crop numbers. A migration, no new table.
- **The photo's home.** A new private storage bucket with policies on `storage.objects`: the person writes their own, the office writes anyone's, the same two read.
- **The templates.** `kit.js` moves to pure kernels under `src/lib/` in the same three layers, with tests that hold the measured numbers and an overlay test against the designer's files. Lexend is bundled as a font file. The mark and the pipe photo move to `public/brand/`.
- **The photo sheet.** New. `src/lib/materials/photoShrink.ts` already shrinks a photo on a canvas and can be reused.
- **Your account.** A new card beside `SignatureCard` in `SettingsAccountTab.tsx`. The title field is the same field the signature reads through `src/lib/messages/signatureIo.ts`.
- **People → Users.** One line in the row menu and one in the page's More tools menu in `PeopleUsersTab.tsx`. The team window's press takes its words from `batchWords` in `src/lib/batchWords.ts`.
- **The print file.** `pdf-lib` and `jspdf` are both in `package.json`. The print surfaces sit in `data-theme="light"` wrappers. A card is not a send, so the sent-copies ratchet (`src/lib/sent/sentCopiesCoverage.test.ts`) gets it on `NOT_A_SEND` with that reason.
- **Later, on a call.** Live words need a public home for the logo and each round photo. Gmail set by the app needs the new scope in `docs/DRIVE_INTAKE_SETUP.md` and an edge function.

## The plan

Six small PRs were planned. They were built as three: PR 1 as v2.6941, PR 2 as v2.6942, and PRs 3 to 6 together as v2.6943, since CI's test step runs over half an hour a PR.

1. **The facts and the photo's home (S).** The migration: the name on the card, the photo's path and crop on `users`, the bucket and its policies. No screen.
2. **The templates as kernels (S).** The brand, the three layouts and the parts, the fit of a long name, the ring's crop math, the font, the mark. Tests hold the numbers measured here.
3. **Your card and footer, with the photo sheet (S).** The card on Your account: add a photo, place it in the ring, the name on the card, the title, the live preview. The help guide starts here.
4. **The footer's presses (S).** Download the picture and Copy the picture, with *Where it goes in your mail*.
5. **The card's presses (S).** The print file and the sheet of ten.
6. **A teammate and the team (S).** The row menu's line, the same card in a window, the team window with what is ready and who is held.

Waiting on a call each: the footer with live words (S, call 2), Gmail set by the app (M, call 3), the letterhead (S, call 9).

## How to verify

- **The templates.** Open `templates.html`. Change Marisol's name to a long one: it shrinks and stays clear of the edge. Clear Dale's title: the lines move up. Drag the ring: the footer follows. In section 5, change the orange, type Electrical and tick the license line: every picture follows, and Put it back restores them.
- **Against the designer's files.** Draw the footer with the designer's sample words and lay it over footer 01. Outside the photo the two differ along thin edges only. The same for card back 1.
- **A picture from a canvas.** A browser will not load a web font or a linked picture inside an SVG it draws onto a canvas. The font and the logo must be written into the SVG as data before it is drawn, or the words fall back to the system font. Check the downloaded picture, not the preview.
- **Gmail's signature box.** Upload the picture with the Insert image button and send a test mail to an outside address. Check it on a phone and in a dark mail app. Try a paste too, and keep Copy the picture only if Gmail holds a pasted picture after Save Changes.
- **The size in mail.** The files in use are 2709 px wide and Gmail scales them with its size choice. See which choice the assistant uses, and make the mail-size download fit it.
- **The print file.** Measure the PDF: 4.25 × 2.75 inches a page, the crop marks 3.5 × 2 apart. Send one to the print shop before a box is ordered.
- **The make command.** Run it with `--sample`. Six are made and Hank Brewer is held for no photo. Open a card's PDF and measure a page.
- **Changing `kit.js`, `mock.css` or `mock.js`.** Run `node to-dos/cards-and-footers/inline.mjs`. The board serves only a to-do's `.html` files, so each page carries its styles, its scripts and its art inside itself.

## Found in passing, not fixed

- **The window *Edit name, title & phone* does not edit the title.** Its box saves to a free note. A title typed there never reaches a signature. Call 8 covers it.
- **Two office numbers.** The designer's art and the app disagree. Call 10.
- **The art says Plumbing, the mail says Construction.** The app heads most of its mail Click Construction and the company constant reads Click Plumbing and Electrical. The designer's kit is Click Plumbing only. A card for someone on the electrical or the building side has no art yet.
- **Two of the three letterhead files are one file** under two names.
- **The new headshot is a tight portrait.** It fills the ring more than the designer's sample does and cannot be zoomed out. A photo with more room around the head sits like the sample.
