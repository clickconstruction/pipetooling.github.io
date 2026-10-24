---
name: "Call through Quo: the Call buttons open the Quo app on the company number"
number: 152
group: gated
status: built 2026-10-23 (v2.5803) on the owner's yes with one change, the person picks at the press · left: the try on a real phone with Quo
summary: >
  Every Call button on Messages was a tel: link, so on a phone the call went out from the
  person's own number and Quo never saw it. Quo has a link that opens its phone app on a
  number and dials from the company number, and one way for a desk: set Quo as the computer's
  default calling app once. Quo's API cannot place a call for a person. Built: on a phone, a
  seat holder's first press of Call asks, Call in Quo or Call from my phone, the pick is kept
  on that phone with a ▾ beside the button to change it, the plain dialer stays where there
  is no seat, and the desk's one-time words sit a ▾ away. The thread gets the call from Quo on
  its own, as it already did.
next: The try on a real phone with Quo, as the dev with his own seat; then watch Quo's changelog for an API door.
size: S
blocker: One real phone with Quo on it for the try.
ver: v2.5803
opinion: the link on phones with the choice at the press, the desk words beside it; the API door does not exist, so say so and watch Quo's changelog.
---

# Call through Quo (#152)

## The ask, in the owner's words (2026-10-23)

> When a user clicks on 'call' it calls from their personal phone, I think we should build in
> the function to make it easy to call through the QUO app. Would you be able to help me come
> up with this?

His screenshot is `/messages`: the green **📞 Call** on a We owe them row (*Call Robert to
follow up · added by Wendi*, beside I called · Tomorrow · Skip) and the blue **☎ Call** on
each Waiting on them row, beside Nudge.

## Today

Every Call in the app is a `tel:` link. The phone or the computer decides what opens it.

| Where | What it draws | The link |
|---|---|---|
| We owe them, a call task | **📞 Call** (green) | `telHrefFor` in `followUp/FollowUpSections.tsx` (`CallRowView`) |
| Waiting on them, each row | **☎ Call**, or **☎ Call them** on a failed text | `waitingOnThem.ts` `tel`, drawn by `messages/WaitingOnThem.tsx` |
| The thread's header | **☎** by the name | `gc/messages/ThreadWindow.tsx` line 281; the number links under the arrow, line 372 |
| The reply box's Call kind | **☎ Call (512) 555-0187** above the box | `messages/callLog.ts` `dialHref` |
| The Pipeline's customer door | **Call** | `messages/customerDoor.ts`, `jobs/JobCustomerSheet.tsx` |
| The Tell the customer receipt | the phone glyph | `customers/TellCustomerSheet.tsx` |

On a phone the link opens the phone's own dialer. The call goes out from the person's personal
number. Quo never sees it, so the thread gets no line, the call task stays open, and the office
presses **I called** or logs the call by hand in the reply box.

On a desk the link opens whatever the computer has for calls. A Mac opens FaceTime. Many PCs
open nothing. Quo takes the link only when the person has set Quo as the default calling app,
once, on that computer. The guide *call a customer from a task* says *On a desk, Quo places
the call*. That is true only after that setting, so the PR fixes the guide's words.

## What Quo offers (read on 2026-10-23)

Quo's own pages, read for this proposal: the deep-linking guide, the click-to-call guide, the
making-calls guide, the HubSpot guide, the API changelog and the API introduction.

**1. A link that opens the Quo phone app on a number.** Certain from the docs.

```
openphone://dial?number=%2B15125550187&from=%2B15125550144&action=call
```

- `number` is required, URL-encoded, so `+` is `%2B`.
- `from` is the Quo number the call shows as. With it, Quo asks nothing. Without it, a person
  with several numbers may be asked which one.
- `action=call` dials at once. Without it, Quo opens with the number filled and the person
  presses Call in Quo.
- The app installed: Quo opens. Not installed: Quo says the person is sent to the App Store or
  Google Play. From a web page that part must be tried.
- **Phones only.** Quo's page says web and desktop applications are not supported.
- The scheme is still `openphone://`, the old name. Quo has not published a `quo://` one.

**2. The desk: Quo as the computer's default calling app.** Certain from the docs. There is no
link for a desk. Quo's way is a one-time setting, after which any `tel:` link, ours included,
opens the Quo desktop app with the number filled, and the person presses Call there.

- Mac: FaceTime › Settings › *Default for calls* › Quo. A popup then asks *dial with Quo?* on
  each press.
- Windows: Settings › Default apps › *Choose default apps by protocol* › TEL › Quo.
- Android: Settings › Apps › Quo › *Calling app*. Quo says this works on Android 12 and lower.
- iPhone has no such setting. The link above is the only Quo door on an iPhone.
- The Quo desktop app must be installed. A browser alone cannot take the link. HubSpot's
  click-to-call into Quo works this same way.

