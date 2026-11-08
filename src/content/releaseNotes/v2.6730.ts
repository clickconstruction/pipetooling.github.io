import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6730',
  date: '2026-11-08',
  title: 'My email: your mail with the job’s people, right on the job and the bid',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A job window now shows a line under Where it stands: Your mail with Dale Okafor, and the conversations in your own Gmail with the job’s people that are not on this job yet, up to three. Press Yes on one and the whole conversation lands on the job, as the My email tab’s Yes does.',
    'A thread narrowed to one job, the way the Bid Board opens a GC’s thread on a bid, shows the same line above the reply box for that person and that bid.',
    'The line is read from your Gmail as the window opens and kept nowhere. Nothing counts, nothing nags, and a job with no mail draws no line. If your switch is off, or your address is not one the app may read, there is no line at all.',
    'All your mail with Dale › opens the My email tab searched on the same people and the job’s number.',
  ],
}

export default note
