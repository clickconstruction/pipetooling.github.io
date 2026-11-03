import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6458',
  date: '2026-11-03',
  title: 'Combining two jobs carries the source job payment promises, lien paper, agreements and pay applications to the target',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Combining two jobs used to delete the source job payment promises, chase calls, the trace of a moved payment, lien notices, affidavits, lien releases, demand letters, Lien desk items, claim corrections, legal matter links, agreements and pay applications with the source card. They now move to the target.',
    'A promised pay date on both jobs keeps the one marked last. A claim correction on both keeps the target. A legal matter that named both jobs names the combined job once. A live Lien desk item of a kind the target already holds is set aside, and the target item stands.',
    'A combine holds when both jobs have an open agreement, or when both hold pay applications. It says which. Void the agreement or delete one job applications, then combine.',
    'Bills and payments keep their rule: the Combine tab refuses a source that has either, and the Delete flow Reassign to another job lets them go with the source on purpose.',
  ],
}

export default note