**3. The API cannot place a call for a person.** Certain from the docs. Quo's API reads calls
(`GET /calls`, one call, its recording, transcript and summary) and tells us about them through
webhooks (`call.ringing`, `call.answered`, `call.completed`, `call.missed`, the voicemail, the
recording, the transcript, the summary). No endpoint rings a person's seat and then the
customer. The one *start a call* in the changelog (2026-10-19, beta) is `start-agent-call` for
Sona, Quo's AI agent: the robot makes the call, not the person, at 50 automation credits a
call. That is not what the owner asked for.

**4. No browser extension.** Quo publishes none. The click-to-call page names the desktop app
and the Android app only.

**5. What the app already does with a Quo call.** Certain from our code. `quo-webhook` takes
`call.completed` with the direction and the seat's Quo user id. `events.ts` writes the line as
*Rosa called · from the company number* with the length, and merges the recording, the
transcript and the summary as they come. On an answered call the function closes the person's
open call tasks (`call_tasks_close_by_call`, `quo-webhook/index.ts` line 194). The trigger
`messages_move_state` reads any line of ours as a reply, so the call clears Needs a reply and
starts the Waiting on them count. So the moment a call is made from Quo on the company number,
the thread has it, with nothing new on the server.

**6. Cost.** A Quo seat per caller. Quo lists Starter at $19, Business at $33 and Scale at $47
a user a month, less billed yearly. The people already on the Company phone seats card cost
nothing more. The link costs nothing. The webhook costs nothing. No API call is made, so no API
limit is touched.

## Options

### 1. Call opens the Quo app on a phone; the plain dialer where there is no seat. Recommended.

**What the office presses.** The same buttons. When the press will go through Quo the button
reads **Call in Quo**, so it says what it does. Otherwise it reads **Call** as today.

**On a phone.** The signed-in person has a seat on the Company phone seats card. Call opens
Quo on the number, with `from` set to the number the thread texts from (the company number for
a customer, the bids number for a GC once it has one), so the customer sees the number they
know. With `action=call` Quo dials at once. Without the app, Quo's page says the store opens.

**On a desk.** Call stays a `tel:` link. Quo takes it once the person has set Quo as the
default for calls. The card in Settings holds those steps in plain words, for a Mac and for
Windows. Nothing else to build for a desk.

**The switch.** One card on Settings → Your account, *Calls from this phone*: **Through Quo**
or **This phone's own dialer**. It is kept per browser, the way Show Mine · Everyone is, since
what it says is whether this phone has the Quo app. Default: Through Quo when the person has a
seat, the dialer when not. A person with a seat but no Quo on that phone flips it once.

**No seat.** The buttons read **Call** and open the phone's own dialer, as today.

**What Quo needs.** Each caller signed in to the Quo app on their phone with their own seat.
Nothing on the server. No new key. No migration.

**Certain:** the link's shape, its parameters, phones only, the store when the app is missing.
**To try on a real phone:** whether Safari asks *Open in Quo?* on each press, whether `from`
takes the company number with no question, what a phone without Quo shows when the link comes
from our page, and that the webhook's line names the right person and the right number.

### 2. The app asks Quo to place the call

Not possible today. Quo's API has no door that rings a person's seat and then the customer.
The only call Quo's API can start is Sona's, its AI agent, and that is the robot calling.

If Quo adds one, it is one edge function on the shape of `quo-send`, call it `quo-call`: the
caller's seat, the box's number, the customer's number, and the press becomes a server call
that works on every device, with the line landing by the webhook as now. Size then: S. Until
then there is nothing to build, and this to-do's *What Quo offers* is where the watch lives.

### 3. Both: Quo's app where it is installed, the API where it is not

With no API door, this is option 1 plus the desk's one-time setting. That is the recommended
shape already.

### Side by side

| | 1. The link on phones, the desk setting | 2. The API | 3. Both |
|---|---|---|---|
| On an iPhone or Android with Quo | Quo dials from the company number | not possible | as 1 |
| On a phone without Quo | the phone's own dialer, as today | not possible | as 1 |
| On a Mac or PC with Quo | Quo, after the one-time setting | not possible | as 1 |
| The call lands in the thread | yes, through the webhook, as today | would | as 1 |
| What it needs | a seat per caller, the Quo app on their phone | a door Quo does not have | as 1 |
| Size | S, one PR | nothing to build | as 1 |

### Is this the best we can do? Are we being straightforward?

- The best for a phone: yes. One press, Quo, the company number, the line in the thread with
  Quo's recording and summary, the task closed. Quo's own link does the work.
- The best for a desk: the limit is Quo's. A web page cannot start a call in the Quo desktop
  app. Every vendor's click-to-call on a desk, HubSpot's included, goes through the default
  calling app setting. The app can only say the steps plainly, once, where the person looks.
- Straightforward: the API option is the one the owner may expect, and it does not exist. This
  to-do says so instead of drawing it. The guide's *On a desk, Quo places the call* overstates
  today, and the PR corrects it.
- Not built, by design: a hidden timer that fires the Quo link and falls back to `tel:` when
  the page is still showing after a second. It is the common trick for a link to an app that
  may not be there, but it misdials from the personal number on a slow phone, and the switch
  per phone answers the same question with no guess.

## What changes when Quo sees the call

