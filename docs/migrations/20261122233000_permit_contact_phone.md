# 20261122233000_permit_contact_phone.sql (2026-11-22, v2.8296)

Permits: the phone on a permit is kept, and one read says which names on permits share a phone or a web domain with one of our customers ([v2.8296](../recent-features/v2.8296.md); two of the things punch list #307 left when it closed). One column, one index, three functions. No table, policy or grant on a table changes.

## Why

Austin's feed names the contractor's phone on almost every permit. The pull kept the whole record in `permits.raw` and mapped no phone, so nothing could read it. #307 planned the phone as a second way to tell whether a name on permits is one of our customers, and left it unbuilt with *the phone is not kept*.

## Read on prod before writing

Read-only, 2026-11-22.

| What | Count |
|---|---|
| Austin permits held | 4,928 |
| With a contractor's phone in `raw` | 4,898 |
| Austin names with a phone | 1,339 of 1,346 |
| Names one phone sits under | one for 1,298 phones, two for 12, never more |
| Our customers holding a phone | 433 of 510 |
| Customer and name pairs sharing a phone today | 3 |
| Names with a looked-up phone or website | 30 and 29 (Places), 21 phones (the call list's lookups) |

The feed writes most phones as ten digits. It also writes three digits (118 rows), twelve (74) and nothing (30). New Braunfels, San Marcos, Seguin and San Antonio give no phone.

## What it adds

| Object | What it does |
|---|---|
| `permits.contact_phone` | The phone the feed lists for whoever `contact` names, as ten digits. Null where the feed gives none. |
| `permits_contact_phone_idx` | `(builder_key) WHERE contact_phone IS NOT NULL`: a name's phones are read by its key. |
| `permit_phone_digits(text)` | A US phone as ten digits, or null. An extension and a leading 1 are dropped. Fewer or more digits, or one digit ten times, is no phone. `IMMUTABLE`, closed to anon. |
| `permit_contact_domain(text)` | The domain a company answers from, off an email or a website, cut to its last two labels. Null for a mail service anyone can sign up for and for a site that hosts everyone's page. `IMMUTABLE`, closed to anon. |
| `permit_name_contact_matches(p_customer_ids uuid[] DEFAULT NULL)` | Every customer and name on permits that share a phone or a domain: `customer_id, builder_key, reason` (`phone` or `domain`), `value`, `heard_from` (`permit` or `lookup`). `SECURITY INVOKER`, `STABLE`, closed to anon. |

### The rows already held

One `UPDATE` fills Austin's rows from `raw`. Austin's contact is the contractor's company, else the applicant's, else the contractor, else the applicant, and the phone is the same party's. It writes only rows with no phone yet, so a second run writes nothing. The pull writes the column from here on (`permitRowFromAustin`).

### What the read holds against what

- **Ours**: `customers.contact_info` (phone and email), `customers.billing_email`, `customer_contact_persons` (phone and email), and the contacts spine's channels, where a contact points at the customer or at one of its people.
- **Theirs**: `permits.contact_phone` by `builder_key`, a Places lookup's phone and website (`permit_lookups`, company lookups that found a place), and the call list's looked-up phones (`builder_lookups`), less any whose newest check says **wrong**.
- **A value under more than three names, or held for more than three customers, ties nobody.** It is a permit service's number or a shared office's.
- **Nothing is tied by this read.** It lists evidence. A person still presses.

## Two copies of each rule

`permit_phone_digits` and `permit_contact_domain` each have a twin in `supabase/functions/_shared/permitLookup.ts` (`phoneDigitsOf`, `contactDomainOf`), since the pull and the client need the same answers. `permitLookup.test.ts` and the bed ask both the same lists, and the test fails when the migration's list of shared domains differs from the client's.

## The client

Nothing reads any of this yet. Find their names and Compare are their own PR, armed after this file is pushed.

## Tested

- **A throwaway local Postgres 15** with stand-in tables: this file applied twice, then the backfill, both rules' lists, and the read's pairs, each as written below.
- **`npm run test:pg:permit-name-contacts`**, a new bed on the whole schema. It writes Austin rows as the pull stored them before the column, runs this file again so its own statement fills them, and once more to change nothing. The probe:
  - each row's phone is its contact's party's, and three digits, one digit ten times and a row with nobody named keep none;
  - a San Antonio row is not read;
  - a customer and a name are paired by a phone on a permit, by a looked-up website against an email's domain, and by a phone on the contacts spine;
  - a phone under four names, a lookup that found nothing and a looked-up phone said wrong tie nobody;
  - a helper reads no pair, and anon runs none of the three.
- Docker is not ours on this Mac, so the PR's `sql-beds` check is the bed's proof.

## Release order

`supabase db push` after the merge, then `supabase functions deploy permit-pull`. Either order is safe: deployed ahead of this file, the pull drops the column from its upsert and carries on.

**Applied** to prod by 2026-11-23: `npm run check:migration-drift` read 1,454 versions applied against 1,454 local files, this version among them (read in the docs pass after #9274); types regenerated in #9435.
