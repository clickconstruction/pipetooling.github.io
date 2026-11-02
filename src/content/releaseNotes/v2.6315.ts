import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6315',
  date: '2026-11-01',
  title: 'Every edge function links in CI before it can merge',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A server function that imports a name its shared module does not export used to pass every check and then refuse to start once deployed, as the Drive folder press and photo filing did on November 1 (v2.6294).',
    'CI now links all 173 functions on every pull request, the way the server does when a function starts, and names the function, file and line when one would not start. It takes about half a second.',
    'Run it yourself with npm run check:edge-bundles. The folder a copy sits in can be passed to it, to try a break without touching the repo.',
  ],
}

export default note
