import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6088',
  date: '2026-10-29',
  title: 'Supply-house bills: the reader behind a switch',
  kind: 'feature',
  highlights: [
    'The app can now read a supply-house bill’s PDF, or a picture of the counter ticket, into the fields of the Add invoice window. Nothing shows yet: the switch ships off, and the next release puts the bill picker on the form.',
    'A read is kept on the invoice row with the lines the paper printed, so a wrong guess can be found later and a job’s parts can be read from its bills.',
    'The Add invoice window saves through one path whether a bill is typed or filled, with the same rules as before.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
