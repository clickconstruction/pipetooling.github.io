import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7384',
  date: '2026-11-15',
  title: 'Job notes: the groundwork for tagging a teammate',
  kind: 'infra',
  highlights: [
    'The rules for tagging a teammate in a job note are written and tested. Nothing on screen has changed yet.',
    'A tag will be a name picked from a list under the note box, the job’s crew first. An @ typed to mean "at" stays plain words.',
    'A tag will turn amber once it has waited two working days for an answer.',
    'The next updates add the list to a Pipeline row and a Tagged job notes section with a count above Jobs.',
  ],
}

export default note
