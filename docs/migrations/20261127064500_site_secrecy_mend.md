# 20261127064500_site_secrecy_mend.sql (written 2026-11-27, kept ready, not pushed)

The mend for `20261127052337_site_secrecy.sql` (punch list #439, piece 4, the ground). It lives on the branch `claude/439-site-secrecy-mend`, on a PR that is held and never merged as it is: the PR is there so CI's SQL beds prove it. Push it only if a read or a save of a job misbehaves after the site's file and the cause is not found at once.

## What it does

1. **Every site that is on goes off**, as `site_secrecy_turn_off` does it. The site's rows come off their jobs, which open at once. Every signed copy stays on its person's file.
2. **`site_secrecy_turn_on` refuses, with its reason.** Under the gate of before, a site's row would read as a paper each job requires by itself.
3. **The two trigger functions return at once.** The triggers stay: taking one off `jobs_ledger` needs a lock that stops every read of a job.
4. **The nine functions of the gate are restated** from their newest definitions before the site's file.

## Why the nine bodies can be trusted

Each body is byte for byte what prod ran before the site's file. The md5 of each body is on its line in the file. It is the md5 of `prosrc` read on prod on 2026-11-27 at 06:38 UTC, and the md5 of the body in the migration named beside it.

| Function | From | md5 of the body |
|---|---|---|
| `job_closed_to_me` | `20261117220000` | `2895270825653d0a18f07b918449c695` |
| `jobs_closed_to_me` | `20261117220000` | `3b7f0f3d0a3f95c14ef398220d567db4` |
| `job_shut_to_user` | `20261118020000` | `e76aa921f4ba0595d55d53ee3d070dce` |
| `job_papers_for_person` | `20261117220000` | `ef41b8f29e19971bc951b754b206aa88` |
| `job_paper_start` | `20261117220000` | `a9e67619c1c7a3a035ecdcc4a4c0c322` |
| `job_paper_remove` | `20261117220000` | `6fe922f3c7b8f194cbd2bcf4a3b18679` |
| `job_papers_roster_now` | `20261124160000` | `37de3059e84f44d28edd9e72966d5114` |
| `job_papers_needing_me` | `20261117220000` | `5140afbc7efee7a1f3fc216f47ef3a18` |
| `job_papers_require` | `20261121150000` | `2f99efd8e048faba0fea4a2173923b75` |

After a push of the mend, the same read on prod must print the same nine values.

## What it leaves

The table `site_secrecy` with its rows, each turned off. The column `job_required_papers.site_secrecy_id` with what it holds. `address_key`, the internal helpers, the preview and the turn-off. None is read by the gate of before.

## What it locks

Rows only, in step 1. No statement takes a lock on a table, so no read and no save waits. `SET lock_timeout = '3s'` opens the file. Safe to run twice.

## Before it is used

- Take a new stamp from `origin/main`'s latest file and claim it with `npm run claim -- --migration <file>`. The stamp in the name was written before the site's file was pushed.
- Its bed is `supabase/tests/site_secrecy_mend` (`npm run test:pg:site-secrecy-mend`), on this branch alone. On a whole schema it takes the ground and then the mend, turns a site on under the ground applied again, applies the mend over it, and holds the nine md5s, the site turned off, a helper's reads as they were before the site went on, the refusal of turn-on and a job's save.
- The stamp is claimed for this branch.
- A PR that carries it needs a release note and its fragment, with a claimed version.
- Putting the site's rule back afterwards is the site's file again, as a new migration.
