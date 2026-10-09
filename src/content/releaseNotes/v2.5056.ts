import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5056',
  date: '2026-10-09',
  title: 'Division 22 rules: a deleted rule or section can be put back',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A Division 22 rule or section that gets deleted can now be put back for 90 days. Use Settings → Data & recovery → Recently deleted.',
    'Recently deleted shows a rule the way the codes window does, such as “contains FD- → 22 13 19”.',
  ],
}

export default note
