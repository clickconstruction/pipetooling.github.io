-- v2.3813 — the leader is here: two more ways the office records his word on a lien paper.
--
-- Owner, 2026-09-24: rather than the master signing in on the assistant's computer, "a written
-- declaration the assistant can make such as 'he is standing over me' or 'he is typing it in'".
-- The record is the existing one — approval_mode = 'word', word_note + word_channel — and the
-- channel list grows by two. Nothing else about the guard changes: the spoken word still needs its
-- note and channel, and approved_by is still the person who recorded it.
SET lock_timeout = '3s';

ALTER TABLE public.job_lien_desk_items
  DROP CONSTRAINT IF EXISTS job_lien_desk_items_word_channel_check;

ALTER TABLE public.job_lien_desk_items
  ADD CONSTRAINT job_lien_desk_items_word_channel_check
  CHECK (word_channel IN ('', 'phone', 'in_person', 'text', 'standing_over', 'typing'));

COMMENT ON COLUMN public.job_lien_desk_items.word_channel IS
  'How the leader gave his word (approval_mode = word): phone · in_person · text, or — v2.3813 — standing_over / typing when he was at the office''s desk as it was recorded.';
