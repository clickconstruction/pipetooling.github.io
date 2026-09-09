import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3203',
  date: '2026-09-09',
  title: 'Counts bid picker: the count-row column no longer under-counts busy bids',
  kind: 'fix',
  highlights: [
    'The Counts tab\'s bid picker shows how many count rows each bid has. Past a certain amount of counting company-wide, some bids showed a low number or none at all; every bid now shows its real count.',
    'The "N count rows" preview when adopting a bid into a package had the same gap and is fixed the same way. If that list fails to load, the modal now says so instead of showing no bids.',
  ],
}

export default note
