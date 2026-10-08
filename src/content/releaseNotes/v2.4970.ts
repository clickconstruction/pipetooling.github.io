import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4970',
  date: '2026-10-08',
  title: 'Lien money: the Deadlines, the Dashboard reminder and Put a GC on notice count what is billed',
  kind: 'fix',
  roles: ['master_technician', 'assistant', 'controller', 'dev'],
  highlights: [
    'The Deadlines list on the Lien desk, the Pipeline’s lien chips and the Dashboard’s lien reminder now count what a job’s sent bills still owe, the same number the desk claims. A job billed in stages no longer shows the stage not yet billed as money at stake.',
    'Put a GC on notice reads a billed job the same way. A job not billed yet still shows what it will bill.',
    'Nothing moves on a job billed as one bill.',
  ],
}

export default note
