import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6152',
  date: '2026-10-30',
  title: 'Training’s due date as a strip, with versions handled (punch list #217, a prototype behind a switch)',
  kind: 'feature',
  highlights: [
    'A Due strip switch on the Dashboard’s Training card draws each course as a thin strip from the day you passed to the day the pass runs out, the last thirty days shaded and today a tick on it, so in 4 days is a place you can see. The version you passed is named at the start.',
    'A course inside the window but not past its day reads due soon. A course past its day reads lapsed. A pass a dev voided with Everyone takes it again shows as its own case, cut at that day, so you can see why the course is back.',
    'On Settings → Training the same switch turns the counts into chips, current, due soon, lapsed and not done, each a press that filters See who, and each name gets the chip with its days and the strip.',
    'The switch is off until you press it and is remembered for you on this device. Nothing changes for anyone who leaves it off.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary', 'superintendent', 'estimator', 'helpers', 'subcontractor'],
}

export default note
