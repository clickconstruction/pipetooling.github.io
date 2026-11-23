import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8367',
  date: '2026-11-23',
  title: 'Before we start: a stage leaves Not as told once the customer gives a new yes',
  kind: 'fix',
  highlights: [
    'A stage with a No on arrival read Not as told in red until one of ours answered again, also after the office had ticked the thing as true on the customer’s new word.',
    'The red sentence now holds only while a No still stands. Once every No has a new yes, the stage reads its own sentence again, like Go or Waiting on them.',
    'With two Nos, the sentence names the first thing still not as told and who said No on it.',
  ],
}

export default note
