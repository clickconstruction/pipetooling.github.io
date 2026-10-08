import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4902',
  date: '2026-10-08',
  title: 'Accounts Receivable: a check that was never deposited becomes a case',
  kind: 'feature',
  highlights: [
    'A payment typed in as a check that has no deposit linked after ten days now opens a case under Came back in Accounts Receivable. It reads never deposited and names the job that still reads paid.',
    'The case closes on its own when the payment is linked to its deposit or taken off the job. It can also be closed by hand as paid another way or not coming.',
    'The office hears about each new one once, the way a returned check is told.',
    'Eight checks from August and July will be under Came back the morning after this goes live. Six are $250 pretest and post checks from Aug 19 to 21.',
  ],
}

export default note
