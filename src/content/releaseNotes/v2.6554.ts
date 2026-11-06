import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6554',
  date: '2026-11-06',
  title: 'Counsel-only evidence on an HR file: kept here only, never filed in Drive, never read by the agent or the seat',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Add evidence gains a Counsel-only tick. A record kept that way stays in the app alone: it is never filed into Drive, and the HR agent’s key and the dev seat cannot read it.',
    'On the file the record wears a lock chip, the Evidence tab gains a Counsel-only filter once there is one, and its Timeline line shows the title alone.',
    'The limit, said plainly: a dev signed in still reads it. The hold binds the agent and Drive; it is not a second password.',
  ],
}

export default note
