import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3802',
  date: '2026-09-24',
  title: 'Hiring: Share with… on a column',
  kind: 'feature',
  highlights: [
    'Each Hiring column header now has a ⋯ menu with Share with… — tick the assistants (anyone with Prospects access who does not hold the Hiring board) who should work that one column. Each tick takes effect at once; the header reads “shared with 1” afterwards.',
    'Delete column moved into the same ⋯ menu; it still asks you to confirm and still refuses while candidates are assigned.',
    'Settings → Active accounts → Edit shows a line under the Hiring checkbox naming the columns shared with that account and who shared them.',
    'The person you shared with gets their trimmed Hiring tab in the next release; the rules are already enforced.',
  ],
}

export default note
