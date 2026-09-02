import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2659',
  date: '2026-09-02',
  title: 'Editable wording for the nine digest emails',
  kind: 'feature',
  highlights: [
    'Every scheduled digest — paid job, ready to bill, money waiting, billed awaiting, payment forecast, crew day, both weeklies, and the morning dispatch schedule — now takes a custom subject line and an intro paragraph from Settings → Email templates.',
    'The digest data itself never changes: you\'re editing the words around it. {{default_subject}} drops the built-in subject (dates and job labels included) into your custom one.',
    'No template saved means everything sends exactly as before.',
  ],
}

export default note
