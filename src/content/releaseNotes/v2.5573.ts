import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5573',
  date: '2026-10-16',
  title: 'Job Mode: On my way clocks the drive and texts the customer, and I’m here marks the arrival',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers'],
  highlights: [
    'The big green button on Job Mode now reads On my way. One press clocks you in on the next job as on the way and texts the customer the office’s line, after you read it in the orange box. The minutes are guessed from your phone to the job, rounded up to the next five; change them or type your own.',
    'While you drive the button reads I’m here. One press marks you on site, and when the customer can be texted it offers the office’s I’m here line first. The header reads On the way with the minutes, then On site since with the drive.',
    'When a text cannot go, the sheet says why under What happens and the button promises only the clock-in. Start here instead clocks you in on site when you are already at the door. A guessed arrival past the window gets a line that points at Running late.',
    'The office owns both lines: the quick replies editor’s phone block gains a Big button on Job Mode picker. Each visit’s clock session now carries when the drive began and when you arrived, so the drive is honest for the first time.',
  ],
}

export default note
