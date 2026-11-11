import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6940',
  date: '2026-11-11',
  title: 'An agent on the dev seat can fix a payment on a job and combine two jobs',
  kind: 'feature',
  highlights: [
    'A dev’s agent can now take a payment off a job, record one, or tie one to the bank deposit that paid it. It uses the same doors as the Job window and Accounts Receivable, and it must give a reason to take a payment off. The reason shows on the job’s activity.',
    'The agent can also combine one job into another, as Pipeline’s Combine does. The source’s numbers stay on the kept job as prior numbers.',
    'Before either change the agent reads a plan in words: what stands behind the payment, what the job will read as paid afterwards, what will move in a combine, and every reason it would stop.',
    'The plan warns when both jobs show a payment for the same money, and says to take the extra one off first. A combine cannot be undone, so the agent has to say so before it runs.',
  ],
}

export default note
