import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4710',
  date: '2026-10-06',
  title: 'AIA G702-G703: the job’s pay applications read as a history',
  kind: 'feature',
  highlights: [
    'On a job with saved applications the window now opens on their history: where the job stands against the contract, then one line per application.',
    'Each line says who saved it and when, and lists every workbook that went out with the time and who generated it. Press a file name to download it again.',
    'Press New application to start the next one from the last saved. Press ← Pay applications at the top of the form to get back to the history.',
    'The job’s Documents tab shows the same: each application’s workbooks sit under it, with who saved it, instead of in Sent from this job.',
  ],
}

export default note
