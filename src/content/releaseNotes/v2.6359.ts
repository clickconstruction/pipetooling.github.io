import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6359',
  date: '2026-11-02',
  title: 'The ground under job photos with a description',
  kind: 'feature',
  highlights: [
    'A photo could reach a job only on a report, a Tally box, a checklist answer or a text. There was no way to put a photo on a job with a sentence and nothing else.',
    'The database now holds a job photo of its own: the job, what it shows in your words, the stage, who took it and when, and where it lands in Drive. Documents → Photos will list these as a fifth source, Job photos, once they exist.',
    'Nothing changes on screen yet. The next releases put a camera icon on the Pipeline row and a Photos line on the Job Mode card that open one window to add a photo with its words and browse the job’s photos.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'helpers', 'subcontractor'],
}

export default note
