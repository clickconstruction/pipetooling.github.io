import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6423',
  date: '2026-11-02',
  title: 'Combining two jobs carries the source job history, materials, messages and plans to the target',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Combining two jobs used to delete the source job activity history, percent-done history, materials on site, box photos, test reports, share links, hours statements, PO entries, Messages links and plan sets with the source card. They now move to the target.',
    'A row the target already has once, such as a place, a container, a watcher, a supply-house account or a contact link, is merged by a rule written on punch list #252. A stage window follows its line through a split or a combine.',
    'A combine holds when both jobs have a live work order for the same sub. It names the sub. Cancel one order, then combine.',
    'Bills, payments, promises, lien paper, agreements and pay applications keep their old behaviour until the owner decides them. The combine guide says what stays behind.',
  ],
}

export default note
