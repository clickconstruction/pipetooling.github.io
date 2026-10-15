import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5544',
  date: '2026-10-14',
  title: 'GC projects: a project’s card starts with its facts and its doors in sets',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The top of a project’s card used to mix the address with every button in one long line. Now the name and the stage come first, and a second line says where the job is, how big it is, who it is for, who drew it and when the bid is due or the job started.',
    'The buttons that open a window sit on the right in three sets: the job’s own (The plans, Papers, Questions about the plans, A new set of plans came in, Schedule), the work being built (Get started, Daily log, Punch list, Submittals, RFIs, Draws) and the money team’s (Change orders, Bill the customer, Bill day, Closeout, Our number, Bid tabs).',
    'A button carries the fact that says whether to open it: Questions about the plans · 1 open, Daily log · 2 missed, Bill day · 5 of 7, Bid tabs · 2.',
    'This is the first of four changes to the card. The next three move how the stage is going, the trades and the plans into bands that read in the order you ask about them.',
  ],
}

export default note
