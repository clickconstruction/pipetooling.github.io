---
name: "A missed call gets a text back from the app"
number: 195
group: ready
status: picked 2026-10-26 as option B of #186's item 3 · parked by the owner the same day ("don't do PR4 yet, move it to the punchlist") · not started
summary: >
  When nobody picks up a customer's call, the app texts them back from the company number through
  quo-send, with the office's words from a new Missed calls card on Settings → Phone and texts: one
  line in office hours, one after, and a third when they left a voicemail. It goes through every
  gate the app's texts already have: the Send texts switch, a STOP to that box, a prospect's May we
  text?, our own numbers and the walk kit, no text of ours to that number in the last three hours,
  and the carriers' daily cap. The text lands on the thread marked as the app's, so it never clears
  Needs a reply or starts Waiting on them. The owner picked this over Quo's own auto-reply and over
  Sona, then parked it.
next: The owner says go. Then PR 1 (the migration, the kernel and the webhook's text back) and PR 2 (the Missed calls card and the guide).
size: S as two PRs (S · S); one migration
blocker: The owner's go.
opinion: build — the owner picked it over Quo's own auto-reply; it waits only on the go and two answers below
mockup: to-dos/missed-call-text/mockup.html
---

# A missed call gets a text back from the app (#195)

## The ask

The owner, 2026-10-26, reading #186 (`to-dos/machine-drafts/`), item 3, Quo's missed-call
auto-reply: *"3B"*, the app's own reply through `quo-send` with the words set in Settings → Phone and
texts, in and after office hours, honoring the Send texts switch and a person's *May we text?*. Later
the same day: *"don't do PR4 yet, move it to the punchlist"*. This to-do is that move. Nothing is
built.

#186's item 3 holds the comparison the pick was made from: Quo's own auto-reply switched on in Quo
(A), the app's own reply (B), and Sona answering the call (C), with what each costs, what the office
sees and what the customer gets. The drawing beside this file is B's part of #186's mock-up.

## Today

Dana calls the company number at 4:11 PM on a Friday and nobody picks up. Quo posts `call.completed`
(and `call.missed`, and `call.voicemail.completed` when she left one), and `quo-webhook` writes one
line on her thread: *rang everyone · no voicemail*, or the voicemail's words (`events.ts`'s
`mergeCall`, `callWho`). The line is hers, so it lands in Follow up: the New lane with **Call back**
when nobody has named the number, else Needs a reply. Dana hears nothing until someone calls back.

## The decision

**B**, the owner's pick, over:

- **A, Quo's own auto-reply.** Ten minutes in Quo and one XS PR to name the text on the thread, but
  it cannot honor the app's Send texts switch or a prospect's *May we text?*, and its hours are set
  separately in Quo.
- **C, Sona answering the call.** Nothing to build and a summary of what the caller wants, but a
  voice answers and calls cost past the plan's ten a month.

Two questions for the owner before PR 1, each with a default:

1. **Every missed call, or only people we know?** A missed call from a number nobody has named is
   often a new customer, and often a robocall. Default: text back every number that is a phone,
   since a new customer is the point, and skip a number the office marked *off the list*.
2. **The words.** Default, in office hours: *Sorry we missed your call. This is Click Plumbing. Text
   us here and we answer shortly.* After hours: *Sorry we missed your call. The office opens at 7 AM.
   Text us here and we answer then.* With a voicemail: *We got your voicemail and will call you
   back.* The office edits all three on the card.

## The plan

