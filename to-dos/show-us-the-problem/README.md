---
name: "First look: a caller gets a link by text, shows us the problem in photos and a short video with no sign-in, and the office prices it before a truck rolls"
number: 319
group: gated
status: asked 2026-11-11 · read against main the same day · the card and the mock-up drawn · the owner's side read the mock-up the same day, liked the proposal, asked for one line on the customer's page (drawn) and for a build plan with the files in Google Drive, an upload that works with no signal and a Customer supplied photos folder on jobs and customers · the plan below is that answer · nothing built
summary: >
  The owner's idea: when someone calls or texts, the office texts back a link to a page with no
  sign-in, tied to their number, where they add photos and videos of the problem. The office
  prices it before going out, each one is a record that leads to an estimate, and a technician
  sees it before the visit or before it is on the schedule. Read against the app: the number
  already lands on a person's thread, a ten-letter link with a guard on guessing already goes out
  by text for estimates and bills, crew photos already file to the customer's Drive folder, and a
  lead's thread already has Start an estimate and Book a visit. Three things are new: a page that
  takes files from someone who is not signed in, video (nothing in the app takes, stores or plays
  one, and the app's own functions cannot carry one), and the record itself, with a way for a
  tech to see it before a job exists. The word case already means four other things in the app,
  so the card calls the record a First look and the customer's page Show us the problem. The
  files are kept in Google Drive, in a new Customer supplied photos folder under the customer and
  under each job, and what is picked on the phone is kept there until it has signal to send.
next: the owner's go on the plan; then the hand trial on five real calls and the one-day spike on two real phones, which settle the upload's road before PR 1
size: L as a train of seven (M · S · M · M · S · S · M), after a spike that never merges
blocker: The owner's go. The spike's answers (an upload in pieces with a link's key, a kept video surviving a reload on an iPhone, an iPhone's video playing on the office's machines, the live project's storage size limit).
opinion: build — the first PR needs no public page at all, so the office is using it on real calls before the hard part is written
mockup: to-dos/show-us-the-problem/mockup.html
---

# First look (#319)

## The ask

The owner's side, 2026-11-11, as dictated:

> I think that we now have the infrastructure where when someone calls or texts us, we could text
> them back with a link to a portal that they don't have to sign into, but is tied to their phone
> number and therefore their customer ID. And we can give them a space to upload the photos of
> the problem they're having, as well as videos of the problem they're having. And we can use
> those photos and videos to determine and quote them before we go out there. I think this is
> where the click in click plumbing can come from and a real novel tool that our app would have
> that others may not have. The most novel part about this is the idea that each one can become a
> case and can lead to an estimate and a technician can be a part of that case where they can see
> it before they go to the job or before it goes onto their schedule. What are your thoughts on
> this?

## The answer, in short

Build it, as a train of small PRs, and try it by hand first. Nearly every piece is already in the
app, so the first PR puts a customer's photos in front of the office as a First look with no
public page at all, fed by the pictures a text already brings in. The page, the video and the
Drive folders follow. The tech's part, which is the novel part, is the last PR and not the first:
it needs a new way for a tech to see one record of a thread he cannot open, and it is only worth
building once the office has shown it prices from what comes in.

Two things to be plain about. A customer can already text a photo to the company number, and it
lands in their thread. So the page has to earn its place with what a text cannot do: a video that
is not squeezed by the phone carrier, a few questions that make the photos useful, and a record
that travels to the estimate and to the tech. And video is the hard part. Nothing in the app
takes, stores or plays one, and a big file has stopped the app's functions twice.

## What exists, piece by piece

**Reuse** is used as it is. **Widen** needs a change to something that exists. **Missing** is new.

### The call or the text arriving, and the text back

| Piece | Today | Verdict |
|---|---|---|
| A call or a text arrives | `quo-webhook` places the number through `quo_place_number` and writes the line through `quo_write_line`. A missed call, a voicemail and a text are each a line on the person's thread. | Reuse |
| A picture sent as a text | `keepTextMedia` (`_shared/quoMedia.ts`) copies each file into the `message-attachments` bucket, any type, up to 25 MB (`KEEP_FILE_BYTES`). The thread lists it as a file with Open and Save to Drive (`LineFiles.tsx`); it draws no picture inline. Save to Drive needs the line tied to a job first. | Reuse for the hand trial; the look's card draws the pictures |
| The text going out | `quo-send`, the office team only, texts on, the number not stopped, a prospect only when `prospects.ok_to_text`. Files go as link lines; there is no outbound picture. | Reuse |
| The opt-out line on a first text | `optoutReason` (`messages/textOut.ts`): first text from this box, or 30 days of silence. `messages.optout_line` records it. | Reuse |
| A first text names who is writing | `firstTextIntro.ts` (`isFirstText`, `introHeld`, *Put the opening back*). Used by the Tell the customer sheet alone, and held on the bill alone. | Widen: bring the hold to this one line in the reply box |
| A link made for one message | The reply box's `{rate}`: `mintRate` in `ReplyBox.tsx` calls `mint_customer_rating(p_contact_id, …)`, the send waits while the link is made, and the customer answers at `/rate?t=`. `{estimate}` mints the same way through `share_estimate_link`. `/bill`, `/estimate` and `/warranty` list papers (`quickReplies/slash.ts`, `messages/papers.ts`). | Widen: a `{show}` blank and a `/show` word, on `{rate}`'s model |
| A line that asks for a photo | `{thing}` in `quickReplies/blanks.ts` already reads *what you want a photo of*. | Reuse the habit; the new line carries the link |
| The missed-call text back | `planMissedReply` and `textBack` in `quo-webhook`; the setting `messages_missed_call_reply_v1`, off as shipped; three fixed lines with no blanks; sent as `messages.auto`; one per call in `missed_call_replies`; held 3 hours after any text of ours. | Widen only on the owner's word (call 2): a fixed line has no way to carry a link made for one caller |
| Nothing reaches a customer unless a person presses it | `tellCustomer.ts`'s rule. The two sends with no press are the morning run's steps the owner switched to *sends* and the missed-call line. | Reuse: the link goes on a press |
| 8 AM to 9 PM Central | `_shared/sendWindow.ts`, enforced on timed sends (`nudge_offer_retime`, `messages-nudge-dispatch`). A send a person presses now is not fenced, and neither is the missed-call line. | Reuse as it is: a person presses the ask |

### The number tied to a person

| Piece | Today | Verdict |
|---|---|---|
| A number is a contact | `contact_channels` (phone or email, the 10-digit `key`, the opt-out per box, the office's usual star) under `contacts`, which points at exactly one record: a customer's person, a trade partner's, a prospect, a roster person. | Reuse |
| A contact is a customer | `contacts.customer_id`, set when the office names the sender (`name_contact`) or the New lane's *A new customer* makes one. | Reuse |
| A number nobody knows | A contact of kind `unknown` named by its number, with *Who is this?* on its thread. | Reuse: the look hangs on the contact, so it works before there is a customer |
| One number, two people | The unique is per contact, so two contacts may hold one number, and an inbound line lands on the one that last carried a message on it (`contact_for_channel`). | Reuse: the link is made for a thread, never looked up by number |
| A caller who is not a customer yet | A lead's thread has **Book a visit** and **Start an estimate** (`leadDoors.ts`, `useLeadDoorThreadSlots.tsx`). Each first makes the `customers` row (a name and a phone are enough) and re-points the thread, then opens the Add Job form or makes a draft estimate. They draw for kind `lead` alone. | Widen: the look's card offers both on any thread, skipping the convert for a customer |

### No-sign-in pages and how each is guarded

| Page | How it is keyed and guarded | What it gives this card |
|---|---|---|
| The estimate link `/e/<code>` | Ten letters from `23456789abcdefghjkmnpqrstuvwxyz`, minted by `share_estimate_link`, only the SHA-256 kept, 14 days. A lookup that finds nothing counts a miss by a hash of the caller's address (`estimate_link_miss`, `_shared/estimateLinkMisses.ts`), and past 20 in the hour that address gets 429. No revoke. | Reuse the alphabet, the hash, the guard and `recordEstimateLinkMiss` as they are |
| The bill link `/pay/<code>` | The same ten letters kept in plain on the bill, never expiring; `pay-link` adds 60 a minute per address in memory. | The same guard |
| The review page `/rate?t=` | 64 hex characters in plain, no expiry, no guard. Takes a score and up to 1,000 characters. | The mint-per-message pattern only |
| The box page `/b/:code` with `box-read` | Eight hex characters; the miss guard; a retired box answers 410. It never returns the job, the customer, a price or a name. | The rule for what a forwarded link may show |
| The Worker `portal-link-shell` on `my.clickplumbing.com` | `/e/` and `/pay/` answer a 301 to the app with no shell and no preview card. Edited in the Cloudflare dashboard and mirrored in `scripts/cloudflare/`. Any other path is read as a portal slug. | Widen: one `/show/` line before the slug rule, in both copies |
| The customer portal `/p/<slug>` | A link per customer, revoked and re-made, no expiry. Shows bills, agreements, stages, a thread. No estimates, no photos, **no upload**. | Not the home for this: it is one link per customer for everything they owe and sign, and it shows too much for a link sent to a caller |
| A page that takes a file with no sign-in | One exists: the trade partner's portal. `submit-gc-trade-portal` takes base64 in the request, 10 MB at most (`TRADE_FILE_MAX_BYTES`), 20 files an hour per company, the type read from the file's first bytes (PDF, JPEG, PNG, HEIC), a hidden field that catches a robot. | Reuse the caps, the type check and the hidden field; its road cannot carry a video |

### Photos and files

| Piece | Today | Verdict |
|---|---|---|
| The shrink on the phone | `lib/photos/shrink.ts` and its worker: 1600 px on the long edge by default, about 300 KB; Large is 2400 px, about 700 KB. A file that is not a picture passes through unshrunk. | Reuse, at the Large size |
| The waiting copy and the sweep | `photo-save` runs every five minutes over eleven sources and files each waiting photo into Drive. It reads the whole file into memory and sends it in one request, about twice the file's size at the peak. | Widen: a twelfth source for a look's files. A photo goes as every photo does. A video is copied to Drive in pieces, never whole |
| Where a photo lands | The job's Customer Pictures folder under the customer's folder (`photoFolderOrWhy`, `FolderTree.placeJob`). The customer has a folder (`customers.google_drive_link`), but nothing files into it before a job exists. | Widen, on the owner's ask of 2026-11-11: a **Customer supplied photos** folder under the customer and under each job (*Where the files live* below) |
| One list of every photo | The `uploaded_photos` view unions six sources, one of them `message_attachments` that are images, with `contact_id` on the row. | Widen: a branch for a look's photos, so they show on Documents → Photos and the job window names them *a photo the customer sent* |
| Buckets | Every photo bucket is 2 MB and images only. `counter-tickets` is 10 MB. `message-attachments` is 25 MB and takes any type. `supabase/config.toml` sets 50 MiB for the local stack; the live project's limit is not in the repo. No storage policy lets a visitor who is not signed in write. | Missing: a private bucket for looks that takes pictures and video |
| Video | Nothing. No `<video>` in `src/`. The bid photo window refuses one in words (*A video. Photos only for now.*). A video sent as a text under 25 MB is kept as a file and skipped by the sweep and the view. | Missing: the upload, the player, the keeping rule |
| The functions' memory | A worker has 256 MB for everything it is doing. A 25 MB plan set ended one (v2.6408, which left the 12 MB cap), and one large mail ended `gmail-sync` 190 times in a row (v2.6667). | The rule this card takes: a video never passes through a function |
| A signed upload straight to storage | `createSignedUploadUrl` is used once, by `twin-mcp` for a robot's plan PDFs. No page hands one to a browser, and nothing uploads in pieces that pick up after a drop. | Missing, and the right road: the function checks the code and the caps and hands the phone a one-file upload address; the bytes go from the phone to storage |

### Where it leads

| Piece | Today | Verdict |
|---|---|---|
| An estimate | Its own table, `estimates`, not a bid. `customer_id` may be empty on the row, but the editor holds a draft until it has a customer, and nothing ties an estimate to a contact or a lead. A message can point at one (`messages.estimate_id`), and `draft_estimate_line_from_message` puts a message's words on a draft as a line. | Widen: the estimate remembers the look it came from |
| Starting one from a thread | **Start an estimate** makes the customer, re-points the thread, inserts the draft and opens `/estimates/<n>`. | Reuse, from the look's card |
| Photos on an estimate | Only the field photos the Quick Estimate wizard takes (`estimate_field_photos`, `EstimateFieldPhotosStrip` in the office's editor). The customer's accept page shows none. Bid photos (#306) are on bids, not estimates. | Widen: the strip draws the look's pictures for the office. The accept page still shows none |
| Sending and accepting | Send to customer through the Tell the customer sheet, by email (`send-estimate-to-customer`) and by text with the ten-letter link; the customer accepts at `/e/<code>` (`accept-estimate`), and the accept is a line on their thread. | Reuse |
| One price | An estimate carries one total, or options the customer picks between. There is no range. | Reuse: one price with the line that the tech confirms it (call 7) |
| A job from the estimate | Made by itself on the accept only while the owner's switch is on (`signed_agreements_auto_create_job_estimates`); otherwise the office presses Create job (`create_job_from_estimate`). | Widen: the job takes the look with it |
| Booking | **Book a visit** opens the Add Job form filled in. It makes no schedule block; the office places the job from Schedule Dispatch's *Add job to schedule*. | Reuse |
| Before it is on anyone's schedule | Schedule Dispatch has no list of work not yet placed, no proposed visit and no offer to a tech. The nearest things are the Dispatch inbox (`dispatch_requests`, where the portal's *Request a visit* lands) and a field user's own self-schedule search. | Missing: asking a tech before a job exists |
| What a tech sees before a visit | Job Mode's card for his own blocks: the customer, the address with a map, the job's updates, checklists and the Photos line (`JobModePhotosLine` → `JobPhotosWindow`). My Schedule shows today and tomorrow with a link to the job's Drive pictures. | Widen: a strip for the look on the card |
| What a tech may read | Job photos by `can_report_stage_progress` (on the job's team or clocked in). A customer's thread lines only for a primary or a helper dispatched to or clocked on one of their jobs this week or last (`messages_tech_can_read`). A file on a thread line is the office team's alone. No field role opens `/messages`. | Missing: a gate that lets one asked tech read one look |

### The word

*Case* already means four things: a person's HR file as the dev seat reads it (`get_case_brief`, `search_case`), a check that came back (*Close the case* in AR), a Stripe dispute or failed bank payment (`ar_stripe_cases`), and a legal matter on the Legal desk and the firm portal. *Ticket* is the supply house counter ticket (#295). *Request* is the portal's ask to Dispatch or the estimator (`dispatch_requests`, `estimator_requests`). *Lead* is a kind of contact. *Visit*, *question*, *ask* and *walk* each name something too. The card's pick is **First look** for the record (*Dana's First look of Nov 11*) and **Show us the problem** for the customer's page. Neither is used anywhere in the app. The address is `my.clickplumbing.com/show/<ten letters>`: a word a customer can read, and `/p/` and `/s/` are taken by the customer's and the sub's portals.

## What is truly new

1. **A page that takes files from someone who is not signed in.** The trade portal is the one precedent, and it is sent to a company we invited. This one goes to anyone who called.
2. **Video.** The upload in pieces from a phone on a weak signal, a place to keep it, a way to play it, and a rule for how long it is kept.
3. **The record.** One row per ask that knows who asked, whether the link was opened, what came in, who looked, which estimate and which job came from it, and which tech was asked. Everything on screen is a view of that row.
4. **A tech seeing something before a job exists.** Today a tech reaches a customer's words only through a job he is on, and Schedule Dispatch has nothing for work that is not booked. This is the part the owner called the most novel, and it is the part with the least under it.

## The design

Drawn in [`mockup.html`](./mockup.html), ten frames and the Drive tree, every name and number made up.

- **A · the text.** The office presses `/show` in the thread's reply box. The line goes in with the link made for this thread: *Hi Dana, this is Rosa with Click Plumbing. So we can price this before we come out, send us a few photos or a short video here: my.clickplumbing.com/show/k7m2p9xq4d*. A first text carries the opt-out line and is held if the opening is trimmed.
- **B · the page.** *Show us the problem*, who asked, two presses (**Take a photo or a video**, **Choose from your phone**), four lines on what helps, the owner's line under them on why it is worth the customer's while, and the foot: only Click Plumbing sees what is sent, and what to do if water is running now. No name, no address, no price. The owner's line, in his words of 2026-11-11 after reading the mock-up, the one change he asked for: *The more information you give us, and the higher the quality of the photos and videos, the more accurate we can be, allowing us to get you the best service and fewer trips means a better price.*
- **C · adding.** Each file goes up as it is picked. A photo is shrunk first. A video goes in pieces with a bar and its megabytes, and picks up after a drop. *Where is it?* as chips and *What is going on?* as a box, both optional. The press is dead and says why until every file is in, then reads **Send 3 photos and 1 video**.
- **C2 · no signal.** *Saved on this phone. No signal right now.* The count of what is kept, **Try now**, and the way round: reply to the text with the photos. Opened again later with files still kept, the page offers **Send them now**.
- **D · the thank-you.** *Got it. Rosa has your 3 photos and 1 video.* What happens next reads the office hours the app holds (`messages_office_hours_v1`), so after hours it says tomorrow morning. Opened again later the page shows the count, never the pictures.
- **E · F · the office.** The ask in the reply box, and what came in: one card on the person's thread with the pictures drawn, the video with its length, their words, and **Start an estimate**, **Book a visit**, **Ask a tech…** and **Ask for more**. The send lands as a line from the customer, so Needs a reply, the header's badge and the push to whoever has the thread all fire with no new code.
- **G · the estimate.** It remembers the look it came from and shows its pictures to the office. It carries one price, as every estimate does, and the customer reads *Priced from your photos. The tech confirms the price at your home before any work starts.*
- **H · the tech, before it is booked.** The office asks one tech. He gets a push, sees that one look and nothing else of the thread, and answers with *I can price it from this* or *Needs a visit to price* and a note. His answer lands on the thread as a team note.
- **I · the tech, before the visit.** Once a job exists the look is a strip on its Job Mode card: what they sent, what they said, the tech's read and the estimate.

## Where the files live

The owner's questions of 2026-11-11: *where are these going to be stored? In Google Drive?* and *can we add a customer supplied photos subfolder to jobs and customers?* Yes to both.

**Google Drive is where they are kept.** The tree today is the jobs root, then the customer, then the job, then five folders with fixed names (`JOB_FOLDER_TREE` in `_shared/whereFilesGo.ts`): Customer Pictures, Plans, and Team only with Photos and Sent by us inside it. Crew photos land in Customer Pictures. Nothing files into the customer's own folder before a job exists.

**Two new folders, one name: Customer supplied photos.**

- **Under the customer**, for a look that has no job yet. Each look gets a folder of its own inside it, named by its day and place, *2026-11-11 · Kitchen*, so a customer's second look a year later does not mix with the first.
- **Under each job**, beside Customer Pictures. When a job is made from a look, the look's folder moves there (`moveFile`, which keeps every link working, as a job's folder keeps its links through a move today).
- Video goes in the same folder. The name says photos because that is what the office will look for.
- The folder is made when something first lands in it, on every job, whatever the *made up front* setting says. A hundred old jobs do not each get an empty folder.
- Documents → Where files go shows the new folder in the tree, and the job window's Documents tab lists what is in it, as it does for the other five.

**The road a file takes.**

1. From the phone to the app's own storage, a private bucket that takes pictures and video only and refuses anything over the cap. Nothing passes through a function.
2. The photo sweep, every five minutes, files it to Drive. A photo goes as every photo does. A video is copied in pieces of a few megabytes, with its place kept on the row, so a function never holds more than one piece and a copy that is cut off picks up on the next run.
3. Drive holds the keeping copy. The app keeps its own copy to draw the picture and play the video on the thread, the estimate and the Job Mode card, because a tech has no Drive access of his own. A photo's copy is small and stays. A video's copy is dropped after a year (call 9), and the card then offers *Open in Drive*.

**A caller who is not a customer yet** has no folder to file into. The files wait in the app and the card says *Files to Drive once this number has a customer*. The moment the office names them, the next sweep files them.

**A picture a customer texts in** is kept by the app today and saved to Drive by hand into the job's photos. From PR 2 a texted picture saved from a look goes to Customer supplied photos too (call 12).

**Considered and not picked: straight from the phone into Drive.** Drive can hand out a one-file upload address that a browser sends to in pieces. That is one hop and one home. Against it: nothing checks the file's type or size before it is in the company's Drive, the app would have to pass every play of a video through a function, and a caller with no customer has no folder. The spike tries it as the fallback if the first road fails.

## With no signal

The owner's question of 2026-11-11: *can we offer an offline upload?* Yes, with two honest limits.

**What the page does.**

- **Kept on the phone the moment it is picked.** Each photo and video is saved in the browser's own store on that phone before anything is sent, the way a crew photo is kept in the outbox today (`lib/offline/keptPhotos.ts` is the model; the public page gets its own small store, since the crew's is tied to a sign-in).
- **Sends by itself when the signal is back.** With no signal the page says *Saved on this phone. No signal right now. It sends when the signal is back.* and tries again without a press. A video that was cut off halfway picks up at the piece it stopped on.
- **Still there if the page is closed.** Opening the link again finds what was kept and offers **Send them now**.
- **A way round the page.** The ask says it and the page says it: *No luck? Reply to Rosa's text with the photos.* A picture texted in while a look is open shows on the same card.

**The two limits.**

1. **The link needs a signal once, to open.** A page cannot load with none. A customer about to go under the house opens the link first, then takes the pictures.
2. **An iPhone will not send while the page is closed or the phone is locked.** No web page can. The page says *Keep this page open*, and what was kept waits. A browser may also clear what a page kept after about a week unused, so the page says how long it will hold them.

## The smallest first slice

**Before any code: five real calls by hand.** The office asks each caller to text a photo of the problem to the company number. It lands in their thread today. That shows, for nothing, whether callers will do it, whether the office looks in time, and whether a price can be made from it.

**Then PR 1**, which has no public page. Rosa presses *Ask for photos*, the ask goes as a text, and whatever Dana texts back shows on one First look card with the pictures drawn and the two presses under them. The record, the card and the player are all things the page needs later, so nothing in it is thrown away.

## The risks

| Risk | What the design does | What is left |
|---|---|---|
| The link is forwarded | The page shows who asked and a count, and nothing of the customer. The link closes after 7 days or when the office closes the look. | A stranger holding the link can add a file. The office sees which look it came in on and can close it |
| What the page shows about the customer | Nothing by default (call 3). The box page's rule. | A first name would be friendlier and is the owner's call |
| A guessed code | Ten letters and the estimate link's guard, counted by the caller's address. | The guard counts misses per address, so a slow guesser from many addresses is not stopped; ten letters from 31 is about 800 trillion codes |
| Video size | Asked for 10 to 20 seconds, taken up to 2 minutes, capped per file and per link. A phone's own video is roughly 1 to 2 MB a second, so 20 seconds is 20 to 40 MB and 2 minutes is past 100 MB. | The live project's size limit must allow it, and storage is paid by the gigabyte (call 9 sets how long a video is kept) |
| A weak signal, or none | A photo is shrunk first. Every file is kept on the phone when it is picked, sends by itself when the signal is back, and a video picks up at the piece it stopped on. A reply to the text with the photos is the way round. | The link needs a signal once to open. An iPhone sends nothing while the page is closed. A browser may clear what it kept after about a week |
| An iPhone's video on the office's desk | The spike plays one real iPhone clip and one real Android clip on the office's own machines before anything is built. | If one does not play, the card offers the file to open in Drive, which plays most kinds |
| The page is heavy on a weak signal | The page is its own small piece of the app, outside the sign-in and the shell, as the box page is. The spike measures its first load on a slow connection. | The app's own shell still loads first; if it is too heavy the page becomes a page of its own |
| Upload in pieces with a link's key | Supabase Storage has an upload that resumes and a signed upload address. The spike proves the two work together from a phone browser before anything is built on them. | If they do not, the fallback is Drive's own one-file address, and after that one request per file with a lower video cap |
| A caller who is not a customer | The look hangs on the contact. It makes no customer and files nothing to Drive until the office names them. | A look on an unnamed number is still an open row somebody must close |
| Consent and the texting rules | A person presses the ask. A first text names the sender and carries the opt-out line. A number that sent STOP gets no text. A prospect is texted only when they said yes. | The missed-call line carrying the link with no press is call 2, and my answer is no for now: a link sent by itself to a number that never asked reads as spam to a carrier |
| What a customer sends | Pictures and video only, checked by the file's first bytes. Nothing is run. The page tells them to send the problem, and the foot says who sees it. | A photo may show a person, a child or a room. The files are the office's and the asked tech's to see, and never go on a customer page |
| Who watches, and how fast | The send is a customer's line, so it shows wherever a text does. The thank-you promises only the office's hours. | Nobody watches at night, and the page says so. A look not opened in an office hour should show on Follow up as a text does |
| A price from photos that the visit changes | The estimate says it was priced from photos and that the tech confirms it at the home (call 7). | Every changed price teaches something. A later step can compare the photo price with the final bill |
| An emergency sent to a page | The page and the thank-you both say: water running now, shut off the main and call. | The office decides whether to send the link at all on a call like that |

## The owner's calls

Each with my pick first. On 2026-11-11 the owner's side read the mock-up and said *I like your proposal*. No call was answered one by one, so the picks stand as the plan's basis until he changes one. Call 9 he answered himself.

1. **The name.** *First look* for the record and *Show us the problem* on the page. Or: Problem report, Look-ahead, his own word. Not *case*.
2. **Who sends the link.** A person's press only. Or: the missed-call text back carries it too.
3. **What the page says about the customer.** Nothing: who asked, and Click Plumbing. Or: greet them by first name.
4. **How much video.** Ask for 10 to 20 seconds, take up to 2 minutes, 20 photos and 3 videos a link. Or: longer, or photos only at first.
5. **How long the link lives.** 7 days, and it takes more than one visit until the office closes it. Or: one day, or open until closed.
6. **What we promise back.** A look within office hours, said in the hours the app holds. Or: a clock, such as within an hour.
7. **The price from photos.** One price, with the line that the tech confirms it at the home before work starts. Or: two options to pick between, which an estimate already has, or never a price without a visit.
8. **The tech's part.** The office asks one tech by name. Or: every tech sees a shared list and whoever is free answers.
9. **Where the files live.** Answered 2026-11-11: Google Drive, in a Customer supplied photos folder under the customer and under the job. Left of it: how long the app keeps its own copy of a video for playing. A year. Or: until the job is paid, or for good.
10. **A caller who is not a customer yet.** The look hangs on their number's thread and makes no customer until the office names them. Or: make the customer when the link goes.
11. **The folder's name.** *Customer supplied photos*, his words, holding video too. Or: Customer supplied files.
12. **A picture a customer texts in.** Saved from a look, it goes to Customer supplied photos. Saved any other way it goes where it goes today. Or: every texted picture saved to a job goes there from now on.
13. **When the new folder is made.** When something first lands in it. Or: on every new job up front, with the other five.

## Where it plugs in

Exists, to reuse:

- The thread and its slots: `components/gc/messages/ThreadWindow.tsx`, `threadSlots.tsx` (`lineBody` for the look's card, `menuRows` for *Ask for photos…*), `LineFiles.tsx`, the realtime re-read `useMessagesLive`.
- The reply box: `reply/ReplyBox.tsx` (`mintRate` and `withLink` are the two models), `quickReplies/blanks.ts` (`BlankKey`, `BLANKS`) with its generated edge copy, `quickReplies/filling.ts`, `quickReplies/slash.ts` (`PAPER_WORDS`), `ratings/ratingLinkIo.ts` as the io to copy.
- The first text: `messages/textOut.ts` (`optoutReason`), `tellCustomer/firstTextIntro.ts`.
- The code and its guard: `share_estimate_link`'s mint (`20261108053000_estimate_short_codes.sql`), `_shared/estimateTokenLookup.ts`, `_shared/estimateLinkMisses.ts`, `publicViewDecision` for the open's count.
- The public file precedent: `_shared/gcTradeFile.ts` (`fileMimeOf`, `cleanFileName`, the caps), `_shared/gcTradeSubmit.ts` (`isHoneypot`).
- The page's shell: the public routes in `src/App.tsx`, `customerSurfaceRegistry.ts` (its test refuses a public route with no row), `portal/portalShortOrigin.ts`, `scripts/cloudflare/portal-link-shell.worker.js`, the light wrapper every customer page wears.
- Photos: `lib/photos/shrink.ts`, `photo-save`'s Messages source and the per-job tick (`photo_saves`), `uploaded_photos`, `JobPhotosWindow`, `JobModePhotosLine`.
- The lead doors: `lib/messages/leadDoors.ts`, `leadDoorsIo.ts`, `components/messages/useLeadDoors.ts`.
- The estimate: `Estimates.tsx` and its Send to customer through the Tell the customer sheet, `send-estimate-to-customer`, the accept page at `/e/<code>`, `EstimateFieldPhotosStrip`, `messages.estimate_id`, `create_job_from_estimate` and `auto_create_job_from_signed_estimate`.
- The tech's side: `DashboardJobModeCard.tsx`, `JobModeDetailsSection.tsx`, `can_report_stage_progress`, `messages_tech_can_read` as the gate to model the one-look read on.
- Office hours: `messages_office_hours_v1` (`messages/hasRule.ts`).
- The push: `messages-notify`.

New:

- Tables `first_looks` (the contact, who asked, the code's hash, the days it is good, asked, opened, sent, looked at, closed, where and their words, the estimate and the job it led to, the tech asked and his read) and `first_look_files` (the look, the kind, the path, the bytes, the length of a video, when it finished, its Drive id, how far a copy in pieces has got); a private bucket for both kinds; RLS for the office team; the migration opening with the lock timeout and closing with the four fence calls.
- `mint_first_look(p_contact_id)` for the office team, on `share_estimate_link`'s mint.
- An edge function `first-look` with `verify_jwt = false`: read by code (who asked, the count, open or closed, the office hours), sign one upload (after the caps and the type), and finish (writes the customer's line on the thread and calls the push). The miss guard on every lookup.
- In Drive: `customerSupplied: 'Customer supplied photos'` beside the five names in `whereFilesGo.ts`, a `FolderTree` door for the customer's own, `photo-save`'s twelfth source, and a copy in pieces in `_shared/driveUpload.ts` beside `uploadBytes`.
- `src/lib/firstLook/`: `look.ts` (the states and their words), `caps.ts` (what a link may take and the words for each refusal), `thanks.ts` (the promise from the office hours), `card.ts` (the thread card's facts, from the look's own files and the pictures texted in since the ask), `kept.ts` (what the phone holds and what is left to send), each with tests.
- The page `src/pages/ShowUs.tsx` at `/show/:code`, its store on the phone, the upload in pieces, a player, the thread's card, the estimate's line, the Job Mode strip, the tech's read.
- A guide, *ask a customer to show you the problem before you go out*, and a section in the Messages guides and in *set where a job's files go*.

## Is this the best we can do?

Asked of the first plan on 2026-11-11, at the owner's prompt. Eight things changed.

1. **The first PR has no public page.** The first plan needed three PRs before the office saw anything. Now PR 1 is the look, its card and its player, fed by the pictures a text already brings in. The office uses it on real calls while the hard part is written, and the page later feeds the same card.
2. **A spike before the ground.** The first plan put the proof inside PR 1. Five things can only be learned on real phones, so they are a day's spike that never merges, and the plan forks on its answers.
3. **Drive is the home.** The first plan kept a video in the app. Now every file is kept in Drive, in the folders the owner asked for, and the app's copy is only for showing and playing.
4. **A video reaches Drive in pieces.** The sweep reads a whole file into memory today. A copy in pieces with its place kept on the row is what makes Drive possible for video at all.
5. **Offline is three layers, not one.** Kept on the phone, sent in pieces, and a reply to the text as the way round.
6. **The tech's ask rides a task card.** The first plan built a new list and a new push. A task already reaches a tech with a push, sits on his Checklist and takes a note when it is done (`messages/threadTask.ts` sends a thread as a task today). The look is the task's link, behind a gate that lets the asked tech read that one look.
7. **A photo is shrunk less.** The owner's line on the page asks for quality, and a water heater's label is small print. A look's photo uses the Large size, 2400 pixels on the long edge, as a counter ticket does.
8. **Measured from the first day, and in Spanish.** The row stamps asked, opened, sent, looked at, priced, accepted and booked, so the owner can later read how many looks became jobs and how far a photo price was from the bill. The page reads in English or Spanish by the customer's own setting, as the rating page does.

Looked at and left out for now: the app reading a photo by itself (a model and a serial off a label), which the bill reader could do for about a cent and which waits on the owner's word; a text back to the customer when the files arrive, which would be a text nobody pressed; showing the customer their own pictures again, which a forwarded link would show to a stranger.

## The plan

**Step 0, no code: the hand trial.** Five real calls where the office asks for a photo by text. Write down for each: did they send one, how long before the office looked, could it be priced.

**Step 1, a spike that never merges** (a day, on a real iPhone and a real Android phone). Five answers, written back onto this card:

1. Does an upload in pieces work from a phone's browser with a one-file address the function hands out? If not, does Drive's own one-file address?
2. Does a 40 MB video kept in the browser's store survive a reload and airplane mode on an iPhone?
3. How big is a 20 second clip from each phone, picked from the library and taken in the page?
4. Does each clip play on the office's own machines?
5. How heavy is the page's first load on a slow connection, and what is the live project's storage size limit?

Then seven PRs, each cut from main alone and merged before the next.

1. **PR 1, the look, fed by a text** (M). The migration for `first_looks`; *Ask for photos* in the thread's menu and `/show` in the reply box, sending the ask with no link yet; the First look card on the thread, gathering the pictures texted in since the ask and drawing them, with a player for a texted video; **Start an estimate** and **Book a visit** on the card for any thread; Close the look; the stamps. The guide. Push the migration. **The first real call is here.**
2. **PR 2, Customer supplied photos in Drive** (S). The new name in the tree, under the customer and under the job, made when first needed; a folder per look; the card's **Save to Drive** filing a texted picture there; Where files go and the job window's Documents tab showing it. Deploy `photo-save`, `job-photos` and `drive-link`.
3. **PR 3, the ground for the page** (M). `first_look_files` and the bucket; the ten-letter mint; the `first-look` function with its three asks, the caps and the guard; the sweep's twelfth source with the copy in pieces; the kernels and a SQL bed. No screen. Push and deploy.
4. **PR 4, the customer's page** (M). `/show/:code` outside the sign-in, light, at 375 first, in English and Spanish: the two presses, the four tips and the owner's line, the Large shrink, the store on the phone, the pieces with the bar, the no-signal and the send-them-now states, the press that names its count, the thank-you from the office hours, the closed and the not-found words. The ask gains the link (`{show}`), with the reply-by-text way round. The Worker's `/show/` line in both copies, the surface registry row, `APP_DIRECTORY.md`, `ACCESS_CONTROL.md`, *What customers see*. `npm run build` before the merge.
5. **PR 5, the estimate** (S). `estimates.first_look_id`; the office's editor draws the look's pictures; the line the customer reads on a price from photos.
6. **PR 6, the job** (S). The look follows the job, whether the accept made it or the office pressed Create job: its Drive folder moves under the job, the strip on the Job Mode card and the job window, the photos on the job's Photos as *a photo the customer sent*.
7. **PR 7, the tech before it is booked** (M). **Ask a tech…** makes a task for one tech with the look as its link; a gate that lets the asked tech read that one look and its files; his read written back to the thread as a team note when he finishes the task.

Cards this touches: #306 (`bid-photos-and-links`, whose call 8 held video back for bids; the upload and the player built here are what it would use), #125 (`pipeline-customer-conversation`, where a look's line would show on the job's activity), #189 (`phone-first`, the tech's screens), #115 (`tell-the-customer`, the rule the ask follows), #281 and #290 (the short links whose code and guard this reuses), and the Where files go tree of #236.

Apart, each on the owner's word: the missed-call line carrying the link (call 2); a door with no call first, such as a QR on a truck or the website, which needs a number typed and checked; the app reading a label off a photo; the photo price set beside the final bill on the Bridge.

Each PR: claim its version, the tests on the files it touches, `check:edge-bundles` when a function changes, lint, the narrow typecheck, `npm run build` when a route or the Worker's mirror changes, `gh pr merge N --auto`.

## How to verify

On the dev server or the deployed app as the dev login, on a **ZZ Test** customer whose mobile is the owner's test number:

0. PR 1 alone: press *Ask for photos* in the ZZ Test thread, send the ask to the test number, text two pictures back from that phone. The card draws both, and Start an estimate opens a draft for the ZZ Test customer.
1. PR 4 on: in the ZZ Test thread type `/show`. The line goes in with a link ending in ten letters. Preview shows the opt-out line on a first text. Send it to the test number only.
2. Open the link on a real phone with no session. The page names who asked and nothing else. Add three photos and one video of about 20 seconds. Switch to airplane mode halfway through the video and back: it picks up. The press reads its count, then the thank-you reads the office hours.
3. In the thread the card shows the pictures, the video plays, and the thread is in Needs a reply.
4. A wrong code reads not found; twenty-one wrong codes from one address read locked. A closed look reads closed with the phone number.
5. A twenty-first photo and a fourth video are refused in words. A PDF is refused in words.
6. PR 4 on: Start an estimate from the card, send it to the test number, read the line about photos on the accept page.
7. PR 6 on: View as a sample field account, ask that tech, read his one look, answer, and see the note on the thread. The same account cannot open `/messages`.
8. With no signal: open the link, switch to airplane mode, add two photos and a video. The page reads *Saved on this phone*. Close the page, switch the signal back, open the link: **Send them now** sends all three.
9. In Drive: the look's folder sits under the ZZ Test customer's Customer supplied photos within ten minutes, the video whole and playing. Make a ZZ Test job from the look: the folder is under the job, and the old links still open.
10. Delete the ZZ Test rows, the bucket's files and the Drive folders, and name any sent text in the report.

No text goes to any number but the test number from a ZZ Test row.

## Where it stands

Asked 2026-11-11 and read against `main` the same day. The owner's side read the mock-up that day, liked the proposal, asked for one line on the customer's page, and asked for a build plan with the files in Google Drive, an upload with no signal and a Customer supplied photos folder on jobs and customers. The plan, *Where the files live*, *With no signal* and *Is this the best we can do?* are that answer, and the mock-up gained a no-signal frame and the Drive tree. Nothing is built, nothing was sent, and nothing was made on prod. The next thing is the owner's go.
