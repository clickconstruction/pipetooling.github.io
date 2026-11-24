import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8467',
  date: '2026-11-24',
  title: 'Sub Labor: the sheet form offers nobody whose account is archived',
  kind: 'fix',
  highlights: [
    'New Sub Labor no longer offers a person whose account is archived. It used to offer them when their roster row was still on file.',
    'A name already on a sheet stays on it.',
    'People → Users lists them under Archived, where they come back.',
  ],
}

export default note
