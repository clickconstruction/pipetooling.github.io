---
name: "Job form: the address pins itself"
number: 95
group: ready
status: PR 1 built 2026-10-07 (v2.4783, the line and the county in the geocoder's answer); PRs 2 and 3 next
summary: >
  149 property records have no point, so no court map can place them, and the Map page only pins
  what it is opened for. The owner (2026-10-07): geocode when someone puts in an address in the
  new job and edit job modals, tastefully. One more quiet line under the Job address, ON THE MAP,
  in the voice of the ON STATEMENTS line already there: it pins the address by itself on blur or a
  pause after a whole-looking address, says the county it landed in so a wrong pin is seen at the
  desk, and never blocks a save. The precinct nightly carries the backlog.
next: PR 2 — the geocoder's county onto a linked property record that has none; PR 3 — the nightly geocodes up to 300 unplaced property addresses before it classifies.
size: M (PR 1), S, S
blocker: none — geocode-one needs a redeploy after PR 1 merges for the county to show; without it the line reads placed.
opinion: ship each alone; the line is useful on its own tonight.
---

# Job form: the address pins itself

Mockup: `mockup-on-the-map.html` (the four states, the rules, the plan, the second look). PR 1 is [v2.4783](../../docs/recent-features/v2.4783.md).
