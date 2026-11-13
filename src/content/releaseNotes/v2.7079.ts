import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7079',
  date: '2026-11-12',
  title: 'Materials: By part on the printed report and on a job',
  kind: 'feature',
  highlights: [
    'The material location report has a third way to read it, By part. One line per part across the site, with its total and the boxes that hold it. It prints on fewer pages.',
    'A site’s materials screen has Print the material location report. It opens the report on the site’s Development page.',
    'A job’s Materials page has By part beside List and Map. A job on a site has a line that opens the whole site.',
    'Go anywhere lists a site that holds boxes. Type the site’s name and press the row that reads the whole site.',
  ],
}

export default note
