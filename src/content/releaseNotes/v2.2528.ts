import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2528',
  date: '2026-08-31',
  title: 'Robot takeoffs finish themselves',
  kind: 'feature',
  highlights: [
    'When a robot estimator completes a takeoff, one server call now imports it into CountTooling, marks it ready for review, creates the share link, and opens the audit — no script to run by hand.',
    'Every robot takeoff arrives stamped with its bid number automatically, so the Audits tab and CountTooling always agree on which bid a takeoff belongs to.',
  ],
}

export default note
