import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5858',
  date: '2026-10-25',
  title: 'The Collect desk, PR 7 of 7: Friday, did the week move',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Once the week’s plan is recorded on Collect, the desk opens on a green card: how much of what the plan asked for landed, how much of that landed after a call, how many of the calls ended with a date, whether the notices were drafted, signed or mailed, and what Monday carries.',
    'A payment within seven days of a recorded call counts as after a call; a payment on its own pace does not, so one pay application paying on its run never flatters the week. A statement is never counted as a call. A payer that paid off and left the sheet still scores.',
    'The three answers come from the records the app already keeps: payments, Payment Chase touches and the Lien desk. Nothing is typed into the card.',
  ],
}

export default note
