import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6630',
  date: '2026-11-07',
  title: 'Dispatch hears of every license about to expire, every morning, whether or not anyone saved it',
  kind: 'feature',
  highlights: [
    'Every morning the app walks the licenses on People → Licenses and files the Dispatch notice for each one that expires in the next 30 days and was never asked about. Before, the notice went out only when someone saved the license, so the licenses imported in March lapsed with nothing sent.',
    'The notice goes out under the same name the portal’s requests carry, and the Dispatch group gets the push as it does after a Save. Each license is asked about once.',
    'A license already past its expiry gets no notice. The Expired section at the top of the Licenses tab is where those are seen.',
  ],
}

export default note
