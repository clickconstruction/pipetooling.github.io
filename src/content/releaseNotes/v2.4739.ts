import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4739',
  date: '2026-10-06',
  title: 'GC mode: New project on real data, behind a dev door',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The New project window from the GC mode prototype now runs on the real database. Its four steps are the project, the plans, the trades and each scope.',
    'The press makes the project, its trades with their scope and the first set of plans in one go. The new page at GC projects lists each project as the window left it, with its gaps.',
    'Only devs see the page while the real build goes on. Who to ask waits for the company record.',
  ],
}

export default note
