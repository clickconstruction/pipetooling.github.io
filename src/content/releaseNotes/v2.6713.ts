import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6713',
  date: '2026-11-08',
  title: 'A transcript on an HR file names the recording it transcribes, and either side opens the other',
  kind: 'feature',
  highlights: [
    'A named document on a person’s HR file can name the evidence record it transcribes. Open the document and press Transcribes… to pick the record. The header then shows the record’s title, its day and the first twelve characters of its file’s hash, and opens the record. The audio’s chip sits beside it.',
    'The record’s row on the Evidence tab and its line on the Timeline read Transcript on file and open the document, so a search hit on a line of a call opens the call.',
    'A document tied to a counsel-only record must be counsel-only too. The pair is refused otherwise, in words.',
    'The dev seat sets the same link through plan_person_doc, alone or with the text, and the case brief and the case search carry the pair, so an agent cites the call by its record.',
  ],
}

export default note
