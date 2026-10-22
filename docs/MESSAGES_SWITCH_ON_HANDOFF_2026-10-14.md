# Hand-off: switching Messages on (Quo), 2026-10-14

last_updated: 2026-10-21

*Written 2026-10-14, about 4 PM CT, by the residential lead ("cc") as the owner hands the switch-on to another session.
The build itself is closed: `MESSAGES_RESIDENTIAL_BUILD_PLAN.md` (its Status, §7 for the owner's calls, §9 for after live)
and `MESSAGES_BUILD_PLAN.md` for the GC side. The system map is `MESSAGES_ARCHITECTURE.md`. This page is only where the
switch-on stands and what comes next.*

## Where it stands

- **Built and tested.** Every PR of both builds is on main and deployed (#5722 landed as 89833d82c; below). The live test of the
  morning of 2026-10-14 is in the residential plan's Status.
- **Quo is live for texts in.** Carrier registration cleared on 2026-10-14. The Caller ID name "Click Plumbing" is approved
  and on the company number, (737) 300-9478. `QUO_COMPANY_NAME` is "Click Plumbing and Electrical", the name that signs
  the HELP answer and the opt-out line. The owner's test text "Test 2" landed at 20:46 UTC as an unknown contact in
  Follow up's New lane, in the team box, with Quo's id on the line.
- **Every switch is still off** (read on prod at about 20:50 UTC): Send texts, Reply push, Read bids@ and every per-step
  reminder. Company phone seats are empty, Inboxes are empty (one number serves both boxes until a box names one), and
  Who gets a new message is "Nobody" for every kind, so new messages wait in New. The morning run fires at 14:00 and
  15:00 UTC and sends nothing.

## What comes next, in order

Each step is the owner's or a dev's press. The order was checked by the GC lead on 2026-10-14. Since v2.5712 (punch list #140 PR 2) the owner reads the same eight switches on Messages itself: the **Finish switching Messages on** line at the top of `/messages` lists each with its state and a door to its card, and goes away once all eight are on; that card is where the switch-on stands from now on.

1. **Name the test number.** Messages → New → its row → Who is this? → Someone else, with the owner's own name. That
   thread is the test bed for everything below.
2. **Company phone seats** (Settings → Phone and texts): one Quo user id per person who answers, or the one login the office shares marked **Shared by the office** (v2.5548). A text then goes out
   carrying the sender's seat, and a call names whose seat rang. The guide is `match-each-company-phone-seat-to-a-person`.
3. **Send texts → Turn it on** (Settings → Phone and texts). From that moment anyone in the office can text any contact
   from a thread or a job's window, and a primary or helper can text a job's customer from Job Mode. The guide is
   `turn-on-texts-from-the-company-number`.
4. **The outbound proof, only to the owner's own thread.** Reply with the Text kind. The first text carries "Click
   Plumbing and Electrical. Reply STOP to opt out." It shows on the thread at once, and Quo's delivered event lands on
   the same line, so there is one line, not two, its time reading **✓ delivered** since v2.5703. Then from the owner's phone: STOP (the app answers and a reply from the
   thread is refused), START, HELP (the answer names the company). Then one picture texted in should show on its line
   within five minutes with the photo tick.
5. **Reply push** when the owner wants pushes, **Office hours** (after Reply push, v2.5709, a 24/7 switch since v2.5721: the days and the open and close the reply push and the tech's texting read, or open around the clock; the switch card's eighth row) and **Who gets a new message** when new numbers should go to someone.
6. **Later:** Inboxes with the second Quo number for the bids box; Read bids@, which needs the Google domain-wide
   delegation grant first; counsel's word on whether a STOP to one number silences the other (§7 of the residential plan).
7. **Per-step reminders stay off** until the dry run is read: `POST /functions/v1/messages-nudge-dispatch` with
   `X-Cron-Secret` and `{"dry": true}`; the card's door for the reminders is `#settings-phone-texts-reminders` since v2.5720, the **Reminders the app offers** card last on Phone and texts, and the dry run shows v2.5714's Approved and Paid lines. A customer step also waits on the portal grants follow-up; the run's summary says
   "Customers wait until the run can read their page" until then.

Test texts go only to the owner's own phone or to the GC side's "Test contact", never to a real contact's thread.

## Quo: what cost an hour on 2026-10-14

- **The live webhook is Quo id 43696**, "PipeTooling messages", made through Quo's API on 2026-10-12 (GC cut 5). It has
  API version 2026-03-30, every number, and the ten events `quo-webhook` reads. **Quo's Settings → Webhooks page does not
  list API-made webhooks**, so that page reads "Add your first webhook" while 43696 delivers. List them in a terminal:
  `curl -s https://api.quo.com/webhooks -H "Authorization: $QUO_KEY" -H "Quo-Api-Version: 2026-03-30"` (no secrets in
  the output).
- **The key itself lives in Settings since v2.5718**: Settings → Phone and texts → **Quo connection** keeps Quo's API key in
  Vault, and `quo-send`, `quo-webhook` and `quo-config` read it from there before `QUO_API_KEY`. The recipes below that
  read `$QUO_KEY` from the terminal are for the webhook alone, which the card does not yet manage.
- **Do not make a webhook on Quo's settings page.** It signs the older OpenPhone way and sends v3 events, which the
  reader answers and sets aside (`ignored: API version v3, not 2026-03-30`). One was made by mistake on 2026-10-14 and
  deleted the same evening.
- **The webhook's key is `QUO_WEBHOOK_SECRET`**, and Quo never shows it again. To reset it, the owner rotates it straight
  into the secret from his own terminal, his Quo API key read silently first (`read -s "QUO_KEY?Quo API key: "`; it needs
  a real terminal, since Claude Code's `!` runner has no keyboard input):
  `NEW=$(curl -s -X POST "https://api.quo.com/webhooks/43696/rotate" -H "Authorization: $QUO_KEY" -H "Quo-Api-Version: 2026-03-30" | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["key"])') && [[ $NEW == whsec_* ]] && supabase secrets set QUO_WEBHOOK_SECRET="$NEW" --project-ref yewfzhbofbbyvkvtaatw && echo set; unset NEW`
- **A text that does not land:** the Supabase dashboard → Edge Functions → `quo-webhook` → Logs shows
  `[quo-webhook] refused: <why>`. `bad signature` is a wrong key (rotate it as above); `missing headers` is a delivery
  signed the older way. A hand-pasted key can carry a stray character: compare `supabase secrets list`'s digest with a
  SHA-256 of the intended value rather than reading the value.
- **Watch-outs once texts are on:** a 402 from Quo (prepaid balance) pauses texts until it is topped up and the next send
  clears it; a STOP holds per pair of numbers, so a second number has its own; texts sent from Quo's own phone app land
  as lines too; the first text to a number is longer by the opt-out line.

## Open at hand-off

- **#5722** (v2.5536), the older signature scheme in `verifySignature`: merged (89833d82c). `quo-webhook` had been
  deployed from its branch at 20:37 UTC to test it; `npm run check:edge-drift` read every function current on 2026-10-21.
- The owner's open calls are the residential plan's §7, and what waits until after live is its §9.
