import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4659',
  date: '2026-10-06',
  title: 'Release of Lien: a paid bill opens its unconditional waiver',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On the Bill tab, Add the unconditional on a paid bill now opens the Release of Lien window on that bill, with the unconditional form.',
    'Before, the window left a paid bill out and opened on Conditional · progress.',
    'A paid bill can be picked in the window. It is never picked for you unless you opened the window from it.',
  ],
}

export default note
