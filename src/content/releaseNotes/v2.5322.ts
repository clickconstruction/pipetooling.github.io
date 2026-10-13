import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5322',
  date: '2026-10-12',
  title: "Messages: change our words on a customer's job page",
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Settings → What customers see has a Customer page section. It holds every sentence of ours on a GC job’s page, in English and Spanish.',
    'Find a sentence by the words you see on the page, then change both languages. The change reads on every customer’s page.',
    'Each job on a customer’s portal has three switches: Photos, Next bill and Spanish. Each starts off.',
    'Only the office team changes them. A training account reads them as they are.',
  ],
}

export default note
