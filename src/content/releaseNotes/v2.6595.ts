import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6595',
  date: '2026-11-06',
  title: 'Done when…: the lines a task card is done by, ticked one at a time',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary', 'estimator', 'subcontractor', 'helpers'],
  highlights: [
    'The ＋ Task dialog has a Done when… section: one line a row, each the thing that has to be true. The Roadmap’s Add task takes the same lines, and Checklist → Manage → Edit changes them later.',
    'On Checklist → Today and the Dashboard’s My Inbox, a card with lines draws them under its title as boxes, the next one ringed in amber, with who ticked each and when. The line above them reads 2 of 3 done when…, and on the desktop rows that count is a chip that opens the lines.',
    'Ticking the last line finishes the card the way the tick box did: the completion notice, the Review queue, the next repeat. A reopened card starts its lines over; the thread keeps who ticked what.',
    'Every tick and untick is a line on the card’s thread, ✓ or ○ with the line’s words.',
  ],
}

export default note
