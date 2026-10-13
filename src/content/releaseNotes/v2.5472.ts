import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5472',
  date: '2026-10-13',
  title: 'Messages: save a file that came by email to the job’s Drive',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Open a message and press Save to Drive beside a file. It goes into the job’s Drive folder, so the job’s files show it.',
    'On a GC project, pick Team only or Plans. A quote goes to Team only, and a photo goes to the job’s photos.',
    'The row then says where it went, with Open in Drive.',
  ],
}

export default note
