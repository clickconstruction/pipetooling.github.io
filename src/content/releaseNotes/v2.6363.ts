import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6363',
  date: '2026-11-02',
  title: 'A job photo is filed in Drive like a report’s',
  kind: 'feature',
  highlights: [
    'The photo sweep now files a job photo too: once you press Add, it lands in the job’s photo folder in Drive within five minutes, named by the day, who took it and your words, and the app keeps where it went.',
    'A job photo the sweep could not file says why on its row, as a report’s does, and is tried again every run.',
    'The job window’s In the folders list names such a file as a job photo. The window that adds them is the next release.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'helpers', 'subcontractor'],
}

export default note
