---
name: "Punch list: what is still to answer and what it looks like, on every card"
number: 438
group: ready
status: asked 2026-11-24 by Diane · the same day fifteen built cards that waited on a person were drawn in the lens frame with invented data, and each got a pictures page beside it with what it waits on and what to say · the kit that drew them is in this folder · the board's own view drawn the same day on Diane's word, as a canvas of seven frames with a refined cut D and a static copy here · her word on it the same day, *Build D*, on the seven picks · PR 1, the question on the card, is open as #9706 · PR 2, Waiting on me, is being built
summary: >
  Diane wants the Punch list page to make two things easy for a person. First, the questions that
  person still has to answer. Second, what a card looks like before and after it is built. Today the
  board shows a card's status, its Next line and links to its pages, and a person has to open the card
  to find the question. On 2026-11-24 a session drew the real screens of fifteen built cards with
  invented data and wrote, for each, what it waits on and the one or two answers that would move it.
  Those pages now sit beside their cards, so the board links to them. What is left is the board
  itself: a view of every card that waits on a person, each with its question and its pictures.
next: Merge PR 1 (#9706) and push its migration. Then PR 2, the Waiting on me view as D draws it, and a look at it on the live site.
size: M as a train of three (S · M · S)
blocker: None. Diane said Build D on 2026-11-24.
opinion: build — the pictures and the answers exist for fifteen cards and the board already links to them, so the view is mostly reading what is there
---

# Punch list: what is still to answer and what it looks like (#438)

## The ask, in Diane's words

2026-11-24, after the pictures were drawn and shown as one page:

> We should save all this punch list pictures stuff to the punch list section of the app so it
> persists longer than just our talking.

> The goal would be to make the punch list section of the app really easy for a user to go, okay,
> these are the questions I need to answer still, and this is what it looks like before and after
> if I build it.

Earlier the same day she had asked which cards could be built right away. Most of the cards marked
ready turned out to be built already and waiting on a person. She asked to be shown them, so she
could go down them and say what to go ahead on and what to change.

## What is saved

- **A pictures page beside each of fifteen cards.** `pictures.html` in the card's folder, or
  `<slug>-pictures.html` for a flat card. The board lists it by itself as *pictures*. Each page
  opens with **Still to answer**: what the card waits on and from whom, and the one or two answers
  that would move it, written as a person might say them. Then where it stands, the calls with
  their picks, and the pictures, each labelled for what it is.
  The cards: #111, #119, #125, #284, #396, #426, #188, #189, #421, #375, #350, #329, #302, #298, #411.
- **One page over all fifteen**, [`waiting-2026-11-24.html`](waiting-2026-11-24.html): each card
  with what it waits on, what to say, and a door to its pictures. It is a snapshot of that day and
  does not follow the cards.
- **The kit that drew them**, in [`draw/`](draw/), and how to use it:
  [`how-the-pictures-were-drawn.md`](how-the-pictures-were-drawn.md).
- The first form of the same thing, one long page: *Punch List Pictures* —
  https://claude.ai/artifact/PQzoJpjACF82H5BXfir6nw (private to Diane's account).

Every picture is drawn with invented people, jobs and money. 85 of the 88 are the app itself, run
on a local server in the lens frame (punch list #194), which swaps the database for an invented
company before the app starts. Three are a card's own mock-up, marked Not built. The live site was
not opened and nothing was written anywhere.

A pictures page retires with its card: when the card's folder is deleted, the page goes with it.

## What the pictures found

Drawing a screen is also a look at it. None of these was fixed. Each is written on its card's
pictures page too.

- **#125**: the Pipeline row's box draws no bar and no *Nobody has answered.*, and the speech
  bubble draws no dot. `boardDotsByJob` (`src/lib/messages/boardDots.ts`) keys its map by a line's
  `jobId`, which is a job key (`pipeline:<id>`, from `jobKeyOfRow`). The row reads the map with the
  bare `job.id`: `JobsStagesActivityBox.tsx`, `jobsStagesRowShared.tsx` and `JobsStagesCardList.tsx`.
  The 3 px bar is also cut off by the box's scroll area. These are the things the card's Next line
  asks the owner to look at after the text from the test phone.
- **#411**: its Next line is stale. It says to merge the two step-three PRs. Both are merged.
- **#302**: the two weeks of use ended on 2026-11-24, so the look at the count is due.
- **#284**: My Time now shows one line and no percent. The card describes the earlier screen.
- **#396**: the open card is *Job pace* with two bars and *On track*. The card says one bar and *On pace*.
- **#188**: two cards the owner now opens still say *(dev)* in their titles. Banking's empty Ledger
  offers the controller *Refresh from Mercury*, while the audit keeps Sync from Mercury a dev's.
- **#350**: a payment record for one check over two sheets prints only the first sheet's memo.
- **#375**: on a phone the Checklist count covers the gear icon.
- **#421**: a customer's job chip read the raw word `ready_to_bill` in the frame. Not checked
  whether that is the app or the invented rows.
- **#111**: Settings → Training lists four courses. The card speaks of three.

## What the board has today

The board (`/punch-list`, `src/pages/PunchList.tsx` over `src/lib/todos/todoBoard.ts`) reads each
card's front matter and lists its pages. A row shows the name, the summary, the Next line, the
blocker, an opinion and links. At a desk one row is about 520 px tall, and on a phone 1,111 px.
What the card waits on is inside the Next line. The pictures are one press away. The row's answer
control is Do, Later, Drop with a note: it is shared, it keeps the name and the day, and it sorts a
card that is not built yet.

## The mock-up

Drawn 2026-11-24 on Diane's word (*Yes, draw it*). Her word on it the same day: *Build D*.

- The canvas, where each frame also has a dark theme: *Punch list: answers and pictures* —
  https://claude.ai/artifact/JAcnxSYRzuYqpenkf9bTbN (private to Diane's account).
- The static copy: [`mockup.html`](mockup.html). It carries the critique, the doubts and the calls.

Seven frames:

- **Today, at a desk and on a phone.** The real app in the lens frame, invented data.
- **A.** A third View, *Waiting on a person*: the cards grouped by who, a short row each, a small
  picture, and Go ahead and Change on the row.
- **B.** One card opened: the question, the card's own answers, and today beside what it becomes if
  built.
- **C.** A on a phone.
- **D, at a desk and on a phone.** The refined cut.

### What was wrong with A, B and C

1. A answers the wrong question. The ask was the questions *I* need to answer. A lists fifteen rows
   for everyone.
2. A row says a status, *Waits on the owner*. A person cannot answer a status.
3. Go ahead and Change sit beside the board's own Do, Later and Drop: two ways to answer on one page.
4. A picture 54 px wide says there is a picture. It does not show the screen.
5. Before and after only exists for work that is not built. Fourteen of the fifteen cards are built.
6. Nothing says a picture is old. The My Bids screen changed the day its pictures were drawn.
7. An answered card stays in the list.

### What D does

- It opens on **Waiting on me**, with the count on the View pill. Everyone else's questions are
  behind pills.
- The question comes first, as a sentence a person can act on, with one word in front for the kind:
  Look, Read, Walk, Decide or Use. The card's name comes second.
- One way to answer: the board's own pick, which on a card with a question reads **Go ahead,
  Change, Not now**. Change opens the note. It is saved where Do, Later and Drop are saved today.
- One lead picture at a size that reads, and *See all* for the rest. A built card says Built. Work
  not built shows Today beside If built, the mock-up side with a dashed edge.
- An old picture says so: *The screen changed after these were drawn.*
- Answered cards fold into one line at the foot.
- B stays as the opened row.

### Honest doubts

- *Me* needs a rule: each question has to name who it waits on, by role. Counsel has no login.
- Change is not a pick today. The store holds Do, Later and Drop. A fourth value is one migration.
- A question on the card is one more thing each session has to keep true.
- The lead picture is somebody's choice.

## The plan

Three PRs, on the seven picks as they stand:

1. **The question on the card (S).** The front-matter list, read by `npm run check:todos`. The
   fifteen cards take theirs from their pictures pages. No screen changes.
2. **Waiting on me (M).** The View as D draws it: the rows, the answer control over the pick store,
   the lead picture, the opened row, the fold of answered cards. The fourth pick is its migration.
3. **Draw them again with one command (S).** The kit in `draw/` becomes a script that redraws one
   card's pictures by its number, and the row says when a page is older than the card's newest
   version.

## The calls, each with a pick

These picks are the session's. Diane said *Build D* on them on 2026-11-24, so they are the build's until someone overturns one.

| Call | Pick |
|---|---|
| 1. Does it open first? | Yes, for a person who has a question waiting. Everyone else lands on By group, as today. |
| 2. Where a question lives | In the card's front matter, a list. Each line has who, the kind (Look, Read, Walk, Decide, Use) and the question. The Next line stays the next act. |
| 3. Who is *me* | By role: the owner is the Leader, the office is the assistants and the controller. Counsel and Time show to the office and the owner. |
| 4. The answer | The board's own pick and note, read as Go ahead, Change, Not now on a card with a question. Change becomes a fourth pick, with one migration. |
| 5. The picture on the row | One lead picture, named in the card's pictures page. *See all* opens the page. The picture stays inside the page as WebP, since the build copies only `.html` out of `to-dos/`. |
| 6. Before and after | Only for work that is not built: the app today in the lens frame, beside the card's mock-up. A built card shows the built screen alone. |
| 7. An old picture | The pictures page carries its day. The row says so when the card shipped a version after that day. |

## How to verify

This PR: after the deploy, each of the fifteen rows on `/punch-list` lists *pictures*, and
`/to-dos/training/pictures.html` opens with its eight pictures. `/to-dos/punch-list-answers-and-pictures/waiting-2026-11-24.html`
opens, and each *See its pictures* door opens that card's page.

The view, once built: a person opens `/punch-list`, lands on the cards that wait on them, and
answers each question beside its picture without opening a card.
