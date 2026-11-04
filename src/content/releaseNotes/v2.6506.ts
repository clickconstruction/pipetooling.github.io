import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6506',
  date: '2026-11-04',
  title: 'Hand a conversation to someone by typing their name, with the office and estimators first',
  kind: 'feature',
  highlights: [
    'On Messages, the Take it pill’s list opens with a search box and the cursor in it. Type a name and the list narrows as you type, with the letters lit on the name. Enter hands it to the lit person, the arrows move the light, Escape closes.',
    'The list puts the office and the estimators first, then the owner and the devs, each group in name order, under a small heading. I’ll take it stays the first row while the box is empty, so Enter alone takes it.',
    'Sample accounts, the robots and the walk tester are off the list. Nobody hands a customer to a sample or a robot.',
    'On a phone the box is there too, but the cursor waits for a tap so the keyboard does not jump over the list.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
