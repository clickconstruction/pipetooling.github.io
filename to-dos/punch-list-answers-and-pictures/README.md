---
name: "Punch list: what is still to answer and what it looks like, on every card"
number: 438
group: ready
status: asked 2026-11-24 by Diane · the same day fifteen built cards that waited on a person were drawn in the lens frame with invented data, and each got a pictures page beside it with what it waits on and what to say · the kit that drew them is in this folder · the board's own view of the questions and the pictures is not drawn and not built
summary: >
  Diane wants the Punch list page to make two things easy for a person. First, the questions that
  person still has to answer. Second, what a card looks like before and after it is built. Today the
  board shows a card's status, its Next line and links to its pages, and a person has to open the card
  to find the question. On 2026-11-24 a session drew the real screens of fifteen built cards with
  invented data and wrote, for each, what it waits on and the one or two answers that would move it.
  Those pages now sit beside their cards, so the board links to them. What is left is the board
  itself: a view of every card that waits on a person, each with its question and its pictures.
next: Draw the board's view as a mock-up, a list of the cards that wait on a person with the question and two pictures on each row, and put the five calls below to the owner.
size: M as a train of three (S · M · S)
blocker: None. The view wants a mock-up and the five calls before it is built.
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

## What the board does not have yet

The board (`/punch-list`, `src/pages/PunchList.tsx` over `src/lib/todos/todoBoard.ts`) reads each
card's front matter and lists its pages. A row shows the name, the status, the Next line, the
blocker and links. It has no place for a question and no picture.

What the ask wants, as three small PRs:

1. **A question on the card (S).** A front-matter list, one line a question, each with who it
   waits on and the answers that would move it. `npm run check:todos` reads it. The board draws
   the questions on the row, and a filter shows only the cards that wait on a person, grouped by
   who.
2. **The pictures on the row (M).** The row shows two small pictures from the card's pictures
   page, and a press opens the page. A card that is not built shows the app today beside its
   mock-up, which is the before and the after. A built card shows the built screen alone.
3. **Draw them again with one command (S).** The kit in `draw/` becomes a script that redraws one
   card's pictures by its number, so a picture does not go stale after the next change to its
   screen.

## The calls, each with a pick

These picks are the session's, not the owner's.

| Call | Pick |
|---|---|
| 1. Where a question lives | In the card's front matter, as a list. The Next line stays the next act. A question is what a person must say. |
| 2. Where the answer goes | Said in a chat or to a session, as today. The board gives a line to copy, such as *#396: go ahead*. No answer is saved in the database in the first cut. |
| 3. Before and after | A card that is not built: the app today in the lens frame, beside the card's mock-up. A built card: the built screen alone, with its mock-up only where the two differ. |
| 4. Where the pictures live | Inside the pictures page, as WebP, about 0.3 to 0.5 MB a card. The build copies only `.html` out of `to-dos/`, so a picture beside the page would not be served. |
| 5. Who draws them | A session, when it builds a card or leaves it waiting on a person. The page carries its date, and the board says when a page is older than the card's newest version. |

## How to verify

This PR: after the deploy, each of the fifteen rows on `/punch-list` lists *pictures*, and
`/to-dos/training/pictures.html` opens with its eight pictures. `/to-dos/punch-list-answers-and-pictures/waiting-2026-11-24.html`
opens, and each *See its pictures* door opens that card's page.

The view, once built: a person opens `/punch-list`, picks the cards that wait on them, and reads
each question with its pictures without opening a card.
