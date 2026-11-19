---
name: "Share this map: a sheet a person on site can use almost without reading"
number: 394
group: close
status: asked 2026-11-18 with a phone screenshot of the sheet · designed, drawn and rendered the same day (seven rows of sheets at a phone's width and a desk's, light and dark) · shown to the owner with seven calls, each with a pick · the owner's word the same day (*Build it*), every call at the pick · the kernel built (v2.7788) and the sheet over it (v2.7790) the same day · walked on a local server in a headless Chrome at a phone's width and a desk's, light and dark, with a stand-in for the link's calls · not yet tried on a real phone or with a real link · walked 2026-11-18 on an iPhone simulator (iOS 26.4, Safari) against a local server signed in as the dev, with real links on a made-up map on no job, thrown away after: all three presses work after the wait for the link, and the walk found the sheet saying Messages had not opened when it had, fixed in v2.7863 · the owner's word the same evening (*Build all the steps*): step 3 built in v2.7877, the phone picks the link's code and Messages opens inside the press · merged and `painted-map-link` deployed the same night, then walked on the iPhone simulator against the deployed function: the first press opened Messages with no question from Safari, and the server held the code the phone picked
summary: >
  The owner asked how to offer a painted map's Share sheet with fewer words, so a person does not
  have to read so much. Today the sheet shows 163 words before a link exists and its one live press,
  Make a link, sends nothing. A text is three more presses through words that never say text. The
  design drops the Make a link step: every sending press makes the link itself. One blue press,
  Text it from my phone…, leads. Four tiles with a picture each sit under it: Show a code to scan,
  Copy the link, Make a picture and Send it another way…. Print and the two files fold behind one
  press. What a reader meets is one line with a press that opens today's four sentences, word for
  word. The same sheet is 43 words before a link and 65 after, and the map still shows behind it.
next: Two looks, then delete this card. An Android phone has not been tried at all, so press Text it from my phone…, Send it another way… and Copy the link on one, each before a link is out, on the live app with a made-up map. And Taunya sees the one line that stands for her name sentence.
size: M as a train of three (S · M · S), all built, with the fix the walk found (XS); left: an Android phone and Taunya's look (XS)
blocker: An Android phone in a hand. Call 4 was taken at the pick on the owner's word, and the name sentence was Taunya's ask, so she should see the one line that stands for it.
ver: v2.7788 · 7790 · 7863 · 7877
opinion: built as carded, step 3 included and walked on an iPhone simulator — an Android phone is the one thing nobody has seen
---

# Share this map, with fewer words (#394)

The mock-up is [mockup.html](mockup.html). It draws seven rows, today's sheet on the left of each
and the new one beside it, with the words and the presses counted from the sheet as drawn. Add
`?s=<id>` for one row or one sheet alone: `before`, `after-tech`, `after-office-job`,
`after-office-nojob`, `refused`, `folds` or `desk`, or one sheet such as `before-pick`. Add
`&cap=1` to keep the caption and the count, and `&theme=dark` for the dark theme. Every job, name
and link code on it is made up.

It was rendered in a headless Chrome at 375 × 812 and at a desk's width, light and dark, and every
picture was looked at. The render's own check found no press under 44 px on the new sheet, nothing
off the side of the screen and no words cut by their box.

## The ask, in the owner's words

2026-11-18, with a phone screenshot of **Share this map** before a link exists:

> how could I offer this page with less words and in a more intuitive way where the user doesn't
> have to put in the effort to read so much?

## What a person meets today

Counted from the sheet as the code draws it (`PaintedMapShareSheet.tsx`, `PaintedMapCopies.tsx`),
every word on it, the title and **Close** included.

| The sheet | Words | Presses | Fits a phone's screen |
|---|---|---|---|
| Before a link | 163 | 6 | Just |
| A link is out, a tech | 211 | 9 | No, 1,060 px |
| A link is out, the office on a job, two readers listed | 257 | 11 | No, 1,313 px |
| A link is out, the office on a map with no job | 233 | 9 | No, 1,108 px |

- Before a link, one press is live for sending, **Make a link**, and it sends nothing.
- A text is three more presses: **Make a link**, **Send it another way…**, then Messages. No word
  on the way says *text*.
