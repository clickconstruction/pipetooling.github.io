import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6084',
  date: '2026-10-29',
  title: 'Stage checklists: the crew fills them on the phone (punch list #164, PR 3)',
  kind: 'feature',
  highlights: [
    'Job Mode’s details and the job window, under the address, list the job’s stages that have a checklist. Press a stage to open its sheet: Yes, No or Not here on each question, a note, and a photo where a question asks for one. Every press saves by itself.',
    'The photo is shrunk on the phone and filed in the customer’s Google Drive folder by the photo sweep, named for the day, the stage and the question. The sheet says when it is in the folder.',
    'A stage with no questions is not listed, so nothing changes until the office types the questions on Settings → Jobs & billing → Stage checklists.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary', 'superintendent', 'helpers', 'subcontractor'],
}

export default note
