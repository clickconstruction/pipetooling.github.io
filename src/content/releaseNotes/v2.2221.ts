import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2221',
  date: '2026-08-23',
  title: 'People → HR: private employee files',
  kind: 'feature',
  highlights: [
    'New dev-only HR tab on People: a private file per person with an agent-maintained Summary and Narrative plus an append-only log of dated facts.',
    'Roster dots show each file at a glance — green when the summary is current, amber when raw entries have outrun it, grey when there is no file yet.',
    'Raw entries can be added right on the tab but never edited or deleted — corrections are new entries, so the log stays trustworthy.',
  ],
}

export default note
