import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5355',
  date: '2026-10-12',
  title: 'Messages: the rules for a customer’s calls, texts and emails in Job activity',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Nothing changes on screen yet. A job’s Job activity can now number its calls, texts and emails with its notes, reports and status lines.',
    'The customer’s lines read in orange, deeper when they came from her. A team note stays plain, and anyone else’s line shows under All only.',
    'A call leads with its summary and opens to the transcript. A line not tied to a job yet says so.',
    'A new Customer filter counts her lines, and each line links to her thread in Messages.',
  ],
}

export default note
