SET lock_timeout = '3s';

-- Presses nothing takes back (punch list #443, row 16): a developer deletes a kept miss of the map.
--
-- An address no map service can place, saved on a bid or a job or typed in the job form's address box, is kept in
-- address_geocode_misses under the address as typed (20261124091500, punch list #408), so the screens stop asking the
-- services for it. It goes by itself when a point is saved for the address (address_geocodes_clears_miss), and it
-- stops counting after 30 days, but nobody could delete one by hand: the table grants SELECT, INSERT and UPDATE and
-- has no delete policy. A walk's made-up address stood in the misses for a month. The owner's answer of 2026-11-25
-- put row 16 beside the eight take-backs that need a migration, each push on its own yes.
--
-- The least that opens the door: a delete policy for a developer and the grant, as bill_hand_ways_delete_dev and
-- sent_documents_delete_dev open theirs. The press that calls it is a dev's **Clear…** in Settings → Data & recovery
-- → Kept map addresses, which clears a miss only when no record anywhere holds its street line
-- (src/lib/map/keptAddressClear.ts), the rule the kept addresses already follow. The four fences, laid when the table
-- was made, are restrictive policies and hold a read-only user, a twin and an archived caller back from this delete
-- too. No table is created, so no fence is owed. Idempotent.

DROP POLICY IF EXISTS address_geocode_misses_delete_dev ON public.address_geocode_misses;
CREATE POLICY address_geocode_misses_delete_dev ON public.address_geocode_misses
  FOR DELETE TO authenticated
  USING (public.is_dev());

GRANT DELETE ON TABLE public.address_geocode_misses TO authenticated;

COMMENT ON POLICY address_geocode_misses_delete_dev ON public.address_geocode_misses IS
  'Punch list #443, row 16: a developer deletes a kept miss by hand, from the Kept map addresses block, when no record holds its street line. Nobody else deletes one; a saved point still clears its miss by trigger.';
