# 20261016060000_customer_prefers.sql (2026-10-17, v2.5597)

The customer's say and the assistant's way (punch list #115 PR 6, `to-dos/tell-the-customer/README.md`). The client reads the new column and table fail-soft, so it may deploy first; push after the feature PR merges, redeploy `quo-webhook` (it writes the preference on an EMAIL or TEXT reply) and `messages-nudge-dispatch` (it reads it), and regenerate the types.

## What it does

1. **`contacts.prefers`** (`text` · `email` · `either`, null for nobody said), **`prefers_how`** (`reply` · `office` · `page`) and **`prefers_at`**: how a person wants to hear from us. `quo-webhook` writes it as the service role when a text is the one word EMAIL or TEXT (as STOP is read); the office writes it from the thread's ⋯ menu; their page comes later.
2. **`contact_set_prefers(p_contact, p_prefers)`**: the office's press, through `follow_up_press` (signed out, a training account, a twin and anyone off the office team are refused in words); a word that is not text, email or either is refused; the same word again writes nothing; otherwise a gray line in the thread (*Rosa set how Dana hears from us: email.*).
3. **`tell_customer_prefs`**: My way, one row a person (`booked`, `estimate`, each `ask` or `send`). RLS: the row's owner alone, for every verb; `authenticated` holds SELECT, INSERT and UPDATE; `anon` nothing. The three fence appliers run at the end.
4. **`nudge_offer_make`** rewritten with `p_send_on` optional: a null morning means the text waits for a press on Today's sends (a moved first visit's Rescheduled text); the *Say which morning* refusal is gone.

## Why the shape

- A column on the contact, not on the channel: the say is the person's, across their numbers and addresses.
- `prefers_how` keeps who said it, so a customer's own reply is never quietly overwritten by a guess; the office's press still wins when they make it.
- My way is a table of its own because `users` is read everywhere and a per-moment pair of words has no business there.

## Verify

Read-only on prod after the push: `select prefers, prefers_how, count(*) from contacts group by 1, 2` reads all null until a reply or a press; `select count(*) from tell_customer_prefs` reads 0 until someone sets their way. The messages flows bed (`npm run test:pg:messages-flows`) holds the no-morning offer; the follow-up bed (`npm run test:pg:messages-follow-up`) holds the press, its gray line, the refusals, My way's own-row policy and the fences.
