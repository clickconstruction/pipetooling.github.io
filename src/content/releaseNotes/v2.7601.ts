import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7601',
  date: '2026-11-17',
  title: 'Estimates: what a press on Send does is one tested rule',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the rule for what Send does now lives in one tested module: who gets Tell the customer, who gets the confirm, and what the confirm says.',
    'The rule for which address an estimate goes to, the customer’s own email first and the typed one second, is written once in place of four times.',
    'Nothing changes on screen. A $0 send still asks first and says Send anyway.',
  ],
}

export default note
