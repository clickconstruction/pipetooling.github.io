import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5581',
  date: '2026-10-16',
  title: 'Prospects: an empty lane names its control, and the clock waits for a card',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'An empty lane now says Nobody on Subs yet. New Prospect adds the first company, with New Prospect as the press. On a trade filter it says No subs for Fire sprinkler, with All subs as the press.',
    'The this call clock starts when a card is on the screen. Before, it counted on an empty lane and stamped those minutes on the first company added.',
    'A card never called no longer shows a bare Due chip beside never called.',
  ],
}

export default note
