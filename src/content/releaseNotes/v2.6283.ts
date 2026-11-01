import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6283',
  date: '2026-11-01',
  title: 'The law firm\'s weekly digest carries every office act',
  kind: 'feature',
  highlights: [
    'The weekly digest to the law firm now lists, under each account, every act the office recorded that week: a step, a planned step, a what-happened line, an offer, a statement, a paper added to Evidence, and a held paper released. Before this, only seven acts reached any email. The sample inbox on the portal\'s Notifications tab shows them too.',
    'These ride the digest only, so a paralegal entering six things does not get six emails back. Anything the office holds back from the firm or undoes stays out.',
    'Each person\'s digest now reads back to their own last digest. Before this, two people on different weekdays split the week, and the second one read only the days since the first.',
    'Once a matter is pulled back from the firm, nothing the office adds to it emails that firm any more, a note, a question, an answer or a payment applied included. Nor does anything on a matter picked for a firm but not yet released to it.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
