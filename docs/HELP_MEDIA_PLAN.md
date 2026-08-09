# Help guide screen recordings — plan and conventions

> The five screen recordings worth adding to `/help` guides, with capture scripts and the exact `{{gif:}}` lines to paste once each file lands in `public/help/`. Also the standing conventions for any future recording. Static screenshots are deliberately NOT used in guides — see Conventions for why.

last_updated: 2026-08-09

## Conventions (apply to every recording)

- **Recordings, not screenshots.** A guide illustration is either a mock-UI token (preferred — zero maintenance, theme-aware, CI-validated) or a short screen recording where spatial layout / motion can't be conveyed in tokens. Never a static PNG: they rot fast, don't adapt to dark mode, and freeze real data.
- **Capture from the read-only training account** (`users.read_only`) — writes are blocked at the DB, so nothing can be mutated on camera, and you control what data is visible. Never record real customer money detail a lower role shouldn't see; the guide audience is every role listed in its frontmatter.
- **Light theme**, phone-width viewport for phone-first flows, desktop width otherwise. 10–20 seconds, no audio, end on the completed state.
- **File goes in `public/help/`**, named after the guide slug (`<slug>.gif`). GIFs are lazy-loaded and excluded from the service-worker precache (see `vite.config.ts`) — keep each under ~3 MB so they load acceptably in the field.
- **Re-record when the surface changes** — same rule as text: docs ship with features. If your PR visibly changes a recorded surface, re-capture in the same PR or delete the token until someone can.
- Token syntax: `{{gif:<file>|<caption>}}` (see `src/lib/helpGuideIllustrations.ts`).

## The five recordings

Chosen for traffic × spatial complexity — flows where "where is it / how does it move" beats any prose.

### 1. Bill a customer from the Pipeline
- **Guide**: `ready-to-bill-pipeline.md` · desktop width
- **Script**: Jobs → Pipeline → a job in Ready to Bill → Bill Customer → walk the modal to the (unsent) preview → close.
- **Paste when captured**: `{{gif:ready-to-bill-pipeline.gif|Billing a Ready to Bill job from the Pipeline}}`

### 2. Drag-assign on Schedule Dispatch
- **Guide**: `schedule-dispatch.md` · desktop width
- **Script**: Schedule → place a job card onto a person's day, show the linked-crew highlight, then move it to another day.
- **Paste when captured**: `{{gif:schedule-dispatch.gif|Placing and moving a job on the dispatch board}}`

### 3. Assign work from Dispatch Mode
- **Guide**: `dispatch-mode.md` · phone width
- **Script**: Schedule tab → blue **+** → pick job → tap day → tap people (show the free-time ribbons) → pick a suggested window → Schedule.
- **Paste when captured**: `{{gif:dispatch-mode.gif|Assign work in Dispatch Mode: job, day, people, window}}`

### 4. Clock in and file a report in Job Mode
- **Guide**: `job-mode-clocking.md` · phone width
- **Script**: Dashboard in Job Mode → Clock In (pick the job) → Job Report button → photo + note → send.
- **Paste when captured**: `{{gif:job-mode-clocking.gif|Clocking in and filing a job report from the field}}`

### 5. Takeoff: counts to assembly
- **Guide**: `create-an-assembly-while-doing-a-takeoff.md` · desktop width
- **Script**: Bids → Takeoffs → add a count with the numpad → open assembly authoring → save → show it applied.
- **Paste when captured**: `{{gif:create-an-assembly-while-doing-a-takeoff.gif|Counting a fixture and saving an assembly mid-takeoff}}`

## Status

| Recording | Captured | Wired into guide |
|---|---|---|
| Ready to Bill pipeline | ☐ | ☐ |
| Schedule Dispatch drag-assign | ☐ | ☐ |
| Dispatch Mode assign work | ☐ | ☐ |
| Job Mode clock + report | ☐ | ☐ |
| Takeoff assembly | ☐ | ☐ |

(The one existing recording, `settings-basics.gif` in `settings-basics.md`, predates this plan and stays.)
