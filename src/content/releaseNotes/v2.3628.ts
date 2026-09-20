import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3628',
  date: '2026-09-19',
  title: 'Prospects access for an estimator is a dev\'s call — and now the database says so',
  kind: 'fix',
  highlights: [
    'An estimator sees Prospects only when a dev ticks "Prospects access" on their row in Settings → Active accounts. The screen always worked that way; the database did not check, so an estimator who knew how could have switched it on for themselves. Now only a dev can change it.',
    'Nothing changes on screen. Devs edit the box exactly as before; saving an estimator\'s name or trades without touching the box still works.',
    'This is the same protection the Hiring board grant, training mode and roles already have.',
  ],
}

export default note
