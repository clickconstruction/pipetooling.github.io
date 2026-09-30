import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4202',
  date: '2026-09-30',
  title: 'Pricing solves the base; Labor splits materials too',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On a bid with an alternate, the Workbench solver gets a Solve for row — Base, the alternate, or the whole bid. “Get the base to $50,000” is one move; the alternate keeps its own prices.',
    'The margin slider and the target total mean the scope you picked: the base’s margin, the base’s cost floor. Base is the default, since that is the number the letter leads with.',
    'Labor’s with-and-without card gains a Materials row from the same takeoff coverage Takeoffs shows, and a Direct cost line per column.',
  ],
}

export default note
