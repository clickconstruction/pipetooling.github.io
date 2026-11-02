import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6302',
  date: '2026-11-01',
  title: 'The Development page’s Plans look reads by part: what each building builds from',
  kind: 'feature',
  highlights: [
    'Plans on a development now lists each part of the site, such as the Lodge or the Bunker, with the set it builds from, the date on the sheets, the day it came, the memo and the jobs on it. Older sets fold under a count.',
    'Press + Part to name a part of the site, + New set on a part’s row to add a set and build from it, or Build from this set on an older one. The crew’s as-builts read under their part.',
    'The only chips left are the ones that need a person: parts with no set, and jobs on no part. A job’s empty Drive folder no longer counts as a set, and no job can be on an older set.',
    'Bids keep their own pinned sets and are listed under the table.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
