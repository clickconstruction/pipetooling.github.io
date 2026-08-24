import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2251',
  date: '2026-08-24',
  title: 'Roadmap Add task: typing fixed + crew tags',
  kind: 'feature',
  highlights: [
    'Fixed: typing a task title in the roadmap’s Add-task dialog no longer erases each letter as you type.',
    'Crew tags: one tap staffs a whole crew — chips above the assignee list come from People → Teams, with member counts.',
    'Create, rename, restaff, or delete a crew right in the dialog (＋ New crew / ✎ Edit, or long-press a chip); changes save back to People → Teams everywhere.',
  ],
}

export default note
