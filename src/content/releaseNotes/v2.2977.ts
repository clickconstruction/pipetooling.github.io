import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2977',
  date: '2026-09-06',
  title: 'Safety net under the Banking switches',
  kind: 'infra',
  highlights: [
    'Nothing changes in the app. Every per-device switch on the Banking tabs — hide labeled rows, cards expanded, apply rules by default, the ledger filters and sort, the Card Review chart view — plus the built-in accounting label table now has 23 tests pinning defaults and behaviour, so a switch cannot quietly flip on someone.',
  ],
}

export default note
