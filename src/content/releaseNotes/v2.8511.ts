import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8511',
  date: '2026-11-24',
  title: 'Document builder: publishing the insurance sheet asks first',
  kind: 'fix',
  highlights: [
    'Publishing a job’s insurance sheet now opens a window first. It says who sees the new revision, and that a publish cannot be taken back.',
    'Publishing your usual sheet asks first too. The window counts the jobs that get the change and the jobs held.',
    'Not yet closes the window and leaves the draft a draft. A Publish button that is greyed out still opens nothing.',
  ],
}

export default note
