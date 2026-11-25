# 20261124215500_global_reload_dev_only.sql (2026-11-24, v2.8532)

Global Reload's signal: two row policies on Realtime's own table, `realtime.messages`, so that anyone signed in hears the private channel `force-reload` and only a dev sends on it.

- **Why**: the signal was a broadcast on the open Realtime channel `force-reload`. An open channel takes a broadcast from anyone holding the app's public key, which every visitor's browser holds. So anyone could make every open copy of the app hard-reload, over words a person had typed. The press was dev-only on the screen and nowhere else. Diane, 2026-11-24, asked for the lock.
- **What it makes**:
  - `force_reload_signed_in_hear`, `FOR SELECT TO authenticated`: the topic is `force-reload` and the row is a broadcast.
  - `force_reload_dev_send`, `FOR INSERT TO authenticated`: the same two tests, and `public.is_dev()`.
- **How Realtime uses them**: a client that joins a channel with `config: { private: true }` is checked against these policies as the signed-in person, with `realtime.topic()` naming the channel. A read policy lets them hear, a write policy lets them send. The answer is kept for the life of the connection and looked up again on each join and each new token. A send the write policy refuses is dropped by the server with no reply.
- **What it does not touch**: the open channel of the same name. A private channel and an open channel of one name are two channels, and a broadcast on one never reaches the other. The project's Realtime setting *Allow public access* stays on, since every other channel the app uses is open. So the open `force-reload` channel still takes a broadcast from anyone, and no copy of the app with this change listens there.
- **Nobody signed out**: neither policy names `anon`. The provider that joins the channel mounts only inside the signed-in app.
- **Never `ALTER TABLE realtime.messages`**: the table is the Realtime service's, row security is already on, and the statement fails with *must be owner of table messages*, which would abort the file.
- **A database with no Realtime service**: the whole-schema beds are the Supabase Postgres image with no services, so `realtime.messages` is not there. The file checks `to_regclass('realtime.messages')`, says *the Global Reload policies were not made* and makes nothing. With no policy nobody joins the private channel, so a skip opens nothing.

Idempotent: `DROP POLICY IF EXISTS` then `CREATE POLICY`, twice. No table is made, so no fence call closes the file. The two statements take a brief lock on `realtime.messages`, under the 3 second timeout.

**The bed**: `supabase/tests/global_reload_dev_only/20_scenario.sql` (`scripts/pgtest-global-reload-dev-only.sh`, in `scripts/sql-beds.txt`). `00_schema.sql` stands in for Realtime's table, its `realtime.topic()` and the baseline's `is_dev()`. `bedt.sends` and `bedt.hears` try the write and the read as a role with a person's claims, as Realtime does. Fifteen checks: the two policies and no third; a dev sends; a master, an assistant, a controller, a subcontractor, a person with no `users` row and a token naming nobody do not; nobody signed out sends or hears, with a dev's id or without; every signed-in role hears; another channel's name and this channel's presence stay closed to a dev; a person who stops being a dev stops sending. The script first runs the file on a database with no `realtime.messages` and checks the skip.

**Order**: push right after the merge. Until the push, a copy of the app with this change is refused at the join and tries again by itself, so it hears no signal. Nothing else waits on it. No types regen: no table, view or function changes.
