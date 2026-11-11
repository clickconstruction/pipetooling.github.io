import { useState } from 'react'
import { lienAffidavitSheetFlags, lienAffidavitSheetNext, type LienAffidavitSheetPaper, type LienAffidavitSheetReads } from '../../lib/jobs/lienAffidavitBatch'
import { FilingSheetFrame } from './FilingSheetNote'

/**
 * Under the Lien desk's **Print N for notarization** (v2.6930): the papers of the print that take a second sheet,
 * each by its job with the line its own Lien window shows (`FilingSheetNote`). The papers are laid out one at a time
 * in a frame nobody sees, so a month's run is one hidden document at a time, and a paper is named once it has been
 * read. It says nothing while every paper fits one sheet, and it never holds the press.
 */
export function LienAffidavitSheetFlags({ papers, labelFor, onOpen }: { papers: ReadonlyArray<LienAffidavitSheetPaper>; labelFor: (jobId: string) => string; onOpen: (jobId: string) => void }) {
  const [reads, setReads] = useState<LienAffidavitSheetReads>({})
  const next = lienAffidavitSheetNext(papers, reads)
  const flags = lienAffidavitSheetFlags(papers, reads)
  return (
    <>
      {next ? (
        <FilingSheetFrame
          key={next.jobId}
          sheetHtml={next.sheetHtml}
          onRead={(sheet, settled) => {
            if (settled) setReads((r) => ({ ...r, [next.jobId]: { sheetHtml: next.sheetHtml, sheet } }))
          }}
        />
      ) : null}
      {flags ? (
        <div role="status" data-lien-affidavit-print-all-sheets style={{ display: 'grid', gap: '0.2rem', color: 'var(--text-700)' }}>
          <strong>{flags.lead}</strong>
          {flags.rows.map((row) => (
            <span key={row.jobId} data-lien-affidavit-print-all-sheet={row.jobId}>
              <button type="button" onClick={() => onOpen(row.jobId)} style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontWeight: 700, color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
                {labelFor(row.jobId)}
              </button>
              {' · '}
              {row.words}
            </span>
          ))}
        </div>
      ) : null}
    </>
  )
}
