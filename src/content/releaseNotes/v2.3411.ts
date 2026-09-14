import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3411',
  date: '2026-09-14',
  title: 'Pipeline: a red “% done” box on billed jobs with no percent',
  kind: 'feature',
  highlights: [
    'Once a bill has gone out on a job — it sits in Billed Awaiting Payment or Collections, or it is still Working with a break-off bill already sent — and no % done is recorded, the empty box on Jobs → Pipeline wears a red outline and a red line under it says when the bill went out — “Bill sent Sep 2 · set % done”.',
    'Type any number and it clears; 0 counts. A draft still in Ready to Bill does not turn the box red, and Paid jobs never show it.',
    'The phone card list shows the same red box, and so do people who can see the board but not edit the percent.',
  ],
}

export default note
