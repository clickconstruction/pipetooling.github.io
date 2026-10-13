-- Messages, residential R6 (migration *_messages_two_boxes), run just before it: lines from before there were two boxes,
-- for its backfill. A text and a call on the company number, the event Quo's webhook keys beside the text, an email the
-- bids@ reader took, and a team note, on one unknown contact. Committed, so the migration finds them; their ids are R6's
-- own, so cut 6's scenario never counts them. See scripts/pgtest-messages-email.sh. Never against prod.
\set ON_ERROR_STOP 1
INSERT INTO public.contacts (id, kind, name) VALUES ('00000000-0000-0000-0000-0000000008c0', 'unknown', 'Before Two Boxes');
INSERT INTO public.messages (contact_id, channel, direction, body, quo_id) VALUES
  ('00000000-0000-0000-0000-0000000008c0', 'text', 'in', 'Is Tuesday still good?', 'AC-r6-before'),
  ('00000000-0000-0000-0000-0000000008c0', 'missed', 'in', '', 'CA-r6-before'),
  ('00000000-0000-0000-0000-0000000008c0', 'event', 'team', 'Texted STOP', 'AC-r6-before:event');
INSERT INTO public.messages (contact_id, channel, direction, body, gmail_id) VALUES
  ('00000000-0000-0000-0000-0000000008c0', 'email', 'in', 'Plans attached.', 'g-r6-before');
INSERT INTO public.messages (contact_id, channel, direction, body) VALUES
  ('00000000-0000-0000-0000-0000000008c0', 'note', 'team', 'Called back.');
