# 20261013210000_quick_replies_phone_es.sql (2026-10-12, v2.5421)

Residential customers in Messages, R3's SQL: a quick reply gains its Spanish words and its place on the tech's phone,
and a sent text remembers the line it came from (`to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md` on branch
`spike/gc-mode`, *R3* and section 3's data row). The kernels are helper 4's `src/lib/quickReplies/phone.ts`
(`PhoneLine`: `phoneOrder`, `phoneName`, `textEs`) and `blanks.ts` (#5558). It needs cut 3's
`20261012190000_quick_replies.sql` and the spine's `messages`, so it lands after both. No new table, so no fences.

## What it does

1. **`quick_replies.text_es`**, nullable, 1,000 characters at most, never blank: the line in Spanish for a contact
   whose language is Spanish (R8 · 16). Null: none, and the English goes.
2. **`quick_replies.phone_order`**, nullable, 1 or more: the line's place on the tech's phone. Null: not on the phone.
   There is no unique index. The Phone tab's kernel (`phoneLines`) breaks a tie by the line's id and leaves out a
   removed line, a line kept for one person and a line not for customers. A unique index cannot be deferred, so it
   would let a removed line keep blocking its place and fail a swap of two lines half way.
3. **`quick_replies.phone_name`**, nullable, 60 characters at most, never blank: the button's name on the phone. Null:
   the kernel's `shortName` reads it from the words.
4. **`quick_reply_versions`** gains two kinds and two columns:
   - `es`: the Spanish before and after in `from_text` and `to_text`. Either side may be null, when there was none or
     it was cleared, never both, and never the same.
   - `phone`: a change to the line's place or name on the phone. `from_phone_order` and `to_phone_order` keep the
     place before and after when the place changed, null for off the phone, so the history tells put on, taken off and
     moved apart (helper 3's `versionWords`). A change to the name alone keeps neither and reads as changed on the
     phone.
   - `quick_reply_versions_kind_known` and `quick_reply_versions_kept` are dropped and added again. Only a phone row
     holds a place; every other kind keeps its own columns as before.
5. **Who a line is for** widens to the seven kinds of contact (R0, #5565's `QR_KINDS`): `lead`, `sub`, `supply_house`
   and `candidate` join `trade`, `customer`, `arch` and `any`. `quick_replies_for_known`,
   `quick_reply_versions_from_for_known` and `quick_reply_versions_to_for_known` are dropped and added again, and
   `quick_reply_step` is made again with the seven in its list and its refusal's words.
6. **`messages.quick_reply_id`**, nullable, references `quick_replies` ON DELETE SET NULL, with a partial index: the
   quick reply a sent text came from. `quo-send` fills it later. The spine's table-wide SELECT grant reads it; nobody
   signed in writes it, and no policy changes.
7. **`edit_quick_reply`** is dropped at `(uuid, text, text, text)` and made again with three trailing parameters that
   keep by default, so one Save stays atomic and every four-argument call already written still resolves:
   - `p_text_es`: null keeps, blank clears, else the Spanish, trimmed.
   - `p_phone_order`: null keeps, 0 takes the line off the phone, below 0 is refused.
   - `p_phone_name`: null keeps, blank clears, past 60 characters is refused.
   - Only the team's lines for customers go on the phone ("Only the team's lines for customers go on the phone.").
   - It writes a version for each part that changed, in the order words, tags, es, phone, and "Nothing changed." counts
     all seven. EXECUTE is the signed in's, never `anon`'s.

`SET lock_timeout = '3s'`. Adding the columns takes `quick_replies`', `quick_reply_versions`' and `messages`' locks for a
moment, and `messages`' foreign key a share lock on `quick_replies`. The CHECKs added again read every line and version
row, a few hundred at most. Every statement is idempotent, and a second run changes nothing.

## The bed

`scripts/pgtest-quick-replies.sh` runs this file again after its second run of `*_quick_replies.sql`. That second run
makes the four-argument `edit_quick_reply` again beside this one, and the old `quick_reply_step`; this file drops the
one and replaces the other. Step 9 of
`supabase/tests/quick_replies/20_scenario.sql` checks:
- Rosa adds a team line for customers and saves its Spanish and its place in one Save: an `es` version and a `phone`
  version with the place after, both by Rosa, the Spanish trimmed.
- A Save with four arguments changes the words and keeps the Spanish and the phone.
- A new name alone writes one phone version with no place. A move to 3 with the Spanish cleared writes two. 0 takes the
  line off the phone. The history reads the Spanish set, put on, the name, the Spanish cleared, moved, taken off.
- Nothing changed, the phone on Rosa's own line and on a line for trades, a place below 0 and a name past 60 characters
  are refused in words.
- A line for leads is added, its version for leads, and its tags move to subs. A line for vendors is still refused,
  in the seven kinds' words.
- One `edit_quick_reply` is left, with the seven arguments, the signed in's and not `anon`'s.
- A phone version with words, a words version with a place, an `es` version that changes nothing and a place of 0
  written by hand are refused by their CHECKs.
- A sent text keeps its words and lets go of its line when the line is deleted.

It runs on GitHub's runners through `scripts/sql-beds.txt`. The office Mac has no Docker.

## Verify after the push

1. **The columns and the function.**

   ```sql
   SELECT table_name, column_name, data_type FROM information_schema.columns
   WHERE table_schema = 'public' AND ((table_name = 'quick_replies' AND column_name IN ('text_es', 'phone_order', 'phone_name'))
     OR (table_name = 'quick_reply_versions' AND column_name IN ('from_phone_order', 'to_phone_order'))
     OR (table_name = 'messages' AND column_name = 'quick_reply_id'))
   ORDER BY table_name, column_name;
   SELECT oidvectortypes(proargtypes) FROM pg_proc WHERE proname = 'edit_quick_reply' AND pronamespace = 'public'::regnamespace;
   SELECT has_function_privilege('authenticated', 'public.edit_quick_reply(uuid, text, text, text, text, integer, text)', 'EXECUTE'),
          has_function_privilege('anon', 'public.edit_quick_reply(uuid, text, text, text, text, integer, text)', 'EXECUTE');
   ```

   Six rows; one signature, `uuid, text, text, text, text, integer, text`; `true`, `false`.

2. **The checks and the foreign key.**

   ```sql
   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
   WHERE conrelid = 'public.quick_reply_versions'::regclass AND conname IN ('quick_reply_versions_kind_known', 'quick_reply_versions_kept');
   SELECT confdeltype, confrelid::regclass FROM pg_constraint
   WHERE conrelid = 'public.messages'::regclass AND contype = 'f'
     AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.messages'::regclass AND attname = 'quick_reply_id')]::smallint[];
   ```

   The kinds list `es` and `phone`; `kept` has a `WHEN 'es'` branch and the phone clause; the key is `n`,
   `quick_replies`. `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'quick_replies_for_known';`
   lists the seven kinds and `any`.

3. **Nothing moved.** `SELECT count(*) FILTER (WHERE text_es IS NOT NULL OR phone_order IS NOT NULL OR phone_name IS NOT NULL) FROM public.quick_replies;`
   is 0 until the editor saves one.
