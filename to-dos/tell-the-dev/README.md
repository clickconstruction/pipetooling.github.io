---
name: "Tell the dev: a wrench on every page that sends a note with the page it was written on"
number: 380
group: waiting
status: asked 2026-11-17 · read against the app, drawn and rendered the same day · the owner asked *is this the best we can do?*, took the revised version, added Fix Mode and the no-signal rule, and said build · built the same day as a train of seven, both migrations pushed and the function deployed · the test started 2026-11-17, when PR 3 went live · no note has been sent yet
summary: >
  The owner's idea: a small floating wrench on every page. A press opens a box that starts a
  sentence, *I want* or *This page is confusing because*, and the note goes to the dev with the
  state of the page. Read against the app, the box already exists: it sits at the bottom of each
  Help guide, with its table, its push and its inbox, and it has taken no notes since July,
  because the Help page is where nobody goes. So this is a two-week test of one thing, whether the
  door was in the wrong place. The same table is widened to carry a page and its state. The
  wrench floats at a desk and sits in the header on a phone, where both bottom corners belong to
  Job Mode. An error line carries its own press, a window's title row carries one on a phone, and
  the answer comes back to the sender with a dot. No picture of the screen is taken.
next: The read on 2026-12-01, two weeks after PR 3 went live, on Settings → Usage and Notes to the dev. Before then, every note gets an answer within two work days. The first note sent is also the live walk.
size: M as a train of seven (S · M · S · S · S · S · S), the push's function sent ahead of its client call
blocker: None. The read waits on its date.
opinion: build as a test with a rule for taking it off — the pipe exists, so the cost is small, and the risk is on the reading side
mockup: to-dos/tell-the-dev/mockup.html
---

# Tell the dev (#380)

## Where it stands

Built 2026-11-17 and live. The test started that evening, when PR 3's deploy landed. The read is on 2026-12-01.

| PR | Version | What |
|---|---|---|
| #8558 | v2.7650 | The ground: `20261117235000_help_feedback_page_notes.sql`, pushed, and the kernels |
| #8575 | v2.7658 | The wrench, the box, Fix Mode in the gear menu, Notes to the dev, the guide |
| #8577 | v2.7679 | `notify-help-feedback` words a page note. Deployed |
| #8606 | v2.7660 | The press on an error line and the wrench in a window's title row on a phone |
| #8629 | v2.7663 | Your notes and the dot |
| #8644 | v2.7668 | A went wrong note calls the push |
| #8576 | v2.7666 | Training accounts: `20261118001000_read_only_may_tell_the_dev.sql`, pushed, with its SQL bed |

Checked before the merge, on a local server as the dev, read only: the wrench and the box at a desk, the sheet on a phone, the Fix Mode row, and Fix Mode off taking every wrench away. After the deploys, the site's bundle was read for the wrench and Fix Mode.

Not done:

- No note has been sent on the live app. The first one a person sends is the walk: it should land under Notes to the dev on the Dashboard, and a went wrong note should push the dev.
- The four checks under *How to verify* have not been walked on the live app.
- Nobody has pressed the wrench on a real phone.

## The ask

The owner, 2026-11-17, in his words:

> a small floating wrench icon in the corner of every page where if someone was to click it, it
> could take a state of their page and give them a box to type in either the rest of the sentence
> of "I want..." or "This page is confusing because..." and then share that with the dev. We may
> also not build this feature, but this seems like something we should think through and
> potentially build to accelerate the feedback we are getting in the app.

After the first sketch he asked *is this the best we can do?* The revised version below is the
answer. He took it, and added two things of his own:

> if the phone lost signal we should not tell the dev, i think we have a process where some things
> like uploads are stored offline on the phone until it retries and is successful.

> I want to add to the gear icon in the top right hand corner "fix mode" that toggles showing or
> not showing this floating wrench

## The answer, in short

Build it as a test, with a rule for taking it off. Don't build it was a live answer, and the
honest case for it is the reading side: a box that fills and gets no answers teaches people that
nobody reads it. The case for building won because nearly all of it exists.

## What exists

| Piece | Today | Verdict |
|---|---|---|
| A box that reaches the dev | `HelpGuideFeedbackForm`, at the bottom of a Help guide and nowhere else | Reuse the pipe, move the door |
| The table | `help_feedback`: who, which guide, the words, open or closed, a closing note. No page, no kind, no state. `guide_slug` is required | Widen |
| Who may write and read | Any signed-in person writes their own. The owner or a dev reads and closes | Reuse |
| The push | `notify-help-feedback`, each dev through their Push me hours | Widen: a page note has no guide |
| The inbox | `HelpFeedbackInboxSection` on the Dashboard's Teams inbox card and in the Checklist's review | Widen: draw the kind, the page and the state |
| The answer reaching the sender | The closing note is drawn in the dev's inbox only | Missing |
| A crash or an error, in words | Crashes go to the console. Error lines are counted by family in `ui_nav_clicks` | The note carries the last error line |
| Presses and page minutes | `ui_nav_clicks` and the heartbeat, read on Settings → Usage | Reuse: count opens against sends |
| A press kept with no signal | The outbox (`src/lib/offline/outbox.ts`): ten kinds of press are kept on the phone and sent in order when the signal is back | Reuse the rule: a lost signal is the app's job, never a note |
| Digital twins | May already insert into `help_feedback` | Reuse |
| Training accounts | Stopped twice, by a policy and by a statement trigger | Widen, last PR |

