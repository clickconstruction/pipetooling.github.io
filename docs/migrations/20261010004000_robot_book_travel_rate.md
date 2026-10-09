# 20261010004000_robot_book_travel_rate.sql (2026-10-09, v2.5034)

Travel in the robot book at the owner's rate, the owner's call of 2026-10-09: **$0.70 a mile, round trip, once per job day.** It replaces the interim rule, which priced travel at the lesser of $80 × miles and 10% of the building subtotal. It also closes the travel-bands question.

## What it does

One `UPDATE`, data only. It touches the 🤖 Robot Default book's global version (`price_book_versions.is_robot`, `bid_id IS NULL`) and its one entry of fixture type `Travel & Rentals (per mile from office)`.

| | Rough-in | Top-out | Trim-set | Total |
|---|---|---|---|---|
| Before | $80.00 | $0.00 | $0.00 | **$80.00** a mile |
| After | $1.40 | $0.00 | $0.00 | **$1.40** a count |

**The arithmetic.** A count is one mile from the office for one job day. The crew drives it both ways, so it costs $0.70 × 2 = **$1.40**. The robot rows the entry once, at count = miles from the office × job days (`docs/twins/PLACEMENT.md`).

- A job 45 mi out that takes 12 job days: count 540 × $1.40 = **$756**.
- **Brownsville**, the before: the $80 rate put **$23,464** of travel on a ~$49k proto at 293 mi, and the auditor answered *"charging 50% for traveling is actually crazy work"*. At the owner's rate the same 293 mi is **$410.20 a job day** (293 × $1.40).

The fixture's name stays, so past bids' rows that match by name still match. Each bid's own robot copy (`bid_id` set) keeps the price it was bid at. `SET lock_timeout = '3s'` comes first. The `WHERE` skips a row already at the new price, so a second run changes nothing.

## Push

Punchlist pushes it after merge. The robots read the new rule from `get_placement_guide` once `twin-mcp` is redeployed with the regenerated briefs. They read the new price from `get_robot_book` once this is pushed. Until both land, a robot following the new rule against the old $80 would overprice. So the push and the redeploy go together, push first.

## Verify after the push

- `get_robot_book` lists `Travel & Rentals (per mile from office)` at **1.40**.
- Read-only: `SELECT e.total_price, e.rough_in_price FROM price_book_entries e JOIN price_book_versions v ON v.id = e.version_id JOIN fixture_types ft ON ft.id = e.fixture_type_id WHERE v.is_robot AND v.bid_id IS NULL AND ft.name = 'Travel & Rentals (per mile from office)'` reads `1.40 | 1.40`.

## Checked before the PR

On Homebrew Postgres 15, applied twice, the robot book's global travel entry moved to $1.40. A bid's robot copy, an office book's entry of the same fixture, and the robot book's *Equipment Rentals* stayed as they were.
