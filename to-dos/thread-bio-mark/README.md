---
name: "The bio line in Messages wears a small bio mark"
number: 282
group: close
status: built and merged 2026-11-07 as v2.6659 (#7254), the morning #114's walk closed; left: the owner's look at a real thread, then retire the card
summary: >
  The bio the office writes about a tech goes as the second text after his first On my way to a
  customer. In the customer's thread it reads as a plain outgoing text from the tech, a
  four-sentence paragraph with nothing saying the app sent it. The row already carries the tech it
  introduced. One small bio mark beside the tech's name on that line tells the office it was the
  app's intro, and the hover names whose bio it is.
next: the owner opens a thread that holds a bio line and looks at the mark; then this card is deleted in a docs PR.
size: S
blocker: None.
opinion: build it as one chip on the existing line, read from the column v2.5590 already writes; nothing new in the database.
mockup: to-dos/thread-bio-mark/mockup.html
ver: v2.6659
---

# The bio line in Messages wears a small bio mark (#282)

## The ask

The owner, 2026-11-07, on closing #114 (the tech's bio): "should we do the small bio mark? what is the benefit?" and then "let's write up the small bio mark and then do it here now."

## The benefit

- Whoever reads the thread later sees at a glance that the paragraph was the automatic intro, not something the tech typed, so nobody answers it or wonders why he wrote his resume to a customer.
- When a customer replies to the bio, the office knows the reply is to the intro and can route it to the tech without reading the paragraph.
- When the office checks whether a tech has been introduced to a customer, the mark answers it without opening the message.

The customer never sees the thread, so nothing changes on their side. It is a comfort for the office, cheap because the data is already in place.

## The decision

One chip, the word *bio*, in the line's meta row beside who, blue-bordered like the job tag, with the hover words naming the tech from the thread's roster. No filter, no search, no change to Follow up. The quo-send ordering gap v2.6640 named (it sends before it writes the thread) is a separate piece and is not on this card.

## Where it plugs in

- `messages.introduces_user_id` — written since v2.5590 by `quo-send`'s tech path on the bio text. Exists.
- `src/lib/messages/thread.ts` — `ThreadMessage.introducesUserId` and `bioMark()`. New in v2.6659.
- `src/lib/messages/messagesIo.ts` `MESSAGE_COLS` and `src/lib/messages/load.ts` — read and map the column. Changed in v2.6659.
- `src/components/gc/messages/ThreadLine.tsx` — draws the chip, `data-thread-bio=<user id>`. Changed in v2.6659.

## How to verify

1. Open Messages as the office and find a customer thread with a bio line (the text that opens *A little about …*).
2. The line wears a small **bio** chip beside the tech's first name. Hover it: *<Name>'s bio, as the office wrote it. The app sent it after their first On my way to this customer.*
3. The On my way line above it has no chip. Nor does any other text.
4. `npm test -- src/lib/messages/thread.test.ts src/components/gc/messages/ThreadLine.render.test.tsx` holds the kernel and the chip.
