import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5489',
  date: '2026-10-13',
  title: 'Messages: quick replies in the language a customer reads, once Spanish is on',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The quick replies strip and Find a reply show a line in Spanish to a customer who reads Spanish.',
    'This waits for the one switch that turns Spanish on everywhere. Until then, every line reads English.',
    'A line with no Spanish goes in English. The strip says when it shows the Spanish.',
  ],
}

export default note
