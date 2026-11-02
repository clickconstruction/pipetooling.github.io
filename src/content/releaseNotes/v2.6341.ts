import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6341',
  date: '2026-11-02',
  title: 'A lien notice recorded after the fact starts its clocks on the day it was mailed',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Already mailed? Record it… on the Lien desk, and Already sent — record it… in the job’s Lien window, mark the notice sent on the mailing day you type, not the day you record it. Letter two, the courtesy notice and the day count on the Sent footer run from that day.',
    'The Lien window’s Save & record sends… and a run recorded in a later sitting with a Mailed on day do the same. A notice recorded the day it goes out is unchanged.',
    'Three live notices mailed September 22 and recorded October 6 still read October 6 until the owner runs the one-line correction on punch list card #243.',
  ],
}

export default note
