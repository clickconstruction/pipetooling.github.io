import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5026',
  date: '2026-10-09',
  title: 'Submittals: send the review link from the app',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On the Share step, Send the link beside a person emails them their own link to the review room, from the company. You can add a line of your own.',
    'The Share window has a box, Email each person their link. Unticked, no email leaves the app.',
    'A bid starts with the box unticked. Once you have sent a link there, it starts ticked.',
    'Each email is kept as a sent copy, and the person’s line reads link sent with the day.',
  ],
}

export default note
