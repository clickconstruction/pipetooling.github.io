import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3322',
  date: '2026-09-11',
  title: 'The attorney\'s portal works both ways: fees, steps, payments received, questions',
  kind: 'feature',
  highlights: [
    'On a matter\'s Fees & steps tab the firm can add a fee or cost, record a step (demand sent · suit filed · judgment · settled), record a payment it received, and ask the office a question. Fees roll into the total demand; a step moves the account\'s ⚖ chip on the Pipeline.',
    'Everything the firm does shows up on the Dashboard as "The law firm has N things for you" (office roles) and on the desk\'s Fees & steps tab marked "waiting on the office".',
    'From the desk: answer a question inline (the firm sees the answer on their portal), acknowledge a fee or step, and for a payment received — apply it on the job with Mark Paid, then Mark applied records the recovery and the firm\'s contingency as a legal cost.',
    'The firm still cannot mark anything paid, edit a job, or email a customer through Click.',
  ],
}

export default note
