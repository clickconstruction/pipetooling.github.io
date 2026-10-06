import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4636',
  date: '2026-10-05',
  title: 'Help: the lien release guide says who signs, as it works now',
  kind: 'fix',
  highlights: [
    'Signed by starts as the company’s signer from Settings, else the job’s leader. The Signs pick starts fresh each time the window opens.',
    'When the leader signs on your screen he draws his signature. Only the person signed in can press Type it instead.',
  ],
}

export default note
