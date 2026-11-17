import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7532',
  date: '2026-11-16',
  title: 'Collections: Move to Collections shows the money, and what is owed reads the bills',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Move to Collections showed no money. It now says what the job’s sent bills still owe before you confirm.',
    'When part of the job is on no bill, an amber note says how much, with the job’s percent complete beside its percent billed. Collections chases what is billed. If the rest will not be done, correct the job total on the job.',
    'Mark Uncollectible named the job’s whole price less payments as open. It now names what the sent bills owe, with work not billed named apart.',
    'On the Dashboard, a job with several bills read Remaining as its price less payments. Its card now reads Billed and still open, and names any part of the job on no open bill.',
  ],
}

export default note
