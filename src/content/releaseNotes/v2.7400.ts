import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7400',
  date: '2026-11-15',
  title: 'Job notes: a note that tags a teammate shows who it waits on',
  kind: 'feature',
  highlights: [
    'A job note that tags a teammate now shows the name as a chip, and after it who the note waits on and for how long. Your own name is amber.',
    'Once the person answers on the job, the words change to say who answered.',
    'Typing a note on a Pipeline job now answers any tag that waits on you there. A stamp or a % line does not.',
    'The list of names for making a tag is switched on for testing only. It opens to everyone with the Tagged job notes section in the next update.',
  ],
}

export default note
