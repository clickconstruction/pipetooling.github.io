import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2568',
  date: '2026-09-01',
  title: 'Pipeline polish: Follow-ups badge + ready-to-bill bar lands right',
  kind: 'fix',
  highlights: [
    'The outstanding count on the Jobs → Pipeline Follow-ups button now sits as a small badge on the button\'s top-right corner — the familiar notification style — instead of inline next to the label.',
    'Tapping the orange "ready to bill — send them" bar now reliably lands on the Ready to Bill section: it used to scroll before the board finished loading, so the sections above would grow and push the target back off screen.',
  ],
}

export default note
