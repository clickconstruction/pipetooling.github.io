---
name: "Walk kit — a session runs the Messages loop on prod end to end, on the company's own inbox and number, reads what landed where, and cleans up"
number: 142
group: close
status: DONE — PRs 0 to 8 merged and deployed 2026-10-22; the first full walk ran green on 2026-10-23 (`npm run walk -- --owner-presses --keep`): the estimate email and text on the owner's presses, the open from bids@, the email reply through the team box, the text reply with its ✓ delivered, STOP and START, the office's view, the stray check, and cleanup of every row; the one held step was the walk's own accounting of a press made before a restart; the four paper cuts that walk found in the driver fixed in v2.6030 (2026-10-28), the fixed driver's live walk still to run
summary: >
  Today the live walk of Messages needs the owner's press on every send, sample accounts cannot
  text, and the readers leave out (or make a Who is this? of) the company's own addresses and
  numbers. The kit makes a ZZ Walk customer whose email is the bids inbox and whose phone is the
  bids number, lets one hidden training-mode tester press the estimate's email and text at that
  customer alone, opens the link from the bids inbox, replies by email from bids@ to team@ and by
  text from the bids number to the company number, sends STOP and START, then reads the thread,
  the queues, Went out and the 7-day strip through the app's own code, prints what landed where
  with times, and deletes its rows. One command, run by any session.
next: run the fixed driver live once with the owner's word (`npm run walk -- --owner-presses --keep`, then `npm run walk -- --cleanup-only`); then a walk on a schedule
size: L as a train of nine (S M S+migration M M+migration M S L M); two migrations, one new edge function, eight functions changed, and about thirty redeployed once for the shared real-account rule
blocker: none — bids@ left the two test records on 2026-10-23 (their two empty `contact_channels` rows deleted over the pooler with the owner's word); the GC test company's `email` column still reads bids@, so a save of that record could re-make a channel
ver: v2.5724 to v2.5740, v2.6030 (punch list #142)
opinion: build — every Messages train so far has ended on a walk only the owner could press; this one ends on a walk any session can run in about ten minutes after any deploy, touching only the company's own inbox and number, with nothing left behind in the app.
mockup: not required — a test harness; the one screen change is a read-only line on the existing Digital twins & samples page, in its own row shape
---

# Walk kit (#142)

## The ask

The owner wants a Claude session to be able to test how the whole Messages loop looks end to end,
on prod, without the owner's presses. The brief (2026-10-21, from the session that runs the
Messages desk train, punch list #140): send only to addresses and numbers the company owns, read
the result, and clean up. Kernels first with unit tests, one small PR at a time, keys in Settings
or the vault, no terminal steps for the owner, migrations only by `supabase db push` after merge.

The owner answered the three questions this plan asked first, the same day:

1. **The test mailbox.** No new mailbox. The ZZ Walk customer's email is **bids@clickplumbing.com**.
   The kit reads bids@'s inbox through the existing delegation, opens the estimate link there,
   and replies from bids@ to team@.
2. **The test phone.** No third number. The ZZ Walk customer's phone is **the bids number,
   (737) 300-9478**. The kit texts from it to **the company number, (512) 994-2774** (the team
   box's), through Quo's API.
3. **The tester account.** Yes: a hidden tester account may press the sends, reaching only the
   kit's own address and number.

And the rule that makes 1 and 2 work with no doubled lines and no stray Who is this? rows, to be
built in both readers: **an address or number of our own (a box's address, the app's sender, a
company number) is taken as a person only when a contact already carries it; otherwise it is left
out, as today.** Decision 4 below narrows "a contact" to the kit's own contact, for a reason found
while planning; the walk reads the same either way.

## Why the walk needs the owner today

- **Prod sends are the owner's presses.** The desk train's live test is Route B
  (`to-dos/messages-desk/BUILD_PLAN.md` § 0.5 and § 3): a session sets up and reads, a human
  presses every Send.
- **No test account may send.** `quo-send` and `messages-email` look the caller up with
  `.match(REAL_ACCOUNT)` (`supabase/functions/_shared/realAccount.ts`: not a sample, not a twin),
  then refuse `read_only`, then ask `gc_office_team()`.
- **The readers drop our own side.** `gmail-sync` leaves out mail from the boxes' addresses and the
  app's sender (`src/lib/emailIn/leftOut.ts`, since v2.5722 those alone; a teammate's mail lands).
  `quo-webhook` places every number it is told about through `quo_place_number`, which makes a
  Who is this? contact for any number nobody carries, our own numbers included.

## The decisions

### 1. The test mailbox is bids@ (the owner's, settled)

bids@ is a Workspace user the service account already impersonates for `gmail-sync`
(`GMAIL_SCOPES` is `gmail.modify`, which covers `users.messages.send`; the delegation lists
`gmail.readonly` and `gmail.modify`, `docs/EDGE_FUNCTIONS.md` § gmail-sync). Nothing new in Google
Admin. The kit reads both addresses from Settings' boxes row (`app_settings` `messages_boxes_v1`),
never from its own code.

### 2. The test phone is the bids number (the owner's, settled)

Both numbers are in the same Quo workspace and in the boxes row, each with its Quo number id. The
kit texts with the vault's Quo key (`quo_secret_get` through `_shared/quoKey.ts`'s
`loadQuoApiKey`, else `QUO_API_KEY`). The one thing nobody knows yet: whether Quo delivers a text
between two numbers of one workspace. See *The one unknown*.

### 3. A hidden tester may press the sends, at the kit only (the owner's, settled)

The tester presses three doors: `send-estimate-to-customer` (the estimate email), `quo-send` (the
estimate text) and `messages-email` (a reply from the thread). Each door checks in code that the
target is the kit's: the kit's estimate, the kit's two channels, the kit's address. Anywhere else
the door refuses the tester with words. Decision 5 says what the account is.

### 4. The own-address rule, in both readers, for the kit's contact (the owner's rule, narrowed)

**The rule as built:** an address or number of our own is taken as a person only when **the kit's
contact** carries it; otherwise it is left out, as today. "Our own" is the two boxes' addresses,
the app's sender (`EMAIL_FROM`'s address), and the two boxes' numbers, all read from the boxes row
and the function's secrets.