- Once a link is out, the blue press is **Copy the link**. **End this link now** and every copy are
  a scroll away.

## Who opens this sheet, and what they want

Most common first:

1. Text it to one person from my own phone.
2. Show it to someone standing beside me.
3. Send it somewhere else: a group chat, mail, a phone nearby.
4. Send a picture to someone who will not open a link.
5. The office texts the job's customer from the company's number.
6. Print it for a gate guard or a delivery ticket.
7. Hand a file to an engineer or a surveyor.

The order is a judgment, not a count. The live app held one painted map and no link on 2026-11-18,
as the dev seat reads it, so no use decides it. It rests on three things. The owner's own use in
[#392](../paint-a-map-press/README.md): *someone needs a one-off map to text to someone*. The table
*Who gets what* and its pick on [#345](../paint-a-map/README.md), which puts the link's presses
first, then the picture and the page, and the files last. And the walk of 2026-11-18, where the
share step was the second worst snag.

## The design

One sheet. The same presses sit in the same places before a link and after one.

1. **No Make a link step.** The first press of any kind makes the link and does its own work. The
   press reads *Making the link…* for about a second.
2. **One blue press: Text it from my phone…** It opens the phone's own Messages with the words
   written, and the person picks who gets it. Its name says the act and whose phone, so it has no
   second line.
3. **Four tiles, a picture and a name each.** **Show a code to scan**, **Copy the link**, **Make a
   picture** and **Send it another way…**. Each keeps the name it has today and loses its second
   line.
4. **Print or a file.** One press folds open on **Print, or save as a PDF**, **A .kml file** and
   **A .gpx file**, under the copy's warning.
5. **One line for what a reader meets.** *Anyone with the link can open it. They give their name
   first.* Beside it, **What they see** opens today's four sentences, word for word.
6. **Once a link is out,** one quiet block joins under the presses: how many links are out and
   since when, whether it was opened, the day it ends, and **End this link now**. **Who opened
   it** keeps today's rows under that, and takes no room until someone has opened the link.
7. **The office's text is Text the customer…** with one second line, *From the company's number*.
   It sits right under the phone's own text. On a map with no job it stays where it is, grey, and
   says *This map is on no job.*
8. **The code and the picture each take the sheet alone.** The code is large with **Hide the
   code** under it. The picture shows with the copy's warning, one blue **Share the picture**,
   **Make it again**, and a way back.
9. **At a desk** there is no Messages to open, so the phone's own text is not drawn. **Text the
   customer…** is the blue press for the office on a job. For everyone else **Copy the link** is.

### The counts, before and after

| The sheet | Today | The pick |
|---|---|---|
| Before a link | 163 words, 6 presses | 43 words, 8 presses |
| A link is out, a tech | 211 words, 9 presses | 65 words, 9 presses |
| A link is out, the office on a job, two readers listed | 257 words, 11 presses | 108 words, 11 presses |
| A link is out, the office on a map with no job | 233 words, 9 presses | 74 words, 9 presses |
| At a desk, the office on a job, two readers listed | 243 words, 10 presses | 99 words, 9 presses |
| From Share to a text ready to send | 3 presses | 1 press, or 2 if the phone refuses |

Before a link the new sheet has two more presses than today, because every way to send is live at
once and today only **Make a link** is. Of the 108 words with two readers listed, 36 are the
readers' own rows, which today's sheet has too. The new sheet fits a phone's screen in every state
drawn. Before a link it is 403 px tall, so the map shows behind it.

## The calls, each with a pick

1. **Tiles, or one list.** The pick is the tiles. The other way draws every way as a row in one
   list with nothing folded: 68 words and 10 presses before a link, and 981 px with a link out and
   two readers, which is past a phone's screen. A list gives a .gpx file the same weight as a text.
2. **The picture among the first presses.** Yes. A picture is the one copy that goes by phone, and
   it reaches the people who will not open a link. The rule *a link can be ended, a copy cannot be
   taken back* still holds: the link's presses come first, and the warning is said on the picture
   before **Share the picture**.
3. **A copy makes the link too.** Yes. Today a page carries its code only if the person made a
   link first, and the sheet tells them to. With no Make a link step, **Make a picture** and
   **Print, or save as a PDF** make the link themselves, so every copy carries the way back to the
   map as it is today. The other choice is a copy that carries a code only when a link is already
   out, which leaves an old page with no way back.
4. **What a reader meets, as one line and a press.** Yes. The line keeps the two facts a sender
   needs: anyone with the link can open it, and they are asked their name. The other three
   sentences are one press away, whole. This call is Taunya's as much as the owner's, since the
   name sentence was her ask on 2026-11-15.
5. **The office's press is renamed Text the customer…**. Yes. Today it reads **Text it…** and its
   second line carries both who gets it and whose number. Beside **Text it from my phone…** the two
   would read alike. The new name says who gets it and the second line says whose number.
6. **On a phone the person's own text stays first and blue for the office too.** Yes, so the first
   press never moves. The other choice makes **Text the customer…** blue for the office on a job.
7. **The fold's name.** **Print or a file**, which says what is in it. **More ways…** is shorter
   and says nothing.

## What happened to each sentence

Nothing the owner or Taunya asked to be said is gone from the app. Each is kept, shortened on the
sheet with the whole behind one press, moved to the moment it matters, or dropped from the sheet
and kept in the guide.

| On today's sheet | What happens to it |
|---|---|
| *Anyone who has the link can open the map. No sign-in.* | Shortened on the sheet to *Anyone with the link can open it.* Kept whole, first under **What they see**. |
| *They give their name first. We keep the name, the phone or computer and the time.* | The first sentence stays on the sheet. Kept whole under **What they see**. |
| *They see the name, the lines, and the places with their words and photos.* | Moved under **What they see**, as is. |
| *They do not see who painted it, when, or anything else about the job.* | Moved under **What they see**, as is. |
| **Make a link** | Dropped. Every sending press makes the link. *Making the link…* shows on the press that was pressed. |
| *This map already has a link out. A link can be read only on the device that made it, so make one here to send from this device.* | Dropped from the sheet, since there is no step to take: the first press here makes this device's link. The link's line still says how many are out. The guide keeps the reason. |
| The link in a box | Moved under the code, and into the note that shows when the browser will not copy. |
| **Copy the link**, and *Copied. Paste it into a text or an email.* | Kept. The tile reads *Copied* after the press. |
| **Text it…** with *To the job's customer, from the company's number* | Renamed **Text the customer…** with *From the company's number*. |
| *A text goes to a job's customer. This map is on no job, so copy the link or send it another way.* | Shortened to *This map is on no job.* on the grey press. The other ways are on the screen. |
| **Send it another way…** with *A text, mail, a group chat or a phone nearby* | The name is kept. The second line is dropped, since the phone's own sheet lists the ways. The guide keeps it. |
| **Show a code to scan** with *For someone standing beside you* | The name is kept. The second line is dropped and stays in the guide. **Hide the code**, *Point a phone's camera here* and *It opens the map. No app, no sign-in.* are kept. |
| *One link is out, since Nov 18. Not opened yet.* and *The link ends by itself on Feb 16.* | Kept as is, under the presses. |
| **End this link now** and its confirm | Kept as is, beside the link's line. |
| **Who opened it** and its rows | Kept as is, under the link's line. |
| **Or hand over a copy** | Dropped. The tile and the fold name the copies. |
| *A copy cannot be taken back, and it goes out of date. Send the link when you can.* | Kept whole and moved to where a copy is made: on the picture before **Share the picture**, and first under **Print or a file**. |
| **Make a picture** with *The map, its places and the day, as one image. It shows in a text without a press.* | The name is kept. The second line is dropped, since the picture shows what it is. The guide keeps *shows in a text thread without a press*. |
| **Print, or save as a PDF** with its second line, either form | The name is kept, under **Print or a file**. *Make a link first* has no step to point at once a copy makes its own link. *A copy is kept with the job* is still said after the page opens. |
| *A file for another map. The lines and the places with their words. No photos.* | Kept whole, under **Print or a file**. |
| **A .kml file** and **A .gpx file** with what each is for | Kept as is, under **Print or a file**. |

A gate code never goes on a painted map. That sentence is on the place sheet and in the guide, not
on this sheet, and neither changes.

## What an iPhone does (walked 2026-11-18)

Walked on an iPhone 17 Pro simulator, iOS 26.4, in Safari, against a local server signed in as the
dev. The links were real ones from the live function, on a made-up map on no job in a public park.
Every link was ended and the map was thrown away after. No text was sent.

- **Text it from my phone…, before a link is out.** The link is made, then Safari asks *Open this
  page in “Messages”?* with **Cancel** and **Open**. **Open** opens a New Message with nobody
  picked and the words written. So it is the press and Safari's own **Open**. Safari did not refuse.
- **Text it from my phone…, with the link out.** Messages opens at once, with no question.
- **Send it another way…, before a link is out.** The phone's own share sheet opens after the wait,
  titled with the map's name.
- **Copy the link, before a link is out.** The clipboard holds the link and the tile reads
  **Copied**.
- **End this link now** and **Throw this map away** did what they say, and the sheet says the link
  is ended.

**The walk found one bug, fixed in v2.7863.** With the link out, Messages opened and the sheet
still said *This phone would not open Messages. Copy the link and paste it into a text.* The sheet
waits 1.5 seconds to see the page left, and the simulator took longer than that to switch apps.
The sheet now also listens for the page being left at any time in the minute after the press, and
takes those words back. The same press on the same simulator then came back clean.

Not walked: an Android phone, a real iPhone in a hand, and the app saved to a Home Screen.

**Step 3 was a choice, not a repair, and the owner chose it** (*Build all the steps*, 2026-11-18).
Safari asks its question only when the address is handed over after a wait. Since v2.7877 the
phone picks the link's code, so the press opens Messages at once on the first press too, as it
does once a link is out.

- The sheet asks the server on opening whether a link can be made (`desk.can`), and writes
  nothing. Only on a yes does the press hand the phone a text at once. So a text is not written
  around a link the server would refuse: a training account, an empty map, twenty links out.
- The ask for the link leaves the phone inside the press, before Messages opens, and is sent so
  it finishes even though the page is left. A lost signal gets one more try for the same code.
- If the link is still refused or lost after the text is written, the sheet says the reason and
  *The link in that text will not open. Do not send it.*
- Without the server's yes the sheet works as before: the link is made first, then Messages.

**Step 3, walked after the deploy (2026-11-18).** The same simulator, against a local server on
main and the deployed function. A map now has to be on a job, so the made-up map was painted on a
ZZ test job. Both links were ended and the map was thrown away after. No text was sent.

- **Text it from my phone…, before a link is out.** Messages opened at once, with no question from
  Safari. The New Message had nobody picked and the words written, with a link under a code the
  phone picked.
- **The server held that code.** Asked for it with no sign-in, the function knew the link. Asked
  for a code one letter off, it answered that the map is no longer shared.
- **Back in Safari** the sheet read *One link is out, since Nov 18. Not opened yet.* and said
  nothing false about Messages.
- **End this link now** ended it: the function then answered the same code as no longer shared.

## When the phone refuses

Making the link took 1.3 seconds at a desk. A phone's browser may refuse to open another app that
long after the press. An iPhone's Safari does not refuse, as above. **An Android phone has not been
tried.** The sheet is right either way, because after the first press it is always the sheet with
a link out, and there the same press works at once.

- **Text it from my phone…** If Messages has not opened a moment after the link is made, the sheet
  says *The link is ready. Press Open Messages.* and the blue press reads **Open Messages**. One
  more press.
- **Send it another way…** The same: *The link is ready.* and the press again.
- **Copy the link.** Today's words, *This browser would not copy the link. Press and hold the link
  to copy it.*, with the link under them.
- **Show a code to scan** opens nothing outside the page, so nothing can refuse it.
- **No signal.** The link is not made and the sheet says why, as today. A picture is still made,
  without the link.

The app already opens Messages after a wait in one place: an hours statement sent by text
(`HoursStatementModal.tsx`, `smsHref`). Whether that has been walked on a real phone is not written
down.

If a real phone does refuse, the stronger fix is step 3 below: the phone picks the link's code, so
the address is known at the moment of the press and nothing waits.

## Beside #392, #345 and #393

- **[#392](../paint-a-map-press/README.md).** Its change 4 already says the Share sheet loses its
  *Make a link* step and names **Text it from my phone…**. This card takes the Share sheet whole
  and replaces that mock-up's `share` state. #392 keeps the Saved band and its press on the saved
  map, and its `saved` and `messages` states stand. Its plan's step 4 becomes the Saved band alone
  once this card is built. One thing for #392 to take from here: the press needs no second line on
  the saved map either. A second, from the walk after step 3: the Saved band's own **Text it from
  my phone…** still makes the link first and then opens Messages. On the simulator Messages opened
  with no question, because the link came back fast. The band then read *The link is ready. Press
  Open Messages.* though Messages had opened. That is the false note v2.7863 took out of the
  sheet, and the band does not yet listen for the page being left. The band can take both: the
  sheet's press at once, and its listener.
- **[#345](../paint-a-map/README.md).** Its rule for copies and its privacy sentences are the list
  above. Nothing on the `/way` page changes.
- **#393 (closed 2026-11-18, in [the Closed lines](../README.md)).** It worked in the map's window
  and the place sheet. This card
  touches `PaintedMapShareSheet.tsx` and `PaintedMapCopies.tsx` only.

This card can be built before #392. The share step is where the walk lost people, and it needs
nothing from the Dashboard press.

## Where it plugs in

- The sheet: `src/components/paintedMap/PaintedMapShareSheet.tsx` and `PaintedMapCopies.tsx`.
- The words: `PAINTED_MAP_SHARE_WORDS` in `src/lib/paintedMap/paintedMapLink.ts`,
  `PAINTED_MAP_TEXT_WORDS` and `paintedMapTextWords` in `paintedMapText.ts`, and
  `PAINTED_MAP_COPY_WORDS` in `paintedMapPicture.ts`.
- The link: `mintPaintedMapLink` in `paintedMapLinkIo.ts` over the `painted-map-link` function,
  which this card leaves alone through step 2.
- The phone's Messages: `smsHref` in `src/lib/gc/followUpSheet.ts`.
- The guide: `src/content/help/paint-a-map.md`, its *Share a map* and *Hand over a copy* sections.

## The plan, once the owner says build

1. **The kernel** (S), no screen. **Built, v2.7788.** Which presses the sheet draws and which is blue, from who is
   looking, whether the map is on a job, whether this is a phone, whether the browser has a share
   sheet and whether a link is out. The link's line and the words. Tests for every state drawn in
   the mock-up, and one that holds the sheet's standing words under a count so they do not grow
   back.
2. **The sheet** (M). **Built, v2.7790, and walked in a headless Chrome with a stand-in for the link's calls. The two real phones are still to do.** The new layout over the kernel, the link made by the first press, the two
   views for the code and the picture, the fall backs above. The guide's two sections rewritten, a
   release note and a fragment. Walked on a real iPhone and a real Android phone before it merges.
3. **The phone picks the code** (S). **Built, v2.7877, on the owner's word, deployed and walked 2026-11-18.** No phone refused on
   the walk, so this was no longer a repair. It takes away Safari's *Open this page in
   “Messages”?* on the first press. The function takes the code from the painter's phone and keeps
   its hash, so the address is known at the press. A deploy of `painted-map-link`.

## How to verify

- Kernel tests for a tech, the office on a job and the office on no job, each before and after a
  link, on a phone and at a desk.
- Render smokes on the sheet for the same states, on the grey **Text the customer…**, and on each
  fall back with the link's call held or refused.
- A local harness at 375 px, light and dark, against the mock-up.
- On the live app: a made-up map on a made-up job, as a tech and as the office. Nothing sent to a
  real number, the link ended and the map thrown away after.
- On two real phones: **Text it from my phone…** before a link is out, on a weak signal too.
  **Send it another way…** and **Copy the link** the same way. How the link draws in a text
  thread.

## Out of scope

The `/way` page and what a reader is asked there. Who may make a link. The words a text carries.
The Saved band on the map, which is #392's. The marking tools and the place sheet. How a link
draws its preview in a text thread.
