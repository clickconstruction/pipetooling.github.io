import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2392',
  date: '2026-08-27',
  title: 'Cover Letter: offered alternates reach the letter on simple bids',
  kind: 'fix',
  highlights: [
    'A price option offered as an alternate on the Pricing tab now shows up in the New cover letter even when the bid has no send-packets — ★ base leads, the offered price lists under Alternates, exactly what "On their letter · alternate" promises.',
    'Before, the New letter silently ignored offers on simple bids (the Old view showed them, New didn\'t — the confusion Wendi screenshotted).',
    'The "In this cover letter" line names the offered alternates, and the Same page / Separate pages toggle appears for them too.',
  ],
}

export default note
