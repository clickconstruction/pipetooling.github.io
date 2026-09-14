import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3441',
  date: '2026-09-14',
  title: 'Job Summary: the % badge shows the report’s date without opening the row',
  kind: 'fix',
  highlights: [
    'On Jobs → Job Summary, a percent that came from a crew report now reads “crew report Aug 27” on the collapsed row — before, the date only filled in once the row was expanded.',
    'The date is the report the percent came from; a report the office has since overridden by hand still gives way to “set by office”.',
  ],
}

export default note
