import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8261',
  date: '2026-11-21',
  title: 'Permits: a slot that was never filled is gone from the list of builders',
  kind: 'infra',
  highlights: [
    'Nothing on a screen changes. Builders, Market and a builder’s sheet read as before.',
    'The list of builders kept a slot for one customer per name, and nothing ever filled it.',
    'The customers a name is tied to are kept with the answers people give, where one name can have more than one.',
  ],
}

export default note
