import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2426',
  date: '2026-08-28',
  title: 'Digital twin accounts',
  kind: 'infra',
  highlights: [
    'Accounts can be flagged as digital twins — agent-operated testers that sign in with real role permissions. A persistent 🤖 banner marks every twin session, and Active Accounts shows a twin chip.',
    'Twin activity is attributable everywhere (it rides the account), and twins start in read-only training mode by convention.',
    'Dev login gains a twin alias: ?as=twin:estimator (or twin:estimator:2) signs in as that twin instance.',
  ],
}

export default note
