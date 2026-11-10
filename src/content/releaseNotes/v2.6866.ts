import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6866',
  date: '2026-11-10',
  title: 'A bid’s window says what the city has on its address',
  kind: 'feature',
  highlights: [
    'Edit a bid and look under Location. This site says what the city has on the address: a permit applied for or issued and how long ago, and whether a general plumbing permit is on it. The declared value and the area sit beside your bid.',
    'Every permit we can see on the address is listed, with the name the city lists on it. A permit whose project name matches the bid is marked Looks like this job.',
    'Under the GC’s card, What we can see about them lists the jobs you priced for that GC and what the city has on each address. It says how many sites the count is out of and which towns it cannot see.',
    'It never reads as no permits. A town we do not read, an address with no street number and nothing seen since the records start each say so. San Antonio is the city read today.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
