---
name: "OpenStreetMap refuses the geocode functions"
number: 436
group: gated
status: found 2026-11-24 by the live check of #408 · read the same day from the code, the function logs, OpenStreetMap's usage policy and one request from a Mac · nothing built, no function changed · waits on the owner's pick of four options
summary: >
  OpenStreetMap's address lookup, Nominatim, answers the edge functions geocode-address-batch and
  geocode-one with HTTP 403 on every call. So on the live site it places nothing, and every address
  with no saved point goes on to Google and then the US Census. Nothing is broken for a person: the
  address is still placed. The cost is one refused request and up to a second of waiting for each
  such address. The same request sent from a Mac with the function's own name is answered, so the
  refusal is on where the functions call from or on what they sent for weeks, not on the name. The
  card holds what was found, four options with what each costs, and a pick: take OpenStreetMap out
  of the two functions and ask Google first.
next: The owner's pick of an option below. The pick here is option 3, built as one small PR and a deploy of the two functions.
size: S
blocker: The owner's call. Nothing waits on it: every address is placed by Google or the Census today.
ver: v2.8484
opinion: build option 3 — the refusal cannot be mended from our side, our use is the kind the policy discourages, and Google's count stays where it is today, far under its free count
mockup: not required — no screen changes; two edge functions and their docs
---

# OpenStreetMap refuses the geocode functions (#436)

## Where this comes from

