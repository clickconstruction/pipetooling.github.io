import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7121',
  date: '2026-11-13',
  title: 'Parts Book: Codes with no part, the houses’ codes on the bills matched to parts',
  kind: 'feature',
  highlights: [
    'The Parts Book has a new press for the office, **Codes with no part**: every supply house code on the bills that no part answers to yet, the most dollars first.',
    'Each row shows the line as printed, how often it was bought, what was spent and the part the book offers. Press **This is it**, **Pick a part**, **New part in the book**, **Not a part** or **Later**.',
    '**Match 97 offered codes** takes every code whose part was found by its manufacturer’s number or by the same name. A code it could not keep is named with its reason, and the rest go on.',
    'Say once which part a code is, and every bill with that code, past and to come, is that part. What we buy then shows one row for a part bought at two houses.',
  ],
}

export default note