- **I called** stays on the row, for a call made off Quo, from a desk with no Quo, or from a
  landline. After a **Call in Quo** press the row shows a quiet line, *Quo logs this call*,
  and the task closes by itself when the answered call lands, within a minute of hanging up.
  A call nobody answered leaves the task open. They are still owed the call.
- **The thread's call line** is Quo's: *Rosa called · 3:40 · from the company number*, with
  ▶ the recording, the transcript and the summary when Quo's plan has them. It clears Needs a
  reply and starts Waiting on them, as the logged call does today.
- **The day they gave** is not in Quo's line. Quo's summary lists next steps but writes no
  promise. The office still writes the day with the reply box's Call kind, as now. A small
  later cut: the quiet line *Write down their word* under our Quo call line too (v2.5649 puts
  it under the customer's lines only).
- **Later, not now:** take `call.ringing` and `call.answered` so the row reads *Ringing…* and
  *On the call* live. The webhook reads those events as nothing to do today.

## Decisions for the owner

The owner's yes, 2026-10-23, with one change, in his words: *"I think the only thing that we
could change in this offering is the user can choose to call with QO or on their own phone."*
Read as: the choice belongs to the person at the point of the call, not to a default that
sends a seat holder through Quo from the first press. Decisions 2 and 3 were reshaped around
that sentence; 1, 4 and 5 stand as recommended.

1. **Dial at once, or open Quo with the number filled?** Dial at once (`action=call`). The
   button says Call in Quo, and the row's Call is a deliberate press.
2. **Where the choice lives.** At the press. A seat holder's first Call on a phone opens a
   small sheet with the two ways, **Call in Quo** and **Call from my phone**, each a link that
   dials. The pick is kept on that phone, in the browser, as Show Mine · Everyone is, so the
   next press is one tap again. A ▾ beside every Call button brings the sheet back, so the
   other way is always in sight. The Settings → Your account card of the proposal was not
   built: the sheet is reachable from every Call, and a setting far from the press is one more
   place to drift.
3. **Default for a seat holder.** None. The first press on a phone asks. Nobody is sent
   through Quo on a press they did not pick.
4. **The caller ID.** The number the thread texts from: the box's number, read from the
   Inboxes row, the team's when the box named has none. While the row is not read, the link
   leaves `from` out and Quo picks the person's number.
5. **The button's words.** **Call in Quo** only when that is what the press does, **Call**
   otherwise, **Call back** and **Call them** the same way.

## Where it plugs in (as built, v2.5803)

- **Pure:** `src/lib/quo/dial.ts`. `planCall({ number, from, seat, phone, kept, verb })` is
  the whole button: its link or none, its words, what the ▾ opens; `quoDialHref` builds
  `openphone://dial?…`; `isPhoneDevice`, `hasQuoSeat` (own or shared by the office);
  `readCallThrough` / `keepCallThrough` on the pattern of `messages/showLens.ts`. A number
  with an extension stays `tel:`, since the link carries none. Tests beside it.
- **One hook:** `src/hooks/useCallThrough.ts` reads the seats row and the boxes row once a
  page (`quo/dialIo.ts`), the signed-in user, the device, and the kept pick for every button
  on the page at once.
- **One button:** `src/components/messages/CallButton.tsx`, the site's own look, the ▾ and
  the sheet. The seven Call sites take it: the call task's Call, the New lane's Call back
  (live now, it was a dead button), Waiting on them's Call and Call them, the thread's ☎ and
  the numbers under the arrow, the reply box's Call kind, the Pipeline's customer door and the
  Sent receipt.
- **Words:** the guide *call a customer from a task* § Call in Quo or from your phone, the
  Glossary's Call task entry, `docs/MESSAGES_ARCHITECTURE.md`'s Calls paragraph, the release
  note and the fragment.
- **Nothing on the server.** No migration, no function, no new key.

The mock-up beside this file, `mockup.html`, is the proposal's drawing: it still shows the
Settings card that was not built, in place of the sheet at the press.

## What must be tried on a real phone

1. iPhone, Safari, Quo installed and signed in on a seat: press Call in Quo on a ZZ test
   contact's row. Does Safari ask *Open in Quo?* Does Quo dial from the company number with no
   question? Hang up. Does the thread show *<name> called · from the company number* within a
   minute, and does the call task close?
2. The same on an Android phone with Chrome.
3. A phone with no Quo: what the press shows. The store, or a browser error. The switch set to
   the dialer must make the press a plain `tel:` again.
4. A Mac with Quo as the default for calls: press Call on a desk row. The *dial with Quo?*
   popup, then Quo with the number.
5. Nothing is pressed on a real customer. The test contact is a ZZ row made for the try and
   deleted after, and the number dialed is one of ours.

## Where it stands

Proposed and built 2026-10-23, v2.5803, on the owner's yes with the one change above. Left:
the try on a real phone with Quo, as the dev with his own seat, from the list above. A later
small cut: the quiet line *Quo logs this call* on the row after a Call in Quo press, and
`call.ringing` / `call.answered` read live.
