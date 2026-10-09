import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4997',
  date: '2026-10-08',
  title: 'GC projects: record what the customer paid on a GC bill',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'Each certified bill in Bill the customer shows when it is due, and turns red once it is late.',
    'Mark paid, They paid part… and They said when… record the payment or their word, on the job’s billing job in the Pipeline.',
    'A payment recorded anywhere in the app shows here too. Our unconditional waiver for what they paid is one press away.',
    'Where we stand lists every late bill first.',
  ],
}

export default note
