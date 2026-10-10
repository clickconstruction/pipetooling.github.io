import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5208',
  date: '2026-10-10',
  title: 'GC mode: Compare quotes marks a quote priced on plans that changed since',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Compare quotes now marks a quote priced on older plans when a newer set changed that trade, so you know to ask them to confirm.',
    'A set you sent counts the trades you ticked when it went out. A set not sent yet counts the trades its sheets point to.',
  ],
}

export default note
