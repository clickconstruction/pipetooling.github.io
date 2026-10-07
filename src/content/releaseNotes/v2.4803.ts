import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4803',
  date: '2026-10-07',
  title: 'A check Stripe already holds moves to the right job in one press',
  kind: 'feature',
  highlights: [
    'On the Bill tab, a check that was marked paid in Stripe on the wrong job now has Move to job… in its ⋯ menu. The window says what will happen in order: a credit note reverses the Stripe mark, this job’s bill goes back so a fresh bill can go out, the check lands on the job you pick, and both jobs get the grey moved line.',
    'The check lands on the other job’s one open bill with room for it, held for seven days like any check, or under Other money when there is no such bill.',
    'The credit note in Stripe and the trail on the job now say why: “Moved to J922 · wrong job”, not “payment did not clear”.',
    'If a step fails after the credit note, the window says exactly what is done and what is left to do by hand.',
  ],
}

export default note
