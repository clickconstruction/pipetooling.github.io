import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5910',
  date: '2026-10-26',
  title: 'The crew’s job window gets the bar on a phone',
  kind: 'feature',
  roles: ['subcontractor', 'helpers', 'superintendent', 'estimator', 'dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'A helper, a sub or a superintendent opening a job on a phone now gets a bar at the bottom of the window that stays put while the window scrolls: Arrived or Leaving, Leave report, and Note. Before, Arrived, Leaving and Post note were small chips under the note box, a scroll away.',
    'Arrived and Leaving write the same note they always did, and Leaving still opens Update Focus. The bar offers the one you are due: Arrived until you press it or clock in on the job, then Leaving, then Arrived again for when you come back.',
    'Note opens the note box as a sheet at the bottom of the screen with the keyboard under it and Save beside it. Saving posts the note to the job’s thread exactly as Post note does, and the sheet closes.',
    'Every button on both windows’ phone bars now stands 48 px tall, a thumb’s press. On a computer nothing changes.',
  ],
}

export default note
