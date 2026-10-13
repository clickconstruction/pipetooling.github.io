import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5488',
  date: '2026-10-13',
  title: 'Accounts Receivable: each job says whether a lien notice is out and where it stands',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Under each bill in the Dashboard’s Accounts Receivable window, a chip in the Lien desk’s own words says where the job’s lien paper stands: a notice waiting on the leader and its mail-by day, one in the mail owing its number, one delivered and signed for with letter two’s day count, a lien filed and served, a window that closed. The sentence after the chip says the rest.',
    'Press the chip to open the Lien desk on that job, or the job’s Lien window when the next step lives there.',
    'The customer’s row wears the worst state among its jobs, and two new lenses above the list, Lien paper due and Paper out, narrow the customers the way the pace pair does.',
    'A job with nothing out and nothing due inside 30 days shows no chip; the Pipeline’s dates ledger keeps the far date.',
  ],
}

export default note
