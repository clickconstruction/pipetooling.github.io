import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5569',
  date: '2026-10-15',
  title: 'Settings → Training: turn a course on, say who must take it, and how long a pass is good for',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A new Settings tab lists every course the app ships. Turn a course on or off, tick the roles that must take it, and set how many months a pass is good for and how many days before the day the card turns amber.',
    'Where everyone stands: how many are current, lapsed and not done, with See who for the names and days.',
    'Everyone takes it again stamps today as the day before which no pass counts, after a confirm that says how many current people turn red. A changed lesson never voids a pass; this press is the one thing that does.',
    'The OSHA 30 refresher ships switched off. Turning it on is the first press.',
  ],
}

export default note
