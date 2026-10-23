---
name: "Lien desk: a dev's Approve opens a sign block that signs with the dev's name over the master's line — hold the mark to the job's master and give the dev's screen a door"
number: 150
group: gated
status: building 2026-10-23, the owner chose C with a code he sets himself; PR 1 (v2.5788, #6054) the code in Settings, PR 2 (v2.5791, claude/lien-sign-code-desk) the desk field
summary: >
  When a dev presses Approve on the Lien desk, the notice opens with the signature block in typed
  mode: the cursive reads the signed-in dev's name (Robert) while the line under it reads the
  job's master (Malachi Whites, Master Plumber, #RMP41130). The press is not refused: a dev is a
  signer role in the guard, so one press signs the master's notice with the dev's name and prints
  it above the master's license. The owner read the screen as a dead end and asked whether a
  master should be able to type his name on any screen. Three options mocked up: A keeps the
  rule and fixes the screen (draw mode by default, in the master's name, on the dev's screen);
  B gives the master his own door (Ask Malachi to sign, by text and push, he signs on his phone);
  C lets him type on any screen with a second proof, the record the guard was written to refuse.
next: PR 1 (the code table, the RPCs, the guard rule, Settings → Your account → Your signing code), then PR 2 (the desk block takes his code on any screen, tells him each use, his confirm or disown)
size: S (A) + M (B); C would be L with a guard migration
blocker: none
ver: proposed
opinion: A then B. A typed name on someone else's device is the office placing his name unless he proves it is him, and if he has his phone to prove it he has his phone to sign on. Fix the screen so it never shows the wrong name, and send him the notice instead of the laptop.
---

# Lien desk: sign on any screen? (#150)

## The owner's answer (2026-10-23)

"I like C, and I would like Malachi to be able to set that code in his settings and it should be
4-6 digits. I don't think it should be a code sent to his phone. I think it should be a code he
only knows that he sets himself in settings." So C, with the proof a code of his own rather than a
text: set under Settings → Your account, hashed in the database, checked there, five wrong tries
lock it, the record names whose screen, and his own sign-in may stand behind it or disown it as it
does a pen record. The concern on record: a short code typed on another's screen can be watched or
guessed, which the lock, the record and the disown door answer.

## The ask

The owner, 2026-10-23, with three screenshots of the desk: "When a dev clicks on Approve on the
Lien desk they are brought to this screen where they cannot action, other than bringing their
computer to the Master Plumber listed and have him wet sign. Should we make it possible for a
master plumber to be able to type in their name on this screen, regardless of user?"

## What the screen does today (read in the code, confirmed on a local preview as the dev)

The desk's footer draws the notice's own signature line (`LienNoticeSignLine`) for anyone whose
role is a lien leader: a dev or a master technician. It signs as the **signed-in user**, not as
the job's master:

- `signerName = authName || leaderName`, and the write goes out as `signer: { userId: authUserId,
  printedName: signerName }` with `onDevice: null` (`LienDeskModal.tsx`, `signItem`).
- Live on 804 · Summit GC- Auto Zone (master: Malachi, role `master_technician`, active, phone on
  file), signed in as Robert (role `dev`): the block opens in mode `type`, the cursive reads
  **Robert**, the line under reads **Malachi Whites, Master Plumber (#RMP41130), Click Plumbing
  and Electrical · Signed October 23, 2026**, with *Draw instead* and **Sign and approve & next ▸**.

**The press would not be refused.** The guard (`job_lien_desk_items_guard`, migration
20261010020000) allows a signer whose role is master *or dev*, and the write is under Robert's
own sign-in (`signed_by = auth.uid()`). So one press records *Placed by Robert with one press
under his own sign-in to ClickTooling* and the notice, counsel's letter and letter two print
**Robert** in cursive above the rule, with Malachi's name and license under it. Counsel's
answer 7 (2026-09-22): the master plumber signs and is the callback; that is the persuasive
signature, not an officer's. The papers already name the master; the mark should be his.

**Draw instead is the same trap.** A drawing on the dev's screen is recorded as the dev's own
drawing (`signed_by` = Robert, no `signed_on_device_of`), not as Malachi's hand on Robert's
screen. The flow the guard was built for, *Leader here, sign ▸* (the master draws, the row names
the viewer's screen, `signed_on_device_of = auth.uid()` with mode `draw`), exists only on the
run window's amber card for a notice already approved and unsigned (v2.5086). The awaiting
footer has no such door.

**An assistant or controller** never sees the block: their footer offers *Leader here,
Approve ▸* (the spoken word, `approval_mode = 'word'`), and the guard would refuse their
signature anyway (*only a master or dev signs a lien notice*).

**The master's own door already exists, mostly.** *Send for approval* calls
`notify-lien-approval` (v2.4872), which pushes to the job's master when he holds a leader role,
else emails him; the Dashboard's Needs you card *Approve a lien notice the office drafted ·
Decide* opens the Awaiting pile, where his own sign line waits with his own name, one press under
his own sign-in. Live: Malachi has **no push device registered** (`push_subscriptions` is empty
for him under the dev-visible policy), so the words reach him by email only. Whether he has
opened the app or that email lately was not read (the second production read was refused).

**The root.** The desk's "leader" is a role (dev or master); the papers' signer is the job's
master. They agree only when the one who opens the notice is its master. A dev who is not, or a
second master, gets another man's line with his own name on it.

## Options (`mockup.html`: Today and the three, drawn as the block on 804)

| | The record it makes | Guard | Cost |
|---|---|---|---|
| **Today** | *Placed by Robert with one press under his own sign-in* — the dev's name above the master's license | passes (dev is a signer role) | — |
| **A — keep the rule, fix the screen** | *Drawn by Malachi Whites in ClickTooling on October 23, 2026 at 2:14 PM CT, on Robert's screen* | passes today (`signed_on_device_of` + `draw`) | S, client only |
| **B — his own door: Ask Malachi to sign ▸** | *Placed by Malachi Whites with one press under his own sign-in* — the strongest record the desk makes | passes today | M, one function kind + a text |
| **C — type on any screen with a second proof** | *Typed on Robert's screen as Malachi Whites, proved by a code sent to his phone* | refused today; a migration would add a mode and a proof column | L |

**A — keep the rule, fix the screen.** When the signed-in leader is not the job's master, the
block opens in draw mode and says, in plain words, **Malachi signs here, in his own hand, or on
his phone**. The signer is the job's master; the row names the dev's screen. The signed-in user's
name is never shown as the signature. The button reads **Malachi signed here — approve & next ▸**
and is dead until there is ink, with the reason beside it. A second line under the pad says
*Not here? The notice is on his Dashboard and his phone. He signs it there.* The press approves
(a dev or master may) and signs (Malachi's hand on Robert's screen), one write, one honest
record. When the job has no master, today's rule stands: the signed-in leader signs as himself,
and the line under the rule names him too.

**B — his own door.** Beside the pad, **Ask Malachi to sign ▸**. It sends him the same words
*Send for approval* sends (push where he has a device, else email) **and a text** to the phone
on his profile, since the field is where a master's phone is and he has no push device today.
The text says who asked, the job, the money, the mail-by day, and carries the one link that opens
the notice on his phone in the Awaiting pile. The dev's screen does not wait: the row reads
*asked Malachi · 2:14 PM · by text and email* and the desk moves to the next notice. On his phone
the block reads **Your signature, as it will print · Malachi**, and **Sign and approve ▸** is one
press under his own sign-in. His call and his signature, as the desk was designed. The desk
re-reads when the row changes, so the dev sees it reach Ready, signed.

**C — type on any screen with a second proof.** The block offers his typed name on the dev's
screen, then asks for proof: his PIN, or a six-digit code texted to his phone. The record would
say *typed on Robert's screen, proved by a code*. It is the weaker record: it proves his phone
was in the room for a minute, not that he read the notice, and whoever holds his phone for that
minute holds his signature. It needs a guard migration (a new mode and a proof column), an edge
function to mint and check codes, and a text each time. If his phone is in hand to receive the
code, B is one tap on the same phone with a stronger record. The guard was written to refuse
exactly this, and nothing has changed to make it worth loosening.

## Is this the best we can do? Are we being straightforward?

- **The owner's question, answered straight.** A typed name on someone else's device is the
  office placing his name unless he proves it is him. ESIGN and the Texas UETA care about the act
  and who performed it (§ 322.009), not the cursive; today's typed press is a signature because
  it is his own sign-in. Move the press to another man's screen and the record says the other man
  pressed it. So: no to typing on any screen, yes to his name on the line in seconds, on his own
  phone, with the dev's screen sending it to him instead of the laptop going to him.
- **A fixes a wrong thing, not just a dead end.** Today's block is not inert: a press signs with
  the dev's name over the master's license, and a drawing is attributed to the dev. A makes the
  block say whose hand it waits for and records that hand.
- **B is the word flow with a nudge and one record instead of two.** The office already has
  *Leader here, Approve ▸*, which reaches Ready unsigned and waits for his *Sign ▸* from his
  phone. B skips the office's word: he approves and signs in one press, his own, and the row
  never carries a second person's account of what he said.
- **Why a text.** The push exists, but the master has no device registered and a push needs the
  app installed on it. A text reaches the phone he answers in the field and carries the link.
- **Considered and left.** *The dev signs as himself* (today) — counsel said the master signs.
  *Hide the block from a dev who is not the master and show only the word row* — honest, but
  the dev then records a word he did not hear; A and B let the master act for himself.
  *A PIN alone* (C without the text) — a shared secret typed on another's screen is the office
  placing his name with extra steps.
- **Not perfect.** A assumes Malachi is beside the dev; B assumes his phone is on him and the
  text goes out. Neither needs a migration, and the pair covers both rooms. The desk's piles
  still call every leader *you* (*Only you can approve · 3* on a dev's desk for Malachi's jobs);
  that wording is a residual for after A and B.

**Pick: A, then B.**

## Where it plugs in

- **A:** `src/components/jobs/LienDeskModal.tsx` — `signerName`, `signItem` and the `signLine`
  closure read the job's master (`job.master_user_id`, `leaderNameFor`) and pass
  `signer = master`, `onDevice = viewer` when they differ; `src/components/jobs/LienNoticeSignLine.tsx`
  — the tag and the empty-pad words take the signer's first name (*Malachi signs here, in his own
  hand*), `allowPress={false}` as the run window already does; `lienDeskSignIo.test.ts` and
  `LienDeskModal.render.test.tsx` pin the attribution. The guide
  `send-lien-notices-from-the-lien-desk.md` → *Signing a notice* gains the other-screen sentence.
- **B:** `supabase/functions/notify-lien-approval` — `kind: 'sign_ask'`, caller any lien office
  role, item awaiting, words in `_shared/lienApprovalPush.ts` (*Robert asks you to sign a lien
  notice*), plus a text through the shared number to `users.phone`; `LienDeskModal.tsx` — the
  button and the *asked Malachi · 2:14 PM* chip (`fields` or a nullable `sign_asked_at` column;
  the chip can live in `fields` to stay migration-free); `docs/EDGE_FUNCTIONS.md` section.
- **C (not recommended):** a migration with a `type_proved` mode, `signed_proof_how/at`, the guard
  rule, a `lien-sign-code` function, the papers' audit line.

## How to verify

`/dev-login?as=1&to=/jobs?tab=stages%26liendesk=1%26liendeskPile=awaiting` (if the redirect
drops the desk parameters, open `/jobs?tab=stages&liendesk=1&liendeskPile=awaiting` once signed
in). Pick 804 or 891 (master: Malachi). Read the block: the tag, the name in cursive, the line
under the rule. Never press *Sign and approve* on a live notice; the write would sign it.

## Where it stands

Findings and mock-ups only. The preview was read as the dev; one production read confirmed the
master's role, phone and empty push subscriptions; a second was refused by the auto-mode
classifier, so his last sign-in and whether the approval email reached him are unread.
