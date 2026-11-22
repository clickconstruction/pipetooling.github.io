import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8268',
  date: '2026-11-21',
  title: 'Messages: the groundwork for a payment promise to mark its line',
  kind: 'infra',
  highlights: [
    'Nothing on a screen changes yet. This is the database half of a change to Write down their word in Messages.',
    'Today a day a customer promises to pay is saved on the job, and the line they said it on keeps no mark. So the job’s thread summary still reads “Nothing promised yet”.',
    'The next change marks the line too. The summary will then name the day, and the thread will read “Their move · until Fri Nov 27 · payment” once we have answered.',
  ],
}

export default note
