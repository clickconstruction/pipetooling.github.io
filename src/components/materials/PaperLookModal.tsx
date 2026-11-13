import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { PdfPageCanvas } from '../contracts/formStudio/PdfPageCanvas'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import type { PaperIo } from '../../lib/materials/lines/paperIo'
import { moneyWords, type PricingUnit } from '../../lib/materials/lines/paperChecks'
import {
  ACCEPT_WORDS,
  blankDraft,
  changedCount,
  draftOfLine,
  gapWords,
  linesFromDrafts,
  paperReadOfRow,
  paperSaveFromRow,
  recheck,
  saveLinesLabel,
  type LineDraft,
  type PaperRow,
} from '../../lib/materials/lines/paperRows'

/**
 * Look (punch list #298 PR 1b, v2.6819): a supply house bill's paper beside the lines read from it. The strip at the
 * top says which sum is off and by how much; the line whose own arithmetic fails is marked; a person fixes a line or
 * types the missing one under the list, the strip turns green before Save, and *Count it as read anyway* keeps the
 * gap beside the lines with their name. The arithmetic is `paperChecks.ts`, the drafts `paperRows.ts`; this file
 * draws them. The paper is our copy of the PDF when the row kept one, else the row's link.
 */
export function PaperLookModal({ paper, invoice, io, fileBytes, acceptedByName, onClose, onChanged }: {
  paper: PaperRow
  invoice: { id: string; invoice_number: string; amount: number; link: string | null; invoice_date: string }
  io: Pick<PaperIo, 'save' | 'accept'>
  /** Our copy's bytes for the pane, when the row kept one; null draws the link instead. */
  fileBytes: ArrayBuffer | null
  acceptedByName?: string | null
  onClose: () => void
  /** After a save or an accept: the tab reads the papers again. */
  onChanged: () => void
}) {
  const confirmDialog = useConfirmDialog()
  const [drafts, setDrafts] = useState<LineDraft[]>(() => [...paper.lines.map(draftOfLine), blankDraft(paper.lines.length + 1)])
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const rowAmountCents = Math.round(Math.abs(invoice.amount) * 100)
  const lines = useMemo(() => linesFromDrafts(drafts, paper.lines), [drafts, paper.lines])
  const { check } = useMemo(() => recheck(paperReadOfRow(paper), lines, rowAmountCents), [paper, lines, rowAmountCents])
  const changed = useMemo(() => changedCount(drafts, paper.lines), [drafts, paper.lines])
  const gap = gapWords(check)
  const badLines = useMemo(() => new Set(check.lineProblems.map((p) => p.lineNo)), [check])
  const counted = lines.filter((l) => l.lineKind !== 'component')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function setDraft(i: number, patch: Partial<LineDraft>) {
    setDrafts((ds) => {
      const next = ds.map((d, j) => (j === i ? { ...d, ...patch } : d))
      // Typing in the add row opens another under it, so a second missing line has a place.
      const last = next[next.length - 1]!
      if (last.houseCode || last.description || last.qtyShipped || last.unitPrice || last.extended) next.push(blankDraft(last.lineNo + 1))
      return next
    })
  }

  function removeDraft(i: number) {
    setDrafts((ds) => ds.filter((_, j) => j !== i))
  }

  async function saveLines() {
    setBusy(true)
    setProblem(null)
    try {
      const out = paperSaveFromRow(paper, lines, check)
      await io.save(invoice.id, out.paper, out.lines)
      onChanged()
      onClose()
    } catch (e) {
      setProblem(formatErrorMessage(e, 'The lines were not saved.'))
    } finally {
      setBusy(false)
    }
  }

  async function acceptAnyway() {
    const gapNote = check.state === 'off' ? check.words.replace(/^\d+ lines? · /, '') : paper.checkNote
    if (!(await confirmDialog({ message: ACCEPT_WORDS.message(gapNote || 'the gap on the row'), confirmLabel: ACCEPT_WORDS.confirm }))) return
    setBusy(true)
    setProblem(null)
    try {
      if (changed > 0) {
        const out = paperSaveFromRow(paper, lines, check)
        await io.save(invoice.id, out.paper, out.lines)
      }
      await io.accept(paper.id, gapNote)
      onChanged()
      onClose()
    } catch (e) {
      setProblem(formatErrorMessage(e, 'The bill was not counted as read.'))
    } finally {
      setBusy(false)
    }
  }

  const accepted = paper.checkState === 'accepted'
  const cell: CSSProperties = { padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border)', verticalAlign: 'middle', fontSize: '0.8125rem' }
  const input: CSSProperties = { width: '100%', minWidth: 0, padding: '0.25rem 0.4rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '0.8125rem' }
  const num: CSSProperties = { ...input, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
  const stripStyle: CSSProperties =
    gap.tone === 'ok'
      ? { background: 'var(--bg-green-100)', color: 'var(--text-green-700)' }
      : { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', border: '1px solid var(--border-strong)' }

  return (
    <div role="dialog" aria-modal="true" aria-label={`Look at the lines of ${invoice.invoice_number}`} data-testid="paper-look" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))', zIndex: 1300 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(1240px, 100%)', maxHeight: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem 1.1rem 1.1rem', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.0625rem', color: 'var(--text-strong)' }}>
              {invoice.invoice_number} · {invoice.invoice_date} · {moneyWords(rowAmountCents)}
            </h2>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {paper.poText ? `PO ${paper.poText} · ` : ''}read {paper.readAt ? new Date(paper.readAt).toLocaleDateString() : ''} from {paper.filePath ? 'our copy of the PDF' : 'the PDF on the row'}
              {accepted ? ` · counted as read${acceptedByName ? ` by ${acceptedByName}` : ''}` : ''}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.875rem', cursor: 'pointer', padding: '0.25rem 0.5rem' }}>✕ Close</button>
        </div>

        <div data-testid="paper-look-strip" style={{ ...stripStyle, borderRadius: 8, padding: '0.6rem 0.8rem', fontSize: '0.8125rem', lineHeight: 1.45 }}>
          <b>{gap.title}</b>
          {gap.detail.map((d, i) => (
            <span key={i}> {d}</span>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 440px) minmax(0, 1fr)', gap: '0.9rem', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>The paper</span>
              {invoice.link ? (
                <a href={invoice.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-blue-500)' }}>Open in Drive</a>
              ) : null}
            </div>
            {fileBytes ? (
              <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', background: 'var(--surface)' }}>
                <PdfPageCanvas bytes={fileBytes} page={page} scale={0.72} />
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', padding: '0.3rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}>‹ Page</button>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>page {page}</span>
                  <button type="button" onClick={() => setPage((p) => p + 1)} style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}>Page ›</button>
                </div>
              </div>
            ) : (
              <div style={{ border: '1px dashed var(--border-strong)', borderRadius: 6, padding: '1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {invoice.link ? 'The app has no copy of this PDF of its own. Open the row\'s link beside the lines.' : 'This bill has no PDF yet. Add one on the row to see the paper here.'}
              </div>
            )}
          </div>

          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>The lines as read. Fix a number, or type the missing line in the last row.</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                <thead style={{ background: 'var(--bg-subtle)' }}>
                  <tr>
                    {['#', 'Code', 'Description', 'Shipped', 'Unit', 'Price', 'Per', 'Extension', ''].map((h, i) => (
                      <th key={i} style={{ ...cell, textAlign: i >= 3 && i <= 7 && i !== 4 && i !== 6 ? 'right' : 'left', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((d, i) => {
                    const isAdd = i >= paper.lines.length
                    const bad = !isAdd && badLines.has(lines.find((l) => l.description === d.description.trim() && l.houseCode === d.houseCode.trim())?.lineNo ?? -1)
                    return (
                      <tr key={d.lineNo} data-testid={isAdd ? 'paper-look-add' : `paper-look-line-${d.lineNo}`} style={{ background: bad ? 'var(--bg-amber-100)' : isAdd ? 'var(--bg-blue-200)' : undefined }}>
                        <td style={{ ...cell, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{isAdd ? '+' : d.lineNo}{bad ? <span title="This line's own arithmetic fails" aria-label="This line's own arithmetic fails" style={{ marginLeft: 4, color: 'var(--text-amber-800)' }}>!</span> : null}</td>
                        <td style={{ ...cell, width: 110 }}><input aria-label={`Line ${d.lineNo} code`} value={d.houseCode} onChange={(e) => setDraft(i, { houseCode: e.target.value })} disabled={accepted || busy} style={input} /></td>
                        <td style={{ ...cell, minWidth: 180 }}><input aria-label={`Line ${d.lineNo} description`} value={d.description} onChange={(e) => setDraft(i, { description: e.target.value })} disabled={accepted || busy} style={input} /></td>
                        <td style={{ ...cell, width: 70 }}><input aria-label={`Line ${d.lineNo} quantity shipped`} inputMode="decimal" value={d.qtyShipped} onChange={(e) => setDraft(i, { qtyShipped: e.target.value })} disabled={accepted || busy} style={num} /></td>
                        <td style={{ ...cell, width: 56 }}><input aria-label={`Line ${d.lineNo} unit`} value={d.unit} onChange={(e) => setDraft(i, { unit: e.target.value })} disabled={accepted || busy} style={input} /></td>
                        <td style={{ ...cell, width: 104 }}><input aria-label={`Line ${d.lineNo} unit price`} inputMode="decimal" value={d.unitPrice} onChange={(e) => setDraft(i, { unitPrice: e.target.value })} disabled={accepted || busy} style={num} /></td>
                        <td style={{ ...cell, width: 70 }}>
                          <select aria-label={`Line ${d.lineNo} pricing unit`} value={d.pricingUnit} onChange={(e) => setDraft(i, { pricingUnit: e.target.value as PricingUnit })} disabled={accepted || busy} style={{ ...input, maxWidth: 70 }}>
                            <option value="each">each</option>
                            <option value="per_hundred">per C</option>
                            <option value="per_thousand">per M</option>
                          </select>
                        </td>
                        <td style={{ ...cell, width: 90 }}><input aria-label={`Line ${d.lineNo} extension`} inputMode="decimal" value={d.extended} onChange={(e) => setDraft(i, { extended: e.target.value })} disabled={accepted || busy} style={num} /></td>
                        <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                          {isAdd ? null : (
                            <>
                              <select aria-label={`Line ${d.lineNo} kind`} value={d.lineKind} onChange={(e) => setDraft(i, { lineKind: e.target.value as LineDraft['lineKind'] })} disabled={accepted || busy} style={{ ...input, width: 'auto', fontSize: '0.75rem' }}>
                                <option value="part">part</option>
                                <option value="charge">charge</option>
                                <option value="component">kit part</option>
                              </select>
                              <button type="button" onClick={() => removeDraft(i)} disabled={accepted || busy} aria-label={`Remove line ${d.lineNo}`} title="Remove this line" style={{ marginLeft: 4, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={7} style={{ ...cell, borderBottom: 0, textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{counted.length} {counted.length === 1 ? 'line' : 'lines'} · the paper's subtotal {paper.subtotalCents == null ? 'is not printed' : moneyWords(paper.subtotalCents)}</td>
                    <td style={{ ...cell, borderBottom: 0, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{moneyWords(check.sumCents)}</td>
                    <td style={{ ...cell, borderBottom: 0 }}></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {problem ? <div role="alert" style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{problem}</div> : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => void saveLines()} disabled={accepted || busy || (changed === 0 && check.state === paper.checkState)} style={{ padding: '0.45rem 0.9rem', borderRadius: 6, border: 'none', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', background: accepted || busy || (changed === 0 && check.state === paper.checkState) ? 'var(--bg-muted)' : '#2563eb', color: accepted || busy || (changed === 0 && check.state === paper.checkState) ? 'var(--text-muted)' : '#fff' }}>
                  {busy ? 'Saving…' : saveLinesLabel(changed, counted.length)}
                </button>
              </div>
              {!accepted && paper.checkState === 'off' ? (
                <button type="button" onClick={() => void acceptAnyway()} disabled={busy} style={{ padding: '0.45rem 0.9rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', fontSize: '0.8125rem', cursor: 'pointer' }}>
                  {ACCEPT_WORDS.press}
                </button>
              ) : null}
            </div>
            {!accepted && paper.checkState === 'off' ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ACCEPT_WORDS.press} records your name and the gap. The lines then count, with the gap kept beside them.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
