import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7263',
  date: '2026-11-14',
  title: 'Punch list: a search field finds a card by its number, its name or a word',
  kind: 'feature',
  highlights: [
    'The Punch list page has a search field beside the View choice. The cards narrow as you type, in By group and By number alike.',
    'A search finds a card by its number (#343 or 343), its name, its summary, its Next line, a shipped version (v2.7150) or its group’s name. Case and accents do not matter.',
    'The search works with the Show filters, Waiting on a mock-up and the group chips. When nothing matches, the page says so and offers to clear the search. One press on × or Escape empties the field.',
    'The address carries the search (/punch-list?q=ledger), so a link opens on it. On a phone the field takes its own line under the View choice.',
  ],
}

export default note
