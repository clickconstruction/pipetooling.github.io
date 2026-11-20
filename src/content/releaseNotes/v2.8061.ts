import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8061',
  date: '2026-11-20',
  title: 'HR files: a part of the file that could not be read now says so',
  kind: 'fix',
  highlights: [
    'When the correction links cannot be read, the file says so under the Timeline. Before, a corrected entry simply lost its Corrected mark.',
    'The same line names the evidence numbers and the standing when either could not be read.',
    'The strip of facts reads Standing not read in that case. Before, it read Standing…, the same as a file with nothing on it.',
  ],
}

export default note
