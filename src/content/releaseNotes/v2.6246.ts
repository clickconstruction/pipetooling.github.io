import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6246',
  date: '2026-10-31',
  title: 'Filing a signed statement names the day in words (punch list #220)',
  kind: 'fix',
  highlights: [
    'After File the signed copy, the green line reads the signing day as Oct 30, not as the typed 2026-10-30.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
