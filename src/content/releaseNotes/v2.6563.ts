import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6563',
  date: '2026-11-05',
  title: 'A checklist question can need a signature: the author ticks it, the crew signs the answer on a sheet that says what they are claiming, and a signed row locks until it is taken back with a reason (punch list #237, PR 2)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent', 'estimator', 'helpers', 'subcontractor', 'primary'],
  highlights: [
    'Every add box, on the phone, on the job’s Documents tab and on Settings, has Needs a signature beside Asks for a photo. Use it where a wrong answer costs a wall or an inspection.',
    'On such a question, Yes, No or Not here opens a signature sheet that says what you are signing, where it goes and who reads it, takes your name and your mark, typed or drawn, and the line I did this check myself and the answer is true. Not here signs too.',
    'A signed row locks and shows the mark with the name and the time. Take it back asks why, keeps the old answer and its mark under the question as Taken back, and opens the question again.',
    'A signature on one bar of signal waits on the phone with the other presses and sends by itself when the signal is back.',
  ],
}

export default note
