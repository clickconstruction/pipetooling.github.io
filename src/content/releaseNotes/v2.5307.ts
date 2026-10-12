import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5307',
  date: '2026-10-12',
  title: 'Messages: add a new paper to a step of a flow',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A step of a flow can wait on a paper the app did not know yet: an upload they give us, a contract we write for them to sign, or a notice we send.',
    'An upload can run out. The app asks for the next one 30 days ahead, or the days you pick.',
    'A contract is written clause by clause in English and Spanish. A dev or a controller publishes it at once. Anyone else’s clauses wait for their approval, and they get a push and an email.',
    'The New paper window opens from the flow editor in Settings, which comes next.',
  ],
}

export default note
