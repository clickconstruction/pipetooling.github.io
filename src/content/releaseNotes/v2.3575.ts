import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3575',
  date: '2026-09-17',
  title: 'Job Summary: an in-progress job\'s revenue is what this window\'s hours earned',
  kind: 'feature',
  highlights: [
    'On Jobs → Job Summary → Jobs, an in-progress row used to show contract × % complete however many of its hours fell inside the window, so a 90-day view compared 90 days of cost against value earned over the job\'s whole life. Each approved field hour now earns its share of the contract, so the window\'s hours earn the window\'s share — the same rule the Bridge already uses.',
    'A job with every hour inside the window reads exactly as before. Finished jobs still show the contract. Hover a Revenue cell for the arithmetic; the Revenue* rule now sits under the table.',
  ],
}

export default note
