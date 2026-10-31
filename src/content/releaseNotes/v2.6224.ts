import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6224',
  date: '2026-10-31',
  title: 'The morning run fills {amount} and {bill} itself, so the Paid reminder can go on Sends',
  kind: 'feature',
  highlights: [
    'Each morning the app reads every residential customer’s bills the way the message box does and fills {amount} with what is still open on the job’s newest open bill, {bill} with that bill’s own pay page, and {number} with the job’s number. The Paid reminder now goes with the real figure and the real link.',
    'A customer with no open bill on the job, or a bill billed outside Stripe with no pay page, still waits as before: on Sends the text is kept back naming the blank, on Offers Today’s sends holds it with the door to the thread.',
    'Settings → Flows: the office may now move the Paid step from Offers to Sends. Nothing with a blank left ever reaches a customer.',
    'Punch list #124, Stage texts from the Pipeline, is closed with this.',
  ],
}

export default note
