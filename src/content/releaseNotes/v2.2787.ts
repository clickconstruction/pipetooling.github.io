import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2787',
  date: '2026-09-04',
  title: 'Contract library: a Scope tab for sub work orders',
  kind: 'feature',
  highlights: [
    'People → Contracts → Contract library has a third tab, Scope: the standing scope lines, exclusions, and signing confirmations a sheet\'s work order ticks from, one list per trade plus an all-trades list.',
    'Each line is a default (pre-ticked) or an ask (shown unticked); click to reword, arrows to reorder. Edits change future work orders only.',
    'Documents in the library can now be for Subs, and the Scope tab shows how many active subs have signed the current version of each.',
  ],
}

export default note
