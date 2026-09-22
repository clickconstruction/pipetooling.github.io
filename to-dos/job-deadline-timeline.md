---
name: One timeline per job — every deadline, whose move it is, what goes out next
number: 32
group: ready
status: asked 2026-09-22 — not built; no such view exists
summary: >
  **One timeline per job**: a single view where a person sees, in date order, every deadline the
  job carries — the § 53.056 notice per work month, the § 53.057 retainage notice, the § 53.052
  affidavit, the § 53.055 copy five days after filing, the demand letter's fee clock and the
  reply it waits on, the owner's 30-day reservation window, the foreclosure suit's year — with
  whose move it is (ours, the GC's, the owner's) and which document or letter goes out next.
  Today those dates live in five places and none shows one job's whole clock.
next: >
  **Mock-up first.** Draw the view on three real jobs (a commercial job mid-notice, a residential
  job with an affidavit due, a job with a demand letter out and a reply pending), show it to the
  owner, and ask "is this the best you can do" before writing code — then build what survives
  that question. The to-do is not started until the mock-up exists.
size: M
blocker: The mock-up and the owner's answer to it.
ver: —
opinion: build — the office already tracks these dates one instrument at a time; the job's whole clock on one page is the thing counsel's grid (#33) asks for and the Lien desk does not show.
---

# One timeline per job — every deadline, whose move it is, what goes out next

Asked 2026-09-22: *is there a view where a user can see a timeline of the deadlines where someone needs to respond or they need to send out the next type of document or letter or notice per job?* There is not. The rule for building it: **a mock-up comes first, followed by the prompt "is this the best you can do"**, and only then the code.

## What exists, and why none of it is this

- **The Lien window** (Job → Lien): the § 53.056 notice tab and the affidavit tab compute their own dates for the job (`computeJobLienClock`, `assessLienWatch` in `lienDeadlines.ts`) — one instrument at a time, on separate tabs, no line that runs from the first unpaid month to the last day a suit may be filed.
- **The Lien desk**: every job's notices due, queued by deadline across the company — a work queue, not a job's story; the affidavits pile is a second queue.
- **The Dashboard's Needs-you list**: *serve the filed copy* and *the unconditional release* items surface when they fall due; nothing shows what comes after them.
- **The demand letter**: its fee clock and the reply-by date live in the letter and the Collections row.
- **The job calendar** (appointments) and the Timeline view (how many jobs run at once) are about crews, not deadlines.

## What the view holds

One vertical line per job, dated, with today marked. Each point carries three things: **the date**, **whose move it is** (ours · the GC's · the owner's · the county's), and **the document** — sent (with the tracking number), due (with days left, red inside a week), or missed (window closed, named so nobody counts on it). The points, from what the app already dates:

1. Each unpaid work month's § 53.056 notice — due, sent, or missed (residential a month earlier).
2. The § 53.057 retainage notice — 30 days after our contract ends (#33 builds the instrument; the timeline shows its date even before the form exists).
3. The § 53.052 affidavit — the 15th of the fourth month after the last work month (third on residential).
4. The § 53.055 copy — five days after filing.
5. The owner's 30-day reservation window after the original contract completes (§ 53.101), when that date is known.
6. The demand letter — sent, the fee clock, the reply we are waiting on.
7. The foreclosure suit — one year from the last day the affidavit could have been filed (§ 53.158).
8. Payments and releases — a paid date ends the line.

A "next" strip above the line: *the next thing that goes out, and when* (ours), and *the next thing we are waiting on, and from whom* (theirs).

## Doors

The Lien window (a Timeline tab beside the notice and affidavit), the Lien desk row (a ⋯ *Timeline*), the Collections row, and Job Detail's History tab.

## Mock-up

Draw it before building. Three real jobs, three states (a commercial job mid-notice, a residential job with an affidavit due, a job with a demand letter out and the reply pending), the phone width included. Then the question — *is this the best you can do* — and the answer changes the drawing before it changes the code. Keep the drawing in this folder when it exists (`mockup.html`, the way `gc-on-notice/` did).
