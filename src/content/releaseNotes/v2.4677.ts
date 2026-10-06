import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4677',
  date: '2026-10-05',
  title: 'Legal: the statement of account adds up to the balance',
  kind: 'fix',
  highlights: [
    'The statement on the Legal desk, the firm\'s portal and both printed packets runs a balance down the page, and its last line is the balance owed.',
    'A bill with an agreed write-down shows what was billed, with the write-down beneath it, so the reduction is counted once.',
    'A payment recorded on the job with no bill now lowers the balance, by the same rule the bill tab and the customer\'s page use.',
    'The firm\'s total demand leaves out its own contingency on a recovery you applied, and the lines say how a bill went out and how a payment came in, in plain words.',
  ],
}

export default note
