import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5745',
  date: '2026-10-22',
  title: 'Job Summary: the job you search for always shows',
  kind: 'fix',
  highlights: [
    'Type a job number, a name or an address on Jobs → Job Summary and the job shows, whatever the Show, Worked in and Budget chips say. Before, a job still in progress hid behind the Finished chip and the page drew nothing.',
    'A line under the controls says what matched and which chip stepped aside, like “Job 891 is still in progress, so the Show chip stepped aside.”',
    'An exact job number also reaches under the HCP # 500 floor, so an older imported job can be looked up without lowering the floor. A name under the floor is counted, with show all as the door.',
    'While a search is on, the line under the table counts the search’s rows, not the whole list.',
  ],
}

export default note
