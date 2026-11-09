import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6769',
  date: '2026-11-08',
  title: 'The bill text’s link ends in ten letters',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Text, Copy link and the share row’s email draft under a Stripe bill now carry my.clickplumbing.com/pay/ and ten letters, 43 characters, in place of the bill’s long id.',
    'Each bill gets its code once, the first time its share row is drawn or when the bill is made, and keeps it for life. The link never expires and says Paid once the bill is paid.',
    'A wrong code is counted: after 20 misses in an hour from one connection the page asks that connection to wait an hour. A link that was texted before this keeps working.',
  ],
}

export default note
