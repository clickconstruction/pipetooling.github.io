import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4275',
  date: '2026-09-30',
  title: 'Accounts Receivable: All reads by what happened last',
  kind: 'feature',
  highlights: [
    'Under All, the deposits touched in the last 30 days come first, newest action on top, under a heading for the day: Today, Yesterday, Mon 9/28. A cheque moved today sits at the top even when it was banked weeks ago.',
    'Everything older follows by bank date, as before, under one heading.',
    'Apply & next follows the order on screen.',
  ],
}

export default note
