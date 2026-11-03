import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6418',
  date: '2026-11-02',
  title: "The person file's Timeline and evidence rules read from one place, for the app and the dev seat alike",
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Nothing changes on People → HR: the Timeline draws the same lines and the evidence window keeps the same rules.',
    'The rules now live where the edge functions can read them too, so the dev seat can soon read a person\'s file whole and keep evidence under the same path.',
  ],
}

export default note
