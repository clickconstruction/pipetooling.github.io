import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5864',
  date: '2026-10-25',
  title: 'Estimates: the Also-notify list is grouped by one tested rule',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the rule that groups the "Also notify" picker on an estimate — master technicians first, then assistants, superintendents and everyone else, each group sorted by name with a caption between groups — now lives in its own tested module.',
    'Nothing changes on screen. The picker shows the same people in the same order.',
    'New tests pin the order: you are left out of the list, every role lands in its group, and a caption appears only between groups that have people.',
  ],
}

export default note
