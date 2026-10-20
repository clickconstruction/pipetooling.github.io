import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5337',
  date: '2026-10-12',
  title: 'Settings: match each company phone seat to a person',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Settings → Phone and texts has a Company phone seats card under Who gets a new message.',
    'Each seat is a person’s place in Quo, the app the company number runs on. Match each one to the person who answers on it.',
    'The office team can read the seats. Only the owner or a dev can change them.',
  ],
}

export default note
