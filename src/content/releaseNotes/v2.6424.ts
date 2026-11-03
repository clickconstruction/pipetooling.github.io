import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6424',
  date: '2026-11-02',
  title: 'People → Licenses shows the expired licenses first',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'An Expired section now sits above the 30-day strip. Each row says how many days ago the license lapsed, the most recent first.',
    'Press a name in either section to open that person’s licenses in the list below.',
    'Before this, a license past its expiry showed nowhere on the tab, and the strip said nothing expires.',
  ],
}

export default note
