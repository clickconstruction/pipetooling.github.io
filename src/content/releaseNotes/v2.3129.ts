import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3129',
  date: '2026-09-08',
  title: 'Housekeeping: database types regenerated after the e-sign consent ledger',
  kind: 'fix',
  highlights: ['No visible change. The app now knows the consent ledger table by name, so the signed record reads it without a workaround.'],
}

export default note