1. **PR 1 · S · the text back.**
   - A migration: `messages.auto boolean NOT NULL DEFAULT false`; `messages_move_state` skips a line
     with `auto` true, so the app's text neither clears Needs a reply nor starts Waiting on them; the
     `app_settings` row `messages_missed_call_reply_v1` (off as it ships, the three lines) with an
     UPDATE policy for `is_master_or_dev()`; a table `missed_call_replies` (the call's Quo id as the
     key, the contact, the line it wrote, the outcome) so a call that sends three events is answered
     once, ending with the three fence calls.
   - A kernel `src/lib/quo/missedReply.ts`, pure and mirrored to the edge (`scripts/edge-kernels.mjs`):
     from the call reading, the office hours (`hasRule.ts`'s `officeOpen`, `nextOpening`), the
     settings, our last text to that number (`lastOurTextAt`) and the gates, the words to send or the
     reason none goes. A new `SendPurpose`, `missed`, that the Send texts switch gates
     (`textsSwitch.ts`'s `switchGates`).
   - `quo-webhook`: after the call's line is written, on an incoming call nobody answered, claim the
     call in `missed_call_replies`, then `sendText` with purpose `missed` and the line marked `auto`.
     It plans on `call.completed`, which says whether a voicemail was left, so the words fit. A
     refusal (texts off, STOP, *May we text?* not yes, our own number, a text in the last three
     hours, the daily cap) writes the reason on the claim and sends nothing.
   - The thread names the line *The app texted back · from the company number*; the New lane row's
     quiet line reads *The app texted back at 4:12 PM. The row still waits on you.*
2. **PR 2 · S · the card and the guide.** Settings → Phone and texts → **Missed calls**
   (`MissedCallReplyCard.tsx` over `src/lib/messages/missedReplyCard.ts` and its Io), after Office
   hours: the switch, the three lines, what the gates are in plain words, the last ten texts back
   with their outcomes. Anchor `settings-phone-texts-missed-calls`, a dev-door row, the guide
   *text back a missed call*, and the switch card on Messages counts it.

## Where it plugs in

| What | Exists | New |
|---|---|---|
| The call's line | `quo-webhook`, `events.ts` (`readQuoEvent`, `mergeCall`, `callWho`), `quoLines.ts` (`writeLine`, `sendText`, `lastOurTextAt`) | the text back after the line, its claim |
| The gates | `textsSwitch.ts` (Send texts), `send.ts` (`planSend`: STOP, the opt-out line), `prospects/textingRule.ts` (*May we text?*), `walk/kit.ts` and `messages/ownChannels.ts` (our own numbers), `quo/paused.ts` (the daily cap) | `missedReply.ts` puts them in one answer |
| The hours | `messages/hasRule.ts` (`officeOpen`, `nextOpening`), `messages_office_hours_v1` | nothing |
| Follow up | `messages_move_state` (20261012160000), `followUp/newLane.ts` | `messages.auto`, the trigger's one clause, the row's quiet line |
| Settings | Phone and texts cards (`OfficeHoursSettingsCard.tsx` is the shape) | `MissedCallReplyCard.tsx` |

## What it needs

No new key: Quo's key is already in Vault. One migration. Two deploys: `quo-webhook`, and every
function that imports the changed `send.ts` and `textsSwitch.ts` copies (`walkBundle` lists them;
`quo-send` at least). No model: the words are the office's, never drafted.

**Cost.** One text per missed call, at Quo's per-message rate, inside the plan's messaging. The
three-hour rule keeps a caller who rings five times to one text.

## Is this the best we can do?

- **It rebuilds what Quo gives.** Quo's own auto-reply does the sending for nothing. B exists for the
  gates Quo cannot see: the Send texts switch, *May we text?*, one set of hours. That is the trade the
  owner chose.
- **It depends on the webhook.** When `quo-webhook` is down, no text goes; Quo's own would have. Quo
  retries a failed delivery, and the claim table keeps a retry from texting twice.
- **Robocalls.** Texting back every unknown number texts some robots. The carriers watch for texts to
  numbers that never answer. The default above texts every phone; the owner may narrow it to known
  people and voicemails.
- **A landline.** A text to a landline fails at the carrier. The line then reads *⚠ not delivered*,
  and nothing else breaks.
- **Not built, by design:** a model drafting the words from the voicemail. Nobody would press it
  before it went, which crosses the rule the app keeps.

## How to verify

On a ZZ test contact whose number is a dev's own phone, with Send texts on and the card on: call the
company number and let it ring out. The phone gets the in-hours line within a minute. The thread
shows the missed call and under it *The app texted back*. Needs a reply still holds the row and
Waiting on them does not start. Call again within three hours: no second text. Leave a voicemail on a
third call after three hours: the voicemail line. Turn Send texts off: nothing goes, and the card's
list says why. Nothing is pressed on a real customer.

## Where it stands

Picked 2026-10-26 and parked the same day. Nothing is built. The mock-up beside this file draws today
and B at phone width, made-up data only.
