import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7282',
  date: '2026-11-14',
  title: 'The job window on a phone: Documents, and a photo straight into a folder',
  kind: 'feature',
  highlights: [
    'On a phone each Job folders row ends in Add ▾. It opens a sheet of three: Take a photo, which opens the camera and puts the shot into that folder by itself, named by the day, who took it and the folder; Choose a file, the phone’s own picker; and Open in Google Drive.',
    'Stage checklists on the Documents tab show one row per stage on a phone, with the stage’s standing on the row: Filed with its record number, Ready with the count, or Not ready with the count. Tap a stage to open its read-out.',
    'Every press on the Documents tab stands 40 px tall on a phone, and the section titles read larger.',
    'The AIA application and the Test report windows no longer make an iPhone zoom in when a field is tapped. The Test report’s PASS and FAIL cards and the pressure boxes stack on a phone instead of running off the edge.',
  ],
}

export default note
