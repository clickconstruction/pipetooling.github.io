import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6856',
  date: '2026-11-10',
  title: 'Bid photos find their way to Drive',
  kind: 'feature',
  highlights: [
    'A photo added to a bid will be filed in the bid’s project folder in Google Drive, under Team only › Photos. That is where a picture saved from a text onto a bid already goes.',
    'A bid with no project folder gets one made for it in the company’s shared Drive, and the bid’s folder link is filled in.',
    'When a bid’s folder sits where the app cannot save a file, the photo stays safe in the app with the reason beside it, and files itself once the folder is moved or shared.',
    'Nothing changes on screen yet. The next release puts the photos icon on the Bid Board.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary'],
}

export default note
