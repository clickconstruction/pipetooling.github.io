import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5628',
  date: '2026-10-19',
  title: 'A quick reply can carry the bill: the {bill} blank',
  kind: 'feature',
  highlights: [
    'A quick reply can now hold {bill}. When the line goes from a job, the app fills it with the pay page of the job’s newest bill, so “here is a copy of your last invoice” is a link the customer opens to see the bill and its Pay button.',
    'It fills in the job window’s box, in the customer’s sheet on the Pipeline, and in Tell the customer. The editor’s chips offer it beside {amount}.',
    'A bill not billed through Stripe has no pay page, so the blank stays and the box asks you to fill it or take it out; Attach can add the bill’s copy from the job’s files instead.',
  ],
}

export default note
