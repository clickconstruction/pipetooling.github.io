# 20261123100000_start_check_arrive_shown.sql (2026-11-23, v2.8368)

Before we start, on arrival: the card sends the list it showed. Punch list #382, the first of the faults the audit of PR 10 saw and left as they were, built on the owner's word of 2026-11-23. It drops the two-argument `start_check_arrive(uuid, uuid[])` and creates `start_check_arrive(uuid, uuid[], uuid[])` with the third argument defaulted, so a two-argument call still resolves to the one function. Same grants. No table, so no closing calls.

## The fault

An answer marked every bullet there was to look at when it landed (`start_check_to_look`), not the bullets the card had shown. Two ways a card is older than the list:

- The office adds a bullet to the stage while a card is open. **Yes, all as told** then said a yes we saw on a thing nobody of ours had looked at.
- A bullet with a No gets a new yes from the office while a card that was asked about another bullet is open. The answer to that other bullet marked the new one too.

## The rule now

`p_shown uuid[] DEFAULT NULL` is the ids of the bullets the card showed.

| The send | What the door does |
|---|---|
| `p_shown` given | The answer marks the bullets to look at that the card showed, and no other. A bullet to look at that the card did not show is left as it is: the office's word on it stands and no yes we saw is written over it. Once someone has arrived the read asks only about a No with a new yes (`start_check_to_look`, v2.8238), so that bullet is the office's to tick. |
| A later No on a bullet nobody of ours has seen | Kept as an arrival of its own, with its line to Dispatch. A No is news on any bullet that does not already carry a No. The old door marked every bullet to look at, so this case could not arise; the new one can leave a bullet behind, and a No on it is the dearer answer. |
| A No on a bullet not in `p_shown` | Refused: *The list has changed. Open it again.* A No is pressed on the card, so it is on a shown bullet or the call is not the card's. |
| Nothing shown is left to look at, while something is | Refused: *The list has changed. Open it again.* The card reads the list again and shows what is asked. |
| `p_shown` null, the old client | Marks every bullet to look at, as before. |

Everything else holds: a first answer with nothing to look at is refused, a later No on a bullet we saw as a yes is kept as an arrival of its own (v2.8238), and a **Yes, all as told** with nothing asked again is refused by name (v2.8178).

## Who may call what

`start_check_arrive(uuid, uuid[], uuid[])` keeps the grants of the function it replaces: `authenticated` and `service_role`, never `anon` or `PUBLIC`. Who it refuses is unchanged.

## The old client and the deploy

The client that sends `p_shown` calls a signature production does not have until this is pushed, so PostgREST would answer that call with `PGRST202`, a refusal, not a lost signal. `check:calls-ahead` labels the PR *push right after the merge*: push this right after the merge, before the Pages deploy lands. The old client's two-argument call resolves against the new function through the default, so pushing first is safe too.

## Checked

`supabase/tests/start_checks/30_arrive.sql` section 6: a stage with two bullets to look at; a card that showed one marks one and leaves the other with no mark and nobody asked; a No on a bullet the card did not show is refused; an old card showing only what is seen now is refused; a card showing both keeps a No on the second with its line to Dispatch; one function remains, with the three arguments and the grants. Docker does not run on the Mac this was written on, so the SQL beds workflow is the bed's first run.
