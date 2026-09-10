import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3233',
  date: '2026-09-10',
  title: 'The Desktop robot knows what to do when it gets stuck',
  kind: 'fix',
  highlights: [
    'A robot that can’t read a bid’s plans now parks that bid — it asks for the plans on the Bid Board, leaves its work open, and moves to the next bid. When someone taps “Attached — rerun”, the next batch picks that bid up first. Before, the instructions left it with no allowed next move.',
    'Its questions go to the right person: a question about the job lands on the estimator’s Standing rulings with one-tap answers; a problem with its own machine lands on the operator’s Console.',
    'A bid the robots aren’t allowed to take (another trade, a held-out reference) no longer stops the whole batch — the robot notes it and asks for the next one.',
    'A new chat checks for any unfinished robot work of its own before claiming a fresh bid.',
  ],
}

export default note
