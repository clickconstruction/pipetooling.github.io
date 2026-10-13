import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5331',
  date: '2026-10-12',
  title: "Messages: a customer writes to us from their job's page",
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A customer’s page on a GC job has a Messages tab: the same conversation as their texts and emails with us.',
    'What they write there lands in their thread like a text, tied to the job of the page they wrote on.',
    'Only our lines and theirs by text, email or the page show there. A team note or a call never does.',
  ],
}

export default note
