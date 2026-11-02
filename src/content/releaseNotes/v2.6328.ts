import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6328',
  date: '2026-11-02',
  title: 'Stage checklists: add a check for one job, and read every answer with its name and time on the Documents tab',
  kind: 'feature',
  highlights: [
    'Open a job’s stage checklist and press + Add a check for the stage. The office adds one on any job, a superintendent on their own. The crew sees it under Added for this job the next time the sheet opens, and it counts toward ready like the company’s questions, on the Pipeline too.',
    'The phone sheet keeps one question open at a time, marked Next, with a count of what is left. An answer moves the sheet on by itself, and every answered row reads the person’s name and the time.',
    'Open the job window and press Documents. The Stage checklists section reads each stage’s standing and every answer with who gave it, when, the note and where the photo is. Add a check there too, or take one off.',
    'A check taken off keeps the answer it already has.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent', 'helpers', 'subcontractor', 'primary'],
}

export default note
