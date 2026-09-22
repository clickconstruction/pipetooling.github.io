import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3688',
  date: '2026-09-21',
  title: 'Lien desk: the “mail goes somewhere else” line only shows on a house',
  kind: 'fix',
  highlights: [
    'The note under the roll’s owner — “Mail goes somewhere other than the job site” — was true on nearly every commercial job, since the owner is a company or an investor, so it said nothing. It no longer shows there: not on the Lien desk, not on Put a GC on notice, not on Edit Job.',
    'On a residential property it still shows, reworded to say why it matters: the roll may be stale, or the owner may have moved. Public, landlord and likely-homestead readings are unchanged.',
  ],
}

export default note
