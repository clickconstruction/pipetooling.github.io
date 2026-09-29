import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4160',
  date: '2026-09-29',
  title: 'Pipeline: every address says residential or commercial',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Each job’s address on the Pipeline ends in a circle: an orange C for a commercial property, a blue R for a residential one, a red ? when nobody has said yet.',
    'Tap the circle and a small card asks which it is — Residential or Commercial, the same switch the Lien desk uses. The answer is saved on the customer’s property, so every job at that address follows it and its lien clock reads the right deadline.',
    'A job whose address is typed on the job rather than linked to a saved property shows no badge — link the property from Edit Job first.',
  ],
}

export default note
