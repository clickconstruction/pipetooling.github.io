import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3857',
  date: '2026-09-26',
  title: 'Pipeline: who hears about a returned check is one named rule',
  kind: 'fix',
  highlights: [
    'The Pipeline decided inline which roles are told about a deposit the bank returned; that decision now lives with the board’s other role gates, named and pinned by the test that checks every gate against every role.',
    'Nothing on screen changes: the office pool — dev, master, assistant, controller — sees the returned-check badge as before, and nobody else’s board even asks.',
  ],
}

export default note
