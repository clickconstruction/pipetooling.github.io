import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6466',
  date: '2026-11-03',
  title: 'A stopped crew’s check stays off the Customer waiting banner',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A check sent with Can’t do it no longer raises the red Customer waiting strip across the app, and no longer counts under Needs you. It still leads the Dispatch inbox under its red line, and Dispatch still gets the push.',
    'The strip stays for customers you can call. A crew’s check can no longer take the lead from a waiting customer, and the strip turns amber once every customer has been called.',
  ],
}

export default note
