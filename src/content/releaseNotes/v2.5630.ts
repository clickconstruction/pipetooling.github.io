import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5630',
  date: '2026-10-19',
  title: 'Pipeline: no dead space between a job’s name block and its activity',
  kind: 'fix',
  highlights: [
    'On a wide screen some Pipeline rows showed a wide empty band between the job’s name block and its activity box. The name block was reserving the full one-line width of the customer line with its globe, bubble and owner-sees chip, then wrapping that line anyway.',
    'The name block now never claims more than about 30rem; what it does not use, the activity box takes, as it already did on rows without that line.',
  ],
}

export default note
