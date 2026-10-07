import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4757',
  date: '2026-10-06',
  title: 'GC mode: the one press that puts a new set of plans on a project',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The database gains the function the new-plans window will call: the set with the sheets and sections it adds, renames and takes out, the trades it brings, the scope lines it adds and the lines it ties to new sheets go in together, or not at all.',
    'With it, what a scope line reads from moves into the app’s kernels, so the window can say which lines a set leaves with nothing to read.',
    'Nothing on a screen calls it yet. The new-plans window on real data is the next step of the GC mode real build.',
  ],
}

export default note