**Why narrowed.** Read on prod 2026-10-21: no contact carries the team address, the app's sender,
the bids number or the company number, but **two contacts already carry bids@**: a test GC
company and a test commercial customer, both made 2026-10-12, with no lines, jobs, bids or
estimates. Somebody typed the company's own address onto two records, and that will happen again
on real ones. Under "any contact", a mail from bids@ to team@ would land on whichever record
`contact_for_channel` picks (newest line first, then the oldest channel: the test GC company). Under
"the kit's contact", the rule is dormant except while a walk is set up, and it can never misfile
real mail. Nothing outside the kit uses the wider reading. If the owner wants the wider reading
anyway, the kernel takes a set of carried keys instead of the kit's, and the two test records must
lose bids@ first.

**In code.** One pure kernel, `src/lib/walk/kit.ts` (mirrored to the edge): `parseWalkKit` reads
`app_settings` `walk_kit_v1` (the kit's ids, address and number, written by `walk_setup`), and
`kitCarries(kit, kind, value)` compares by the same keys `contact_channel_key` makes. A second,
`src/lib/messages/ownChannels.ts`, builds the own set from the boxes row and the secrets. The
readers then:

- **gmail-sync** (`loadTeam`): `isOurs` and `isTheBox` answer false for an own address the kit
  carries, so `leftOut` takes it and `emailParty` reads it as a person writing in. Placement goes
  through `email_place_address` as today, and a placement that is not the kit's contact is passed
  over and logged.
- **quo-webhook** (`handle`, `placeEvent`): before `placeNumber`, a number that is our own is placed
  only when the kit carries it. Otherwise a sent event skips that recipient and a received text or
  a call is ignored with its reason (`ignored: our own number, the kit does not carry it`).

### 5. The tester: a training-mode assistant with its own hiding flag (this plan's call)

- **The account.** `walk-tester@walk.pipetooling.local`, name *ZZ Walk tester*, role `assistant`
  (so `gc_office_team()` passes), `is_sample = false`, `is_digital_twin = false`, **`read_only =
  true`**, and a new flag **`users.is_walk_tester = true`**. No password: the kit signs it in with
  `dev-login`. No roster row (`people`), so no Our team thread.
- **Why training mode, not `read_only = false` as first asked.** Training mode's restrictive write
  blocks stop every write the account could make through the API. The kit's only writes are the
  three doors, which write as the service role after their own check. So "may press the sends,
  only at the kit" is true by construction, and the account's session, if it ever leaked, could
  write nothing. The kit's other rows (the customer, the draft estimate) are made by a definer RPC
  as the service role.
- **Why a new flag, not `is_sample`.** Samples are the View-as accounts, one per role, and the
  Sample accounts card and View as read them by role. A second assistant sample would confuse both.
- **Hidden everywhere a sample is.** The `roster_people` view's two rollups and `account_kind`
  (`tester`); `activeUsersQuery` and `isActiveRosterPerson`; the thirteen client files that filter
  `is_sample` by hand; and a restrictive SELECT policy on `users` that shows a tester's row only to
  itself and to devs, the floor under every picker. `REAL_ACCOUNT` gains `is_walk_tester: false`, so
  every recipient fan-out in the edge functions leaves the tester out, and the three kit doors
  accept it through their own check (decision 3). `rosterRulePin.test.ts` keeps `REAL_ACCOUNT`'s
  flags equal to `is_pay_roster`'s.
- **Shown to the owner.** Settings → System → Digital twins & samples gets one read-only line:
  *Walk tester · training mode · its last walk*. A hidden account with send rights is never
  invisible to the owner.

### 6. The kit is quiet to people (this plan's call)

A reply on ZZ Walk would otherwise push the whole office, the assign rule could hand the thread
to a real person, and the 9 AM morning run could nudge it. While `walk_kit_v1` names a contact,
`notifyPlan` sends that contact's pushes to the devs alone, the assign rule leaves it unassigned,
and `messages-nudge-dispatch` skips it. The office still sees *ZZ Walk Messages Desk* in Needs a
reply for the few minutes of a walk. ZZ is the house mark for a test record, and cleanup removes it.

### 7. The report reads through the app's own code (this plan's call)

The driver signs in as the tester and calls the same io modules and kernels the screens use
(`supabaseFollowUpIo`, `loadWaitingOnThem`, `wentOutIo`, `loadWeekStrip`, then `needsReply`,
`newLane`, `waitingOnThem`, `wentOutRows` and the strip's tiles), so the report says what the
office sees, through RLS, not what a hand-written query guesses. The strip is read twice, with and
without the kit's lines, and the report prints the kit's difference. For a session's own
cross-check, BUILD_PLAN § 5 has the read-only SQL for the Supabase connector (`execute_sql`) and
the log reads (`query_logs`). psql over the pooler is refused by the permission classifier in a
Claude session; the connector is not.

## The walk, step by step

What each reader sees and where each step lands. "Ours, kit carries it" means the address or number
is our own and the kit's contact carries it; "ours, nobody" means it is our own and the kit does not.

| # | The kit does | bids@ reader | team@ reader | quo-webhook | Lands on ZZ Walk's thread |
|---|---|---|---|---|---|
| 1 | Sets up: the tester (made once, kept), ZZ Walk with bids@ and the bids number, a draft estimate | — | — | — | the kit's rows, `walk_kit_v1` |
| 2 | The tester sends the estimate email (`send-estimate-to-customer`), from the app's sender to bids@ | from the app's sender, ours, nobody: **left out**, no label | never sees it | — | the email's sent copy (the thread's sent-copies overlay); Went out's email row |
| 3 | The tester sends the estimate text (`quo-send`), from the company number to the bids number | — | — | `message.delivered` on the company number, to the bids number: ours, kit carries it, **merged** on the out line. Its mirror, `message.received` on the bids number from the company number: ours, nobody, **ignored** | one out text, ✓ delivered |
| 4 | Finds the email in bids@ and opens its link with a browser's user agent (`get-estimate-for-customer`) | — | — | — | 👀 *ZZ opened estimate #N*; Went out's email reads opened; the strip's Estimates opened +1 |
| 5 | Replies from bids@ to team@, *Can you do it Thursday?*, in the email's thread | sits in bids@'s Sent; the reader reads the Inbox only: **never sees it** | from bids@, ours, kit carries it: **taken**, a line in, box team | — | one email in; ZZ Walk in Needs a reply |
| 6 | Texts from the bids number to the company number, *Thursday works* | — | — | `message.received` on the company number from the bids number: ours, kit carries it, **a line in**. Its mirror, the sent event on the bids number to the company number: ours, nobody, **skipped** | one text in, box team |
| 7 | Texts STOP, then START | — | — | each lands as 6 does; the team box's stop on ZZ Walk's number is set, then cleared | the opt-out event lines; Nudge falls to email while stopped |
| 8 | Optional: the tester answers from the thread by email (`messages-email`) to bids@ | from the app's sender, ours, nobody: **left out** | — | — | one email out, and no second line |
| 9 | Reads, prints the report, cleans up | — | — | — | nothing left |

No step makes a contact. The report's stray check proves it: no contact made during the run
carries an own address or number.

## The one unknown

Whether Quo delivers a text between two numbers of one workspace. The first answer comes cheaply,
before the kit exists: once PR 1 is deployed, the owner texts *walk check* in Quo's app from the
bids number to the company number. A session reads `quo-webhook`'s log lines for that minute
(`query_logs`): a `message.received` on the company number, ignored as *our own number, the kit
does not carry it*, means Quo delivers, and SQL shows no contact made. No event means it does not.
Then the text leg falls back to the owner's cell for that step (BUILD_PLAN § 4): ZZ Walk's phone
is the owner's own, the estimate text goes there, and the owner texts *Thursday works* back. That
one reply is the owner's press. Whether Quo applies STOP between its own numbers is part of the
same unknown. The report says what Quo did.

## Found while planning

1. **Two test records carry bids@** (decision 4). Any email the app sends that test GC company goes
   to our own bids@ box. `walk_setup` refuses while they do. The app has no press that removes a
   contact's address: retyping the record's email leaves the channel. BUILD_PLAN § 0.4 has the fix.
2. **dev-login reads one page of 50 accounts**, and prod holds exactly 50 auth users today
   (`auth.admin.listUsers()` with no page, then `.find`). The 51st account, the kit's tester or a
   new hire, can push any account past the page, the owner's dev-login identity included, and
   every session's sign-in then answers *User not found*. PR 0 fixes it first.
3. **The estimate email's Reply-To is the sender's own address**
   (`supabase/functions/_shared/estimateEmailLetterhead.ts`, `replyTo: sender?.email`), not the team
   box as `messages-email`'s has been since R6. A customer who answers an estimate email reaches the
   sender's own inbox and never Messages. The kit replies To team@ and its report says so. A small
   follow-up, the owner's call: the estimate email answers to the team box, after which the kit
   replies to Reply-To as a customer does.
4. **`send-estimate-to-customer` checks no real account.** A View-as sample, a twin or a training
   account that can read a draft could send it to a real customer. PR 5 adds the check beside the
   tester's.
5. **Deleting a customer keeps its contact** as an unknown that keeps its channels
   (`contacts_keep_thread` on `customers`, `20261014020000_contact_for_customer.sql`). Cleanup that
   deleted ZZ Walk's customer first would leave a stray contact carrying bids@ and the bids number.
   `walk_cleanup` deletes the contact first.
6. **The new-user trigger makes a plain helper row** (`handle_new_user`): the kit sets the role and
   the flags in the same call, as `create-user` does.
7. **The bids number was "the company number"** until the boxes row gave each box its own
   (`docs/MESSAGES_SWITCH_ON_HANDOFF_2026-10-14.md`). `QUO_PHONE_NUMBER_ID`, the team box's
   fallback, may still name it. `walk_setup` refuses when the two boxes' numbers are the same, so
   the kit never texts itself from one number.

## Is this the best we can do?

1. **It tests the office's code, not a copy.** The sends go through the app's own doors with a
   real session, and the report runs the screens' own io and kernels. The edge function holds only
   what needs a server secret: making the tester, Gmail as bids@, Quo as the bids number, cleanup.
2. **The rule cannot misfile real mail.** It is dormant except while a walk is set up, and it acts
   only for the kit's contact.
3. **The tester can write nothing but three sends.** Training mode is the fence, and each door
   checks the target.
4. **Do what is ready.** Each wait ends with what it saw. A step that fails does not stop the ones
   that do not need it, the report names what held and why, and cleanup always runs.
5. **Cut.** No Settings card for the kit, no stored session, no report table, no push to the
   office, no Gmail cleanup.

## Not carried

- **Log a call, Answer all, Take it on, Nudge, Book a visit** as the tester: they write through
  RPCs that refuse a training account. Each can be fenced like the sends, one PR each, when a walk
  needs it.
- **A walk on a schedule** (nightly, or after each deploy): after the first runs are green.
- **Deleting the kit's mail in Gmail or texts in Quo**: the reader's rule is that nothing in Gmail
  is deleted, and Quo keeps its history.
- **The estimate email's Reply-To** (found item 3): its own PR, the owner's call.
- **Calls between the two numbers**, files on a reply, and the bids box read from outside (already
  proven live).
