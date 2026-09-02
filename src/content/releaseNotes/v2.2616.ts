import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2616',
  date: '2026-09-02',
  title: 'Lien releases: groundwork for in-app signing',
  kind: 'feature',
  highlights: [
    'Behind the scenes, lien releases now carry a full document lifecycle — draft, issued, awaiting signature, signed, sent — and every step is recorded on the job.',
    'This is the foundation for what\'s coming next: request the master plumber\'s signature from the release modal, sign in the app, and send the signed PDF to the customer — all without leaving ClickTooling.',
  ],
}

export default note
