import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7746',
  date: '2026-11-18',
  title: 'Edit Job: a line added on another screen is no longer saved over',
  kind: 'fix',
  highlights: [
    'A Job window left open on one screen used to drop a line that was added to the job somewhere else in the meantime, such as a discount from Bill Customer or a change order’s lines from Apply to job. Its next save of the lines kept only the lines it knew, and wrote the job total without the new one.',
    'The save now looks first. When the job holds a line this window never had, it saves nothing over the lines, reads them again and says so. Your last change to the lines is not kept, so make it once more over the lines you now see.',
    'A payment typed along with that change is still saved. Nothing changes for a job that only one window has open.',
  ],
}

export default note
