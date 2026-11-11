import { useCallback, useEffect, useRef, useState } from 'react'
import { FILING_SHEET_ROOM_PX, FILING_SHEET_WIDTH_PX } from '../../lib/jobsDocuments/lienFilingDocuments'
import { filingSheetBreak, filingSheetWords, measureFilingSheet, type FilingSheetBreak } from '../../lib/jobsDocuments/filingSheetBreak'

/**
 * A paper laid out in a frame nobody sees, as wide as a Letter sheet (v2.6896). `sheetHtml` is the paper's print
 * document with `sheet` set. It is read once it has loaded and again when its fonts have; `settled` is true on the
 * last read, so a caller that reads papers one at a time (the Lien desk's batch print, v2.6930) knows when to move on.
 */
export function FilingSheetFrame({ sheetHtml, onRead }: { sheetHtml: string; onRead: (sheet: FilingSheetBreak | null, settled: boolean) => void }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const read = (settled: boolean) => {
    // The fonts can settle after the frame is gone: there is no paper left to read then.
    if (frame.current) onRead(filingSheetBreak(measureFilingSheet(frame.current.contentDocument, FILING_SHEET_ROOM_PX)), settled)
  }
  return (
    <iframe
      ref={frame}
      srcDoc={sheetHtml}
      onLoad={() => {
        const fonts = frame.current?.contentDocument?.fonts
        read(!fonts)
        // A font that fails to load still settles `ready`; one that rejects is read as it lies.
        if (fonts) void fonts.ready.then(() => read(true), () => read(true))
      }}
      title="Print layout"
      aria-hidden
      tabIndex={-1}
      sandbox="allow-same-origin"
      data-filing-sheet-measure
      style={{ position: 'fixed', left: -10000, top: 0, width: FILING_SHEET_WIDTH_PX, height: 10, border: 0, visibility: 'hidden', pointerEvents: 'none' }}
    />
  )
}

/**
 * The line under a print press that says when a paper takes a second sheet (punch list #305, v2.6896): *This paper
 * prints on 2 pages. The last statement, the signature and the notary’s block moved to page 2 together, so none of it
 * is cut.* A paper on one sheet says nothing.
 */
export function FilingSheetNote({ sheetHtml }: { sheetHtml: string }) {
  const [words, setWords] = useState('')
  const read = useCallback((sheet: FilingSheetBreak | null) => setWords(filingSheetWords(sheet)), [])
  // A new paper is not the old one's count: say nothing until it has been read.
  useEffect(() => setWords(''), [sheetHtml])
  if (!sheetHtml) return null
  return (
    <>
      <FilingSheetFrame sheetHtml={sheetHtml} onRead={read} />
      {words ? (
        <div role="status" data-filing-sheet-note style={{ flex: '1 1 100%', fontSize: '0.78rem', color: 'var(--text-700)' }}>
          {words}
        </div>
      ) : null}
    </>
  )
}
