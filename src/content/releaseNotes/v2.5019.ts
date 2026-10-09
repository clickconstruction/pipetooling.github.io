import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5019',
  date: '2026-10-09',
  title: 'GC projects: close out a job with the customer',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'Bill the customer shows Closeout once every line is billed. Closeout has six steps in order, each with who moves it and the next one marked.',
    'Accept the work records the day the customer walked the job and accepted it, who did, and a note.',
    'Once every trade has sent its final and the customer has accepted, Send the final pay application asks for what they hold. Its email tick starts off.',
    'Our conditional waiver with the final opens on the final payment form. After the final, the window bills nothing more.',
  ],
}

export default note