The live check of [#408](remember-unplaced-addresses.md) on 2026-11-24. Its first check found that no
miss was kept, because OpenStreetMap gave the function no plain answer.
[v2.8484](../docs/recent-features/v2.8484.md) mended the rule and made both functions say so in
their log. The log then read:

> geocode-address-batch: OpenStreetMap gave no plain answer: OpenStreetMap (Nominatim) HTTP 403

The owner has made no call on it yet. This card is a read and a report. No function was changed and
nothing was deployed.

## What the functions send

Both ask `https://nominatim.openstreetmap.org/search?format=json&q=<the address>&limit=1&addressdetails=0`.

| | `geocode-address-batch` | `geocode-one` |
|---|---|---|
| `User-Agent` | `PipeTooling/1.0 (https://github.com/Click-Construction; map page geocode)` | the same, ending `map page geocode-one` |
| `Referer` | none | none |
| An email, in the name or as `email=` | none | none |
| Pacing | 1.1 seconds between two OpenStreetMap requests of one call | none |
| Pacing across calls | none | none |

Two things stand out.

- **The web address in the name is dead.** `https://github.com/Click-Construction` answers 404. The
  organization is `clickconstruction`. The name carries no email either. So an administrator who
  wanted to warn us before a block had no way to reach anyone.
- **Nothing paces two calls against each other.** Each open screen makes its own call, and each
  person their own. Two people opening a map in the same second send two requests in that second.

## What OpenStreetMap's policy asks

From the [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/), read
2026-11-24. It covers the public server only.

| The policy | The functions |
|---|---|
| A valid `Referer` or `User-Agent` that names the application. A library's stock name will not do. | Met in form: a name of our own. The address in it is dead. |
| At most one request a second, summed over all the application's users. | Held inside one call. Not held across calls. The day's count is far under it, 80 to 250 calls. |
| Results must be cached. A client that sends the same query again and again may be classed as faulty and blocked. | **Broken for weeks.** Until #408, an address no service could place was asked again on every open of every map. That was about 100 to 350 repeats a day of the same five addresses. The automatic check of the live site added one unplaceable address on every run, 32 to 78 runs a day, until [v2.8049](../docs/recent-features/v2.8049.md) on 2026-11-20. |
| Requests an app sends by itself, with no person asking, count as bulk geocoding and are strongly discouraged. | Nine screens ask with no press. #408 lists them. |
| An app must be able to switch to another service at OpenStreetMap's word, with no software update. | The server is written into both functions. |

The policy names no status code, no block page and no address to write to. Those come from
Nominatim's own block page, the page a 403 carries. In its source it is titled *Access blocked*. It
says the caller broke the usage policy, and that a caller who thinks the block is wrong, or still
has it after mending its use, may write to `nominatim@openstreetmap.org`. Posts by OpenStreetMap's
operators say that a block set by the rate limit lifts by itself after some hours, and that a block
set by hand does not. The page and the posts were read through a web search's summary of them, not
page by page.

## What the logs say, and what they cannot

- **Since the line exists, every call was refused.** The line was deployed at about 15:36 UTC on
  2026-11-24. Four calls reached OpenStreetMap after it, at 15:37:58, 15:38:00, 15:42:33 and
  15:42:51 UTC. All four were answered 403. No call has reached it since, because the misses are
  now remembered.
- **Before that, nothing recorded OpenStreetMap's answer.** The function wrote its status into the
  miss's `detail`, and Google's answer then replaced it. No log line carried it. The saved points
  keep no word of which service placed them.
- **The one older trace is silent.** Since v2.4975 a point placed outside the lower 48 is logged
  with the service's name. From 2026-10-08 to 2026-11-24 the logs hold four such lines, all
  Google's, and none of OpenStreetMap's. That proves nothing either way.

So the start is not known. The refusal is proven from 15:37 UTC on 2026-11-24, and it may be weeks
old. Whether it has lasted longer than the hours a rate block lasts cannot be shown.

## The one request from a Mac

On 2026-11-24 at 16:27 UTC, one request was sent from a Mac on an ordinary connection, not a cloud
server. It carried the
batch function's exact `User-Agent` and asked for a public landmark, not a job. OpenStreetMap
answered **200** with the right point.

So the name `PipeTooling/1.0` is not blocked. What differs for the functions is where they call
from. Supabase gives an edge function no address of its own: it calls out from addresses shared
across projects. That leaves two causes, and this read cannot tell them apart:

1. **Our own repeats.** The weeks of repeated queries went out from those addresses, and the policy
   names that pattern as a reason to block.
2. **The shared addresses.** Another project's traffic from the same addresses earned the block, or
   OpenStreetMap turns that range away.

The 403's own page would say more, and the functions throw it away. Reading it needs a deploy, so
it is a step of options 1 and 2 below and was not done here.

## The Google count

The numbers are #408's, read 2026-11-20.

- About 1,500 addresses have a saved point. About three are added on a working day.
- A new address is asked once. It is then a saved point or, since #408, a remembered miss.
- So what reaches any service now is the new addresses: about three a day, under 100 a month.
- **With OpenStreetMap refusing, all of those go to Google.** That is today's state.
- With OpenStreetMap answering, Google would get only the ones OpenStreetMap could not place.
- Google gives 10,000 Geocoding requests a month free, by its price list since March 2025.

So the whole difference between the best option and the worst is under 100 Google requests a
month, about one percent of the free count. Before #408 the five unplaced addresses alone sent
100 to 350 a day, and that went to Google whatever OpenStreetMap did.

## The options

| | What it is | Cost | Google's count |
|---|---|---|---|
| 1 | **Mend the request.** A live web address and an email in the name, a `Referer`, and the 403's page written to the log once a call. | XS, and a deploy of both functions. | No change while the block stands. |
| 2 | **Ask for the block to be lifted.** A letter to `nominatim@openstreetmap.org`, after option 1 has read the page. | The owner's letter and a wait of unknown length. | If lifted, down by under 100 a month. |
| 3 | **Take OpenStreetMap out.** Both functions ask Google, then the Census. | S: two functions, their docs, tests, a release note, a deploy. | The same as today. |
| 4 | **A paid or self-run OpenStreetMap service.** | A new account, key and terms, or a server to run. | Down by under 100 a month. |

### 1. Mend the request

The dead address and the missing email are real faults and cheap to fix. The fix is not likely to
lift the block by itself, since the same name is already answered from a Mac. Its real worth is the
page: one line in the log would say whether the block is ours or the shared addresses'. It leaves
the repeats mended (#408 did that) and the unpaced calls and the screens that ask by themselves as
they are.

### 2. Ask for the block to be lifted

The letter would name the application, say what was wrong (the repeats) and what was mended (#408
and v2.8049), and give the addresses the functions call from. Those addresses are Supabase's, not
ours, and they change. A lift for a shared range may be refused, or lost again to another project's
traffic. Our use would still include screens that ask by themselves, which the policy discourages.
The gain, if it works, is under 100 free Google requests a month.

### 3. Take OpenStreetMap out, and ask Google first

- Each address with no saved point is answered sooner: no refused request, and no 1.1 second wait.
- One outside service fewer to depend on, and no usage policy we do not meet.
- Google says how sure its pin is, which is why `property-lookup` has asked it first since v2.6520.
  It also tends to know a new street or subdivision sooner than the other two. That second point
  is a general judgment and was not measured here.
- The Census stays as the second ask, so an address is still placed when Google is down or over
  its count.
- What it touches: the OpenStreetMap block and the wait in both functions, the `nominatim` source
  on `geocode-one`'s answer and the readers of it, the `nominatim` input of `isSettledGeocodeMiss`,
  the two sections of `docs/EDGE_FUNCTIONS.md`, the tests, a release note and a fragment.
- What it leaves alone: the map tiles. The street map drawn when Google's map cannot load is a
  different OpenStreetMap service and is not refused.

One thing to know, under every option. Google's Geocoding policy page lets a point be kept for 30
days, and a place ID without end. That too was read through a search's summary, so read the current
terms before acting on it. `address_geocodes` keeps points without end, and it already holds
Google's: Google has been the second ask all along, and the first for the precinct night since
v2.4790. Option 3 does not open that question, but it makes Google the source of nearly every new
point. Whether to act on it is its own call and would be its own card. Asking the Census first and
Google second would shrink it, at the cost of slower answers and more misses on new streets.

### 4. A paid or self-run OpenStreetMap service

OpenStreetMap's wiki lists hosted services that run the same lookup, among them Geofabrik,
OpenCage, Stadia Maps and LocationIQ. Each needs an account, a key kept as a secret and its own
terms. Their prices and free counts were not read for this card. Running our own means a server to
pay for and keep updated. Either way the gain is the same under 100 free Google requests a month,
and Google would stay as the second ask.

## The pick

**Option 3, Google first and the Census second.** The block cannot be mended from our side, since
the name already passes. Asking for a lift costs the owner a letter for a gain of about one percent
of a free count. And the way the screens ask, by themselves and from shared addresses, is the use
the policy asks apps to keep off its public server. Taking it out costs Google nothing more than
today.

Nothing is urgent. Until the owner picks, every address is still placed.

## The owner's calls

1. **Which option.** The pick is 3.
2. **If 3: Google first, or the Census first.** The pick is Google first, for new streets.
3. **A word to OpenStreetMap anyway.** Not needed if the functions stop calling it.
4. **Google's 30 days on kept points.** It stands under every option. A card of its own if wanted.

## How to verify, once built

- Change the address on a ZZ test job to a made-up street address and open the Pipeline. The
  function log shows one `geocode-address-batch` call and no *OpenStreetMap gave no plain answer*
  line.
- `geocode-one`'s answer for a new address reads `source: "google"` or `source: "census"`.
- The remembered misses and **Try again** behave as #408's check describes.

## How this was read

- The function logs through the Management API, `source = 'function_logs'` for the console lines
  and `function_edge_logs` for the calls, as `scripts/pg-logs.sh` reads `postgres_logs`. Counts and
  times only. No address was printed.
- OpenStreetMap was asked once, by hand, for a public landmark. It was not asked in a loop.
- No real record was read or changed.
