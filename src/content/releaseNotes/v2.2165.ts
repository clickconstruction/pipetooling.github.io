import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2165',
  date: '2026-08-23',
  kind: 'feature',
  title: 'Partners: a Statement link in the top bar',
  highlights: [
    'Partners now have a receipt icon beside the home icon (and a Statement entry in the menu) that opens their statement from any page. Only partner accounts see it.',
    'A small amber dot on the icon — and a "sign-off waiting" tag in the menu — says last week’s statement is waiting on your acknowledgment; it clears as soon as you acknowledge.',
    'Fix: partners who are estimators can now open the statement page from their Dashboard card (it was limited to field-crew accounts).',
  ],
}

export default note
