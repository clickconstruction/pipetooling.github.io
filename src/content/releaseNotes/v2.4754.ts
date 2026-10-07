import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4754',
  date: '2026-10-06',
  title: 'GC mode: the project’s folder in Drive, and who can open the plans',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Making a GC project makes its folder in the jobs Shared Drive, with Plans and Team only inside. Plans is shared with anyone with the link.',
    'Each set’s link says who can open it: anyone with the link, or only some people with the words to fix it in Drive. Check again reads it afresh.',
    'Only devs see it while the real build goes on.',
  ],
}

export default note
