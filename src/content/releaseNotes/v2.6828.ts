import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6828',
  date: '2026-11-10',
  title: 'Permits: everything public about a building and a name, and a Google search beside each',
  kind: 'feature',
  highlights: [
    'On Prospects → Permits, press an address. The building opens: the permit as the city gave it, with every field the city sent behind one press, the property at the county (owner of record, mailing address, land and building values, year built, lot), and every permit the feed holds on that address.',
    'A round G beside a name or an address searches Google for it in a new tab. A person is searched with their company, so a common name finds the right one.',
    'The Who pulled it card now lists the other permits the same name pulled in the last year, and opens the state’s business search with the company’s name copied.',
    'The building also opens the county clerk’s deed records and the city’s own permit record.',
  ],
}

export default note
