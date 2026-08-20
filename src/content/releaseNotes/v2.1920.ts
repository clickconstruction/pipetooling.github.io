import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1920',
  date: '2026-08-20',
  title: 'Follow-up queue loads reliably',
  kind: 'fix',
  highlights: [
    'The job follow-up counter and review deck compute their "quiet days" much faster — the lookup that sometimes timed out (and silently hid the banner) now answers in a fraction of the time.',
    'Returning to the Dashboard reuses the recent follow-up count instead of recomputing it every visit; opening the review deck always fetches fresh.',
  ],
}

export default note
