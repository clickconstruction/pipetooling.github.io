# The walk kit

> One command, `npm run walk`, runs the Messages loop on prod end to end, on the company's own inbox and number, prints what landed where with times, and cleans up after itself. Punch list #142 (v2.5724 to v2.5740; the first walks' paper cuts fixed in v2.6030). The decisions behind it were made in `to-dos/walk-kit/` and are kept here once that folder is gone.

last_updated: 2026-10-28

## What it is

Every Messages train so far ended on a live walk that only the owner could press: a send goes out, a reply comes back by email and by text, and someone reads the thread, the lanes and the strip. The walk kit lets any Claude session do that in about ten minutes after any deploy, touching only the company's own inbox and number, and leaving nothing behind in the app.

The loop it walks (`to-dos/walk-kit/README.md`'s step table, now this page):

1. **The kit**: a customer *ZZ Walk Messages Desk* whose email is the bids box's address and whose phone is the bids number, its contact with the two channels, a draft estimate of $1.00, and the row `app_settings.walk_kit_v1` that names them (`walk_setup`, `20261022045047_walk_kit.sql`).
2. **The tester** presses the estimate email and the estimate text through the app's own doors (`send-estimate-to-customer`, `quo-send`): a hidden training-mode assistant, `walk-tester@walk.pipetooling.local`, flagged `users.is_walk_tester`, let through only at the kit's own targets (`src/lib/walk/kitDoor.ts`). It can write nothing else.
3. **The open**: the `walk` function reads bids@'s inbox as the service account, finds the estimate email, and opens its link with a browser's user agent, so the thread gets the 👀 line.
4. **The email reply**: from bids@ to the team box, in the estimate email's thread; `gmail-sync` lands it on the kit's thread within a minute.
5. **The text reply**: from the bids number to the company number through Quo; `quo-webhook` lands it, and the estimate text's ✓ delivered with it.
6. **STOP, then START**: the team box's stop on the kit's number is set, then cleared.
7. **The office's view**, read through the screens' own kernels as the tester: Needs a reply and New, Waiting on them, Went out, and the 7-day strip read twice, with and without the kit's lines, printed as the kit's difference.
8. **The stray check**: no contact made during the run carries an address or number of our own.
9. **Cleanup**: `walk_cleanup` deletes the kit's rows and nothing else, and refuses rather than cascading when anything unexpected points at them.

While the kit stands, the readers' rule holds (v2.5726): an address or number of our own is taken as a person only when the kit's contact carries it, so a text between two of our own numbers never makes a *Who is this?* row. The kit is quiet to people (v2.5728): a line on its thread pushes the devs alone, the assign rule leaves it unassigned, and the morning run skips it.

## How to run it

From any checkout that has the main checkout's `.env` and `.env.local` beside it (a worktree resolves there on its own):

```bash
npm run walk
```

It reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_DEV_LOGIN_SECRET` from the main checkout's `.env` with `.env.local` laid over it (`src/lib/walk/walkEnv.ts`), prints none of them, and a key still missing names itself and the files read. The tester's session lives in memory only. Every wait polls every 15 seconds, tries a poll that failed (a lost signal) again on the next, and ends after its limit (three minutes for the mail and text legs) with what it saw, the last failed poll included. A step that holds does not stop the steps that do not need it. Cleanup always runs at the end, unless you keep the rows.

The flags:

| Flag | What it does |
|---|---|
| `--keep` | Leaves the kit's rows for a look. Remove them later with `--cleanup-only`. |
| `--owner-presses` | The owner presses the two sends (below). The walk sets up, waits for them, then does the rest as the dev login identity. |
| `--fallback-phone` | The kit's phone is the owner's own number. The owner texts the replies, STOP and START from that phone. |
| `--answer` | At the end the tester answers from the thread by email, and the walk checks one line went out and no second. |
| `--cleanup-only` | Only `walk cleanup`, for a kit a stopped run left behind. |

The report is printed and written to `tmp/walk/<stamp>.json` (ignored by git): one row per step with sent at, landed at, where (the line, its box, the lane) and whether it went or why it held; then the lanes, Went out, the strip's difference, the stray check, Quo's answers and cleanup's counts. Nothing printed carries a key, a token or a whole link: a link shows as its last four characters.

## What it touches, and what stays

**Touched**: bids@'s inbox (the estimate email arrives there, unlabelled) and its Sent folder (the reply), the team inbox (the reply arrives there with the label *In ClickTooling*), the bids number and the company number in Quo (the texts stay in Quo's history), `email_send_log` and Resend's log (the record of real sends), and the edge logs.

**Made and removed**: the customer, its contact and two channels, the draft estimate, every line on the kit's thread and the rows that hang off them, the estimate's customer events, the sent copies, and `walk_kit_v1`. Cleanup refuses and deletes nothing when another contact carries the kit's email or phone, a line came in on a channel that is not the kit's (a real person folded in through Who is this?), a file was kept on the thread, a job is on the kit's customer, or any other table points at the kit's rows.

**Kept**: the tester account, for the next walk. Its line on Settings → System → Digital twins & samples says when it last walked.

## Before the first walk

- **bids@ off every other record.** `walk_setup` refuses while any contact but the kit's carries the kit's address or number, or the side that sends to it (the team box's address and number, the app's sender). On 2026-10-21 two test records carried bids@; the owner retypes each record's email in the app, and a session deletes the two leftover `contact_channels` rows through the Supabase connector (the query is below). Done 2026-10-23: the two empty channel rows went over the pooler with the owner's word and `walk_setup` passed; the GC test company's `email` column still reads bids@, so a save of that record could re-make a channel.
- **Quo between two of its own numbers.** The one unknown the first run answers: whether Quo delivers a text from the bids number to the company number. If step 5 times out with no inbound line, run the walk again with `--fallback-phone`. Answered 2026-10-23: it does; the reply from the bids number landed on the kit's thread in one second.

## The walk with the owner's presses

When the tester is not deployed yet, or a door refuses it: `npm run walk -- --owner-presses`. The script makes the kit with the owner as the estimate's maker, prints what to press and waits up to fifteen minutes:

1. **The owner** opens the customer *ZZ Walk Messages Desk*, opens its draft estimate, presses **Send**, and in the **Tell the customer** sheet presses **Send both**.
2. The script sees the estimate turn sent and the text line appear, and does the rest: the open, the email reply, the text reply, STOP and START, the read and cleanup.

With `--fallback-phone` the script asks the owner to text *Thursday works*, then *STOP*, then *START* from their own phone to the company number, and waits for each.

## Reading it yourself

The report's SQL, read-only, through the Supabase connector's `execute_sql` (psql over the pooler is refused in a Claude session). Take the ids from the first query.

```sql
-- The kit
select value_text from public.app_settings where key = 'walk_kit_v1';

-- ZZ Walk's thread, in order
select at, channel, direction, mailbox, delivery, who_text, left(body, 60) as words
from public.messages where contact_id = '<contactId>' order by at, id;

-- The opt-out marks on the kit's number
select opted_out_at, opted_out_by_box from public.contact_channels where id = '<phoneChannelId>';

-- The estimate and what the customer did
select status, sent_at from public.estimates where id = '<estimateId>';
select event_type, occurred_at, user_agent from public.estimate_customer_events
where estimate_id = '<estimateId>' order by occurred_at;

-- The stray check: contacts made since the run began that carry an own address or number
select c.id, c.kind, ch.kind, ch.created_at
from public.contacts c join public.contact_channels ch on ch.contact_id = c.id
where c.created_at >= '<run start>' and c.id <> '<contactId>'
  and ch.key in (
    public.contact_channel_key('email', 'team@clickplumbing.com'),
    public.contact_channel_key('email', 'bids@clickplumbing.com'),
    public.contact_channel_key('email', 'team@noreply.clicktooling.com'),
    public.contact_channel_key('phone', '+15129942774'),
    public.contact_channel_key('phone', '+17373009478'));

-- The readers' health
select mailbox, last_run_at, last_ok_at, last_error, last_taken from public.gmail_sync_state;

-- Before the first walk: the records that still carry bids@
select ch.id, ch.contact_id, c.kind, c.created_at::date,
  (select count(*) from public.messages m where m.channel_id = ch.id) as lines
from public.contact_channels ch join public.contacts c on c.id = ch.contact_id
where ch.kind = 'email' and ch.key = public.contact_channel_key('email', 'bids@clickplumbing.com');
```

With `query_logs`, over the run's window: `quo-webhook`'s and `gmail-sync`'s lines in the `function_edge_logs` source. The *ignored: our own number* lines are the mirrors of the two text legs.

## Where the pieces are

| Piece | Where |
|---|---|
| The driver and its io | `scripts/walk/run.ts` (`runWalk`), tested by `src/lib/walk/walkDriver.run.test.ts` |
| The walk's pure half: flags, steps, waits, the report, the scrub | `src/lib/walk/walkRun.ts` |
| The kit's row and the readers' rule | `src/lib/walk/kit.ts`, `src/lib/messages/ownChannels.ts` |
| The tester's doors | `src/lib/walk/kitDoor.ts`; `quo-send`, `messages-email`, `send-estimate-to-customer` |
| The server half | `supabase/functions/walk` (`EDGE_FUNCTIONS.md` § walk), `src/lib/walk/walkFunction.ts` |
| The kit's rows | `walk_setup`, `walk_cleanup` (`docs/migrations/20261022045047_walk_kit.md`); the bed `npm run test:pg:walk-kit` |
| The tester's flag | `docs/migrations/20261022044606_users_is_walk_tester.md`, `ACCESS_CONTROL.md` § The walk tester |
| Quiet to people | `src/lib/messages/notifyPlan.ts`, `src/lib/followUp/assignSeats.ts`, `src/lib/flows/nudgeRunInputs.ts` |

## Found on the first walks (2026-10-23)

The first green run went on the owner's presses (`--owner-presses --keep`), then the owner's own Chrome walked Take it, Answer all, Log a call and Nudge on the kit's thread before `--cleanup-only` removed every row. Four paper cuts in the driver, none in the app, all four fixed in v2.6030 (the fixed driver's live walk is still to run):

1. **The keys.** `scripts/walk/run.ts` read the main checkout's `.env.local` alone and needed all three keys there, while that checkout kept `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`; the two lines were copied into `.env.local` by hand. Fixed in v2.6030: the driver reads `.env` and lays `.env.local` over it (`src/lib/walk/walkEnv.ts`), and a key still missing names itself and the files read.
2. **A failed fetch ends the run.** A transient `TypeError: fetch failed` inside a wait (polling the estimate for the owner's press) aborted the whole run with exit 1 instead of being retried on the next poll, with the kit kept. Fixed in v2.6030: `waitUntil` tries a poll that threw again on the next poll within the wait's own limit, prints each failure as it happens, and a wait that never succeeds holds its step with the last error in what it saw.
3. **A press before the restart is not seen.** After that abort, the owner's sends went before the walk was restarted; `Send the estimate text` then held for three minutes looking for a text newer than the run's start, and the text reply read *no estimate text to mark*. Fixed in v2.6030: the wait opens at the kit's `madeAt` (`pressWindowStart`), so a press made before a restart on a kept kit is read at once, and never the seed.
4. **One seed per run.** Each restart seeded another *older text of ours* on a kept kit. Fixed in v2.6030: the driver reads the thread first and reports a seed already there (`seedLine`) instead of making a second; one seed per kit.

Also seen: a kit whose newest line is theirs sits in New or Needs a reply, never in Waiting on them, so Nudge cannot be walked without backdating the kit's own lines (three days, by SQL with the owner's word); and in auto mode the Claude app's classifier refuses that prod write, so Ask mode or the owner's own SQL editor is the door.

## Not carried

Log a call, Answer all, Take it on, Nudge and Book a visit as the tester (each writes through an RPC that refuses a training account; each can be fenced like the sends when a walk needs it); a walk on a schedule; deleting the kit's mail in Gmail or its texts in Quo; the estimate email's Reply-To, which is still the sender's own address rather than the team box (the owner's call); calls between the two numbers; files on a reply.