How many notes the guides' box has taken: none. Card #187 measured why, the Help page gets a
sixtieth of the Pipeline's minutes.

## The screen

- The header is in the page's flow. It scrolls away. Help sits inside the gear's menu.
- A phone's bottom edge is the Job Mode or Dispatch bar, with Job Mode's press bar above it on the Dashboard.
- Toasts land top right, under the header.
- The section dock's stub sits bottom right at a desk.
- So a phone has no free corner, and a desk's bottom left is free.

## The decision

**Who gets it.** Every signed-in person, subs in the app included. No customer page, no public
page and no token portal: a write box with no sign-in invites spam.

**Three starts.** *I want…*, *This page is confusing because…*, *Something went wrong when I…*.
The start is the note's kind. The first needs words. The other two can be sent with none, because
the page and its state already say who, where and what was open.

**What goes with a note.** The page and its tab, the open window's title, the role, phone or desk
and its width, which modes are on, the app's version, the last error line shown and the last calls
the server refused. The box lists all of it before the press. No picture of the screen is taken:
a picture can hold a customer's address, a pay rate or an HR note. *Open that page*, viewed as the
sender, shows the dev the same screen.

**A lost signal is not a note.** The outbox keeps the press and sends it later. An error line that
only says the signal dropped carries no Tell the dev press, and a failed call with no answer from
the server is left out of a note's state.

**Where the wrench is.** At a desk it floats bottom left, with the words Tell the dev until that
person has opened it once. On a phone it sits in the header beside Search, on an error line, and
in the title row of the shared window. All of them open the same box.

**Fix mode.** A row in the gear menu, drawn as Job Mode's is. On, the wrench shows. Off, every
wrench is gone from that person's screens on that device. It starts on, so the test can be seen.
The guides' own box stays either way.

**Where a note lands.** The same table and the same inbox. *Answer and close* writes the line the
sender reads in the box under *Your notes*, and the wrench shows a dot while an answer is unread.
*Copy as a brief* puts the note on the clipboard in words a coding session can start from, with
the line that a card restates it with no real names, since this repo is public.

**How fast.** A went wrong note pushes each dev at once, through their hours. The other two wait
for the day's read of the inbox.

## Looked at and left out

- **A picture of the screen.** Privacy, weight and a phone's speed, as above.
- **Guessing confusion from presses.** The ledger says where people struggle. Only words say why.
- **Notes with no name.** An answer has to reach someone.
- **Sending a note with no signal.** The outbox has no kind for words, and its server side would be new. The box keeps the draft on the phone and says so.
- **Making a card from the app.** The board is this folder. A session reads the notes through the dev seat and writes the card.

## The plan

Each PR is its own change, with its release note and fragment.

1. **The ground (S).** A migration widens `help_feedback`: `kind`, `page_key`, `page_path`, `context`, and `guide_slug` no longer required. No new table. Kernels with tests in `src/lib/tellTheDev/`: the starts, the state and its lines, what may be sent, the brief, Fix mode's switch, the rule for an error line's press, the short memory of error lines and refused calls. Then the push and a types refresh.
2. **The wrench (M).** The box, the floating wrench at a desk, the header wrench on a phone, Fix mode in the gear menu, the inbox drawing kind, page and state, *Open that page*, *Copy as a brief*, opens counted in the ledger, the guide.
3. **The doors (S).** The press on an error line, never for a lost signal, and the wrench in the shared window's title row on a phone. The test starts here.
4. **The answer (S).** *Your notes* in the box and the dot on the wrench.
5. **The push (S).** `notify-help-feedback` words a page note and pushes for went wrong alone.
6. **Training accounts (S).** One exemption, on the pattern of the clock punch's.

## How to verify

- Send one note of each kind from a desk and from a phone width as a sample account, and read them in the Dashboard's inbox as the dev.
- Turn Fix mode off and check every wrench is gone, on a desk and a phone.
- Force a refusal and a lost signal. The first error line carries the press. The second does not.
- Close a note with an answer and read it as the sender, with the dot.

## How the test is judged

Two weeks after PR 3 is live, read Settings → Usage and the inbox.

- **Keep it** when about ten notes came from at least four people other than the owner and the assistant who relays today, some from phones, and at least three became a fix or a card.
- **Take the wrench off** when fewer than three notes came. The guides' box and the widened table stay.
- **Opens with no sends** means the box asks too much. **No opens** means nobody saw the wrench.
- Every note gets an answer within two work days, or the test is measuring the wrong side.
