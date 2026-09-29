import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4107',
  date: '2026-09-29',
  title: 'Submittals from the takeoff: tick the fixtures, and Rev 1 is built from the parts already under them',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'Stage 1 now shows the three places rows can come from — the takeoff, the Pricing picks, the plans’ schedule — with a count on each. A bid priced from a takeoff no longer reads “0 tags · 0 picked lines” with nowhere to go.',
    'Choose from the takeoff opens a pick list: one row per fixture, the part under it as the product, the house it came from. Fixtures and equipment start ticked; fixtures with no part yet and pipe, sawcutting and allowances start unticked. Untick what the GC does not need to approve; your ticks are remembered on the bid.',
    'Rows built this way read Proposed — what we intend to install — until the plans’ schedule is typed, which turns them into As specified or Alternate. A ticked fixture with no part yet lands as Missing, to type with Edit.',
    'On a draft, + Add from the takeoff… adds more fixtures (rows already on it are set aside), and × on any row takes it off — a row from the takeoff is unticked there too, so it stays out next time. The GC’s review room lists Proposed rows for approval.',
  ],
}

export default note
