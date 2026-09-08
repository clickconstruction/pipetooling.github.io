import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3143',
  date: '2026-09-07',
  title: 'Won a bid? Hand the job to Dispatch in one press',
  kind: 'feature',
  highlights: [
    'Beside "Open the job" on a won bid there is now a quieter "Ask Dispatch to open it". One press files a to-do in the Dispatch inbox with the bid attached — "Open the job for B398 · ZZ Test — won with Southern Post" — and Dispatch gets the usual push.',
    'In the Dispatch inbox that to-do carries one button, "Open the job". It opens New Job filled in from the bid exactly as it would from the bid itself; press Create Job and the to-do closes on its own with the J number in its note, and whoever asked gets the "Handled" push.',
    'No doubles: asking again says Dispatch already has it, and a to-do whose job was opened another way closes itself.',
    'Primaries can mark a bid Won but have no New Job form. For them the hand-off is the only button, and marking Won in Edit Bid sends it to Dispatch automatically.',
  ],
}

export default note
