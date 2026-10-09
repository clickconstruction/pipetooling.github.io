import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5028',
  date: '2026-10-09',
  title: 'Lien desk: Sent on your word also lists what a standing rule sent',
  kind: 'fix',
  roles: ['dev', 'master_technician'],
  highlights: [
    'A GC set to “Send notices without asking” now shows each notice its rule put in the run, in Sent on your word at the top of the Lien desk. Each reads “by Loberg Contracting’s rule”, apart from the ones sent on your word.',
    'Notices printed and in the mail stay on that list too. Before, a notice dropped off it from the day its packet printed until its mailing was recorded.',
  ],
}

export default note
