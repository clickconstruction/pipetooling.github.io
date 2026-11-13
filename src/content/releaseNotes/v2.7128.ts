import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7128',
  date: '2026-11-13',
  title: 'Punch list: a burndown shows the open cards hour by hour, and when the list could clear',
  kind: 'feature',
  highlights: [
    'The Punch list page opens with a Burndown. It draws how many cards were open at each hour since late September.',
    'Two lines run on from now. One shows when the list clears with no new cards. The other shows where it heads at the pace of the stretch you pick.',
    'A second chart shows new cards and closed cards in waves, and a table shows how fast each group empties.',
    'You can count by cards or by points, which weigh a card by its size. The numbers come from the list itself and update with each deploy.',
  ],
}

export default note
