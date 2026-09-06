import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2948',
  date: '2026-09-06',
  title: 'The job window gets a History tab: the days-worked grid for any job',
  kind: 'feature',
  highlights: [
    'Open a job and there is a fourth tab, History — the same day grid Projects → Job History shows (one row per day worked, coloured by how many people were on site), now for every job whether or not it belongs to a project.',
    'It looks back 180 days by default; move the range to see more. Tap a day to see who was there and what it cost. Nothing on the tab edits anything.',
    'Projects → Job History is unchanged.',
  ],
}

export default note
