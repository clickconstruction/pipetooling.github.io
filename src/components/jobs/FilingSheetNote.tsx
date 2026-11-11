import { useCallback, useEffect, useRef, useState } from 'react'
import { FILING_SHEET_ROOM_PX, FILING_SHEET_WIDTH_PX } from '../../lib/jobsDocuments/lienFilingDocuments'
import { filingSheetBreak, filingSheetWords, measureFilingSheet } from '../../lib/jobsDocuments/filingSheetBreak'

/**
 * The line under a print press that says when a paper takes a second sheet (punch list #305, v2.6896): *This paper
 * prints on 2 pages. The last statement, the signature and the notary’s block moved to page 2 together, so none of it
 * is cut.* `sheetHtml` is the paper's print document with `sheet` set; it is laid out in a frame nobody sees, as wide
 * as a Letter sheet, and read once it has loaded and again when its fonts have. A paper on one sheet says nothing.
 */
export function FilingSheetNote({ sheetHtml }: { sheetHtml: string }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [words, setWords] = useState('')
  const read = useCallback(() => {
    setWords(filingSheetWords(filingSheetBreak(measureFilingSheet(frame.current?.contentDocument, FILING_SHEET_ROOM_PX))))
  }, [])
  // A new paper is not the old one's count: say nothing until it has been read.
  useEffect(() => setWords(''), [sheetHtml])
  if (!sheetHtml) return null
  return (
    <>
      <iframe
        ref={frame}
        srcDoc={sheetHtml}
        onLoad={() => {
          read()
          void frame.current?.contentDocument?.fonts?.ready.then(read)
        }}
        title="Print layout"
        aria-hidden
        tabIndex={-1}
        sandbox="allow-same-origin"
        data-filing-sheet-measure
        style={{ position: 'fixed', left: -10000, top: 0, width: FILING_SHEET_WIDTH_PX, height: 10, border: 0, visibility: 'hidden', pointerEvents: 'none' }}
      />
      {words ? (
        <div role="status" data-filing-sheet-note style={{ flex: '1 1 100%', fontSize: '0.78rem', color: 'var(--text-700)' }}>
          {words}
        </div>
      ) : null}
    </>
  )
}
