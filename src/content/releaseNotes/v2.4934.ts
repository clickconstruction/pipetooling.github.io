import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4934',
  date: '2026-10-09',
  title: 'GC mode: award and the statement of work, in the database',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The app can award a GC trade to one company’s quote. It checks the company’s vetting and approved limit against the quote’s all-in number first.',
    'An award drafts the trade’s statement of work from the quote: the price, a line per scope item, their own schedule of values and what they will not do.',
    'Our number’s old copy on GC projects is gone. Its own table has held it since yesterday.',
    'Nothing on screen changes yet.',
  ],
}

export default note
