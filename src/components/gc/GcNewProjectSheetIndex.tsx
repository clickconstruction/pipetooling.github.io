import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  SHEET_DISCIPLINES,
  nextSheetNumber,
  readSheetLines,
  readTitleBlock,
  rowProblems,
  sheetDiscipline,
  type PdfTextItem,
  type PlanSheet,
  type SheetIndexRow,
} from '../../lib/gcMode/gcModel'
import { getPdfLoadingTask } from '../../lib/pdfjsDocument'
import { loadJsPDF } from '../../lib/loadJsPDF'
import { Btn, Chip, input } from './gcUi'
import { Picker } from './GcNewProjectPickers'
import { FIELD_HEIGHT_PX } from './GcNewProjectPickerRows'

/**
 * GC mode design spike: the sheet index as one table (the owner, 2026-10-04: "build 1, 4 and 5 for
 * the sheet index"). Three ways in, all landing as rows of the one table: the plan PDF, each page's
 * title block read with its page number (a page with no number becomes a row to fix; dropping a
 * file is coming soon, since the plans come by their Drive link for now); paste a sheet list in any layout and see each line read or skipped with why; or type them,
 * with + Add sheet filling in the next number. Rows can be fixed, moved, taken out, and put in a
 * discipline where the number's letters do not say it.
 */

const field: CSSProperties = { ...input, width: '100%', boxSizing: 'border-box', height: FIELD_HEIGHT_PX }

const bare = (id: string) => id.toUpperCase().replace(/[-.\s]/g, '')

/** Row keys for the whole page, so a list opened again (a step left and come back to) never repeats one. */
let rowKeys = 0
const newKey = () => `sheet-${++rowKeys}`

type PdfStatus =
  | { kind: 'idle' }
  | { kind: 'reading'; name: string; page: number; of: number }
  | { kind: 'done'; name: string; read: number; of: number; matched: number; noText: boolean }
  | { kind: 'failed'; name: string }

/** Each page of a plan PDF: its number, and the sheet its title block names (null: none found). */
async function readPlanPdf(bytes: ArrayBuffer, onPage: (page: number, of: number) => void): Promise<{ page: number; sheet: PlanSheet | null; hasText: boolean }[]> {
  const task = await getPdfLoadingTask(bytes)
  try {
    const doc = await task.promise
    const out: { page: number; sheet: PlanSheet | null; hasText: boolean }[] = []
    for (let n = 1; n <= doc.numPages; n++) {
      onPage(n, doc.numPages)
      const page = await doc.getPage(n)
      const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = page.view
      const content = await page.getTextContent()
      const items: PdfTextItem[] = []
      for (const item of content.items) {
        if (!('str' in item) || item.str.trim() === '') continue
        const t = item.transform as number[]
        items.push({ str: item.str, x: (t[4] ?? 0) - x0, y: (t[5] ?? 0) - y0, size: Math.hypot(t[2] ?? 0, t[3] ?? 0) || Math.abs(t[0] ?? 0) })
      }
      out.push({ page: n, sheet: readTitleBlock(items, x1 - x0, y1 - y0), hasText: items.length > 0 })
    }
    return out
  } finally {
    void task.destroy()
  }
}

/**
 * A made-up plan PDF, drawn here and then read back the same way a real one is: one landscape page
 * a sheet, each with notes in the drawing area and a title block in the bottom right, and a
 * rendering with no title block as page 2.
 */
async function madeUpPlanPdf(sheets: PlanSheet[], projectName: string, setLabel: string): Promise<ArrayBuffer> {
  const JsPDF = await loadJsPDF()
  const doc = new JsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' })
  const W = 792
  const H = 612
  const frame = () => {
    doc.setLineWidth(1.2)
    doc.rect(18, 18, W - 36, H - 36)
  }
  sheets.forEach((s, i) => {
    if (i > 0) doc.addPage()
    frame()
    // The drawing: a few rooms and the general notes.
    doc.setLineWidth(0.8)
    doc.rect(70, 150, 230, 160)
    doc.rect(300, 150, 160, 160)
    doc.rect(70, 310, 390, 120)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('GENERAL NOTES', 40, 50)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('1. VERIFY ALL DIMENSIONS IN THE FIELD BEFORE STARTING WORK.', 40, 66)
    doc.text('2. SEE A-501 FOR ROOF DETAILS AND G-001 FOR THE CODE SUMMARY.', 40, 78)
    // The title block.
    const bx = W - 210
    const by = H - 250
    doc.setLineWidth(1)
    doc.rect(bx, by, 192, 232)
    doc.line(bx, by + 70, bx + 192, by + 70)
    doc.line(bx, by + 160, bx + 192, by + 160)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('ORTIZ + LANE ARCHITECTS', bx + 10, by + 22)
    doc.setFont('helvetica', 'normal')
    doc.text(projectName || 'New project', bx + 10, by + 38)
    doc.setFontSize(8)
    doc.text(`${setLabel.toUpperCase()}   ISSUED 09/30/2026`, bx + 10, by + 54)
    doc.setFontSize(7)
    doc.text('SHEET TITLE', bx + 10, by + 86)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    const titleLines = doc.splitTextToSize(s.title.toUpperCase(), 172) as string[]
    titleLines.slice(0, 3).forEach((line, n) => doc.text(line, bx + 10, by + 104 + n * 15))
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text('SHEET NO.', bx + 10, by + 176)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(30)
    doc.text(s.id, bx + 10, by + 214)
    if (i === 0) {
      doc.addPage()
      frame()
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(30)
      doc.text('RENDERING', W / 2, H / 2 - 10, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(12)
      doc.text('FOR REFERENCE ONLY. NOT FOR CONSTRUCTION.', W / 2, H / 2 + 16, { align: 'center' })
    }
  })
  return doc.output('arraybuffer')
}

/** The sheet table with its three ways in. */
export function SheetIndexTable({
  rows,
  onRows,
  sampleText,
  sampleSheets,
  projectName,
  setLabel,
}: {
  rows: SheetIndexRow[]
  onRows: (rows: SheetIndexRow[]) => void
  /** The made-up list "Paste a made-up sheet index" fills in. */
  sampleText: string
  /** The sheets drawn into the made-up plan PDF. */
  sampleSheets: PlanSheet[]
  projectName: string
  setLabel: string
}) {
  const rowsNow = useRef(rows)
  rowsNow.current = rows
  const [pdf, setPdf] = useState<PdfStatus>({ kind: 'idle' })
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const inputs = useRef(new Map<string, HTMLInputElement>())

  useEffect(() => {
    if (!focusKey) return
    inputs.current.get(focusKey)?.focus()
    setFocusKey(null)
  }, [focusKey, rows])

  const problems = useMemo(() => rowProblems(rows), [rows])

  /** The list's own width, since it sits in a column: under 520px a row puts its discipline and page beneath it. */
  const box = useRef<HTMLDivElement>(null)
  const [tight, setTight] = useState(false)
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(([entry]) => setTight((entry?.contentRect.width ?? 999) < 520))
    watch.observe(el)
    return () => watch.disconnect()
  }, [])

  // --- 1. The plan PDF -----------------------------------------------------------------------------
  const readPdf = async (name: string, bytes: ArrayBuffer) => {
    setPdf({ kind: 'reading', name, page: 0, of: 0 })
    try {
      const pages = await readPlanPdf(bytes, (page, of) => setPdf({ kind: 'reading', name, page, of }))
      const next = [...rowsNow.current]
      let matched = 0
      for (const p of pages) {
        if (!p.sheet) {
          next.push({
            key: newKey(),
            id: '',
            title: '',
            page: p.page,
            from: 'pdf',
            problem: `Page ${p.page}: no sheet number found on it. Type the number, or take the row out.`,
          })
          continue
        }
        const sheet = p.sheet
        const same = next.findIndex((r) => r.id.trim() !== '' && bare(r.id) === bare(sheet.id))
        const there = same >= 0 ? next[same] : undefined
        if (there) {
          // Already listed (typed or pasted): the PDF adds its page, and its title when the row has none.
          matched++
          next[same] = { ...there, page: there.page ?? p.page, title: there.title.trim() === '' ? sheet.title : there.title }
          continue
        }
        next.push({ key: newKey(), id: sheet.id, title: sheet.title, page: p.page, from: 'pdf' })
      }
      onRows(next)
      setPdf({ kind: 'done', name, read: pages.filter((p) => p.sheet).length, of: pages.length, matched, noText: pages.every((p) => !p.hasText) })
    } catch {
      setPdf({ kind: 'failed', name })
    }
  }
  const readMadeUpPdf = async () => {
    setPdf({ kind: 'reading', name: 'made-up plans.pdf', page: 0, of: 0 })
    try {
      await readPdf('made-up plans.pdf', await madeUpPlanPdf(sampleSheets, projectName, setLabel))
    } catch {
      setPdf({ kind: 'failed', name: 'made-up plans.pdf' })
    }
  }

  // --- 4. A pasted list ----------------------------------------------------------------------------
  const pasteLines = pasteText.split(/\r?\n/)
  const lineAt = pasteLines.flatMap((l, i) => (l.trim() === '' ? [] : [i]))
  const preview = useMemo(
    () => readSheetLines(pasteText, rows.filter((r) => r.id.trim() !== '').map((r) => r.id)),
    [pasteText, rows],
  )
  const readCount = preview.filter((l) => l.sheet).length
  const fixLine = (at: number, text: string) => {
    const lines = [...pasteLines]
    lines[at] = text
    setPasteText(lines.join('\n'))
  }
  const addPasted = () => {
    const added: SheetIndexRow[] = preview.flatMap((l) => (l.sheet ? [{ key: newKey(), id: l.sheet.id, title: l.sheet.title, from: 'paste' as const }] : []))
    onRows([...rows, ...added])
    // The lines with no number stay in the box, so nothing pasted goes missing unsaid.
    const left = preview.filter((l) => !l.sheet && l.why?.startsWith('No sheet number')).map((l) => l.line)
    setPasteText(left.join('\n'))
    if (left.length === 0) setPasteOpen(false)
  }

  // --- 5. Typing and fixing ------------------------------------------------------------------------
  const update = (key: string, change: Partial<SheetIndexRow>) => onRows(rows.map((r) => (r.key === key ? { ...r, ...change } : r)))
  const move = (key: string, by: -1 | 1) => {
    const at = rows.findIndex((r) => r.key === key)
    const to = at + by
    if (at < 0 || to < 0 || to >= rows.length) return
    const next = [...rows]
    const [row] = next.splice(at, 1)
    if (row) next.splice(to, 0, row)
    onRows(next)
  }
  const addSheet = () => {
    const last = [...rows].reverse().find((r) => r.id.trim() !== '')
    const taken = new Set(rows.map((r) => bare(r.id)))
    let id = last ? nextSheetNumber(last.id) : ''
    for (let tries = 0; id !== '' && taken.has(bare(id)) && tries < 100; tries++) id = nextSheetNumber(id)
    const key = newKey()
    onRows([...rows, { key, id, title: '', from: 'typed' }])
    setFocusKey(id === '' ? `${key}:id` : `${key}:title`)
  }

  const pdfWords =
    pdf.kind === 'reading'
      ? pdf.of > 0
        ? `Reading page ${pdf.page} of ${pdf.of} of ${pdf.name}…`
        : `Opening ${pdf.name}…`
      : pdf.kind === 'done'
        ? pdf.noText
          ? `${pdf.name} has no text on its pages. It may be a scan. Paste the sheet list or type the sheets.`
          : [
              `Read ${pdf.read} of ${pdf.of} ${pdf.of === 1 ? 'page' : 'pages'} from ${pdf.name}.`,
              pdf.matched > 0 ? `${pdf.matched} ${pdf.matched === 1 ? 'was' : 'were'} already listed, so ${pdf.matched === 1 ? 'it got its' : 'they got their'} page number.` : '',
              pdf.of - pdf.read > 0 ? `${pdf.of - pdf.read} ${pdf.of - pdf.read === 1 ? 'page needs its' : 'pages need their'} number typed below.` : '',
            ]
              .filter(Boolean)
              .join(' ')
        : pdf.kind === 'failed'
          ? `${pdf.name} could not be read as a PDF.`
          : ''

  const smallBtn: CSSProperties = {
    width: 26,
    height: FIELD_HEIGHT_PX,
    border: '1px solid var(--border)',
    borderRadius: 6,
    background: 'var(--surface)',
    color: 'var(--text-600)',
    cursor: 'pointer',
    padding: 0,
    fontSize: '0.85rem',
  }

  return (
    <div ref={box} style={{ display: 'grid', gap: '0.6rem', minWidth: 0 }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>The sheets</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          Drop the plan PDF, paste the sheet list, or type them. All three land in this one list.
        </div>
      </div>

      {/* The owner, 2026-10-04: no upload for now ("keep an uploading option but say coming soon"); the plans come by their Google Drive link. */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => e.preventDefault()}
        style={{
          border: '1.5px dashed var(--border-strong)',
          background: 'var(--bg-subtle)',
          borderRadius: 8,
          padding: '0.6rem 0.75rem',
          display: 'grid',
          gap: '0.45rem',
          fontSize: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <strong style={{ color: 'var(--text-muted)' }}>Drop the plan PDF here.</strong>
          <Chip tone="grey">Coming soon</Chip>
        </div>
        <div style={{ color: 'var(--text-muted)' }}>
          For now, give the Google Drive link above. Its sheets can be read from the PDF there, each with its page number.
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Btn onClick={() => undefined} disabled title="Coming soon">Choose the PDF</Btn>
          <Btn kind="quiet" onClick={() => void readMadeUpPdf()} disabled={pdf.kind === 'reading'}>Read a made-up plan PDF</Btn>
          {!pasteOpen && <Btn kind="quiet" onClick={() => setPasteOpen(true)}>Paste a sheet list</Btn>}
        </div>
        {pdfWords && (
          <div role="status" style={{ color: pdf.kind === 'failed' || (pdf.kind === 'done' && (pdf.noText || pdf.read < pdf.of)) ? 'var(--text-amber-700)' : 'var(--text-600)' }}>
            {pdfWords}
          </div>
        )}
      </div>

      {pasteOpen && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.45rem', fontSize: '0.85rem' }}>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span style={{ fontWeight: 600 }}>Paste the sheet list</span>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={6}
              placeholder={'G-001  Cover sheet\nFLOOR PLAN ........ A-101\n3. M-101 HVAC plan'}
              style={{ ...field, height: 'auto', fontFamily: 'inherit', resize: 'vertical' }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              Any layout reads. The number can come first or last. Titles in capitals read in sentence case.
            </span>
          </label>
          {preview.length > 0 && (
            <div style={{ display: 'grid', gap: '0.2rem', maxHeight: 260, overflowY: 'auto', paddingRight: '0.2rem' }}>
              {preview.map((l, i) => {
                const at = lineAt[i] ?? 0
                if (l.sheet)
                  return (
                    <div key={i} style={{ display: 'flex', gap: '0.45rem', alignItems: 'baseline' }}>
                      <span aria-hidden style={{ color: 'var(--text-green-700)' }}>✓</span>
                      <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: '3.6rem' }}>{l.sheet.id}</span>
                      <span>{l.sheet.title || <span style={{ color: 'var(--text-muted)' }}>no title</span>}</span>
                    </div>
                  )
                const fixable = l.why?.startsWith('No sheet number')
                return (
                  <div key={i} style={{ display: 'grid', gap: '0.15rem', padding: '0.2rem 0', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'baseline' }}>
                      <span aria-hidden>–</span>
                      <span>
                        {!fixable && <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.78rem' }}>{l.line} </span>}
                        Skipped. {l.why}
                      </span>
                    </div>
                    {fixable && (
                      <input
                        aria-label={`Fix the line: ${l.line}`}
                        value={pasteLines[at] ?? l.line}
                        onChange={(e) => fixLine(at, e.target.value)}
                        style={{ ...field, background: 'var(--bg-amber-tint)', fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem' }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <Btn kind="primary" onClick={addPasted} disabled={readCount === 0}>
              {readCount === 0 ? 'No sheets read yet' : `Add the ${readCount} ${readCount === 1 ? 'sheet' : 'sheets'} read`}
            </Btn>
            {pasteText.trim() === '' && <Btn kind="quiet" onClick={() => setPasteText(sampleText)}>Paste a made-up sheet index</Btn>}
            <Btn
              kind="quiet"
              onClick={() => {
                setPasteText('')
                setPasteOpen(false)
              }}
            >
              Close
            </Btn>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: '0.3rem' }}>
        {rows.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.3rem 0' }}>
            No sheets yet. Drop the plan PDF, paste the sheet list, or press + Add sheet to type them.
          </div>
        )}
        {rows.map((r, i) => {
          const letters = sheetDiscipline(r.id)
          const pick = r.id.trim() !== '' && (letters === 'Other' || (r.discipline !== undefined && r.discipline !== letters))
          const problem = problems[r.key]
          const name = r.id.trim() || `the row on page ${r.page ?? i + 1}`
          const discipline = pick ? (
            <Picker
              value={r.discipline ?? ''}
              onChange={(v) => update(r.key, { discipline: v === '' ? undefined : v })}
              options={[{ value: '', label: 'Pick a discipline' }, ...SHEET_DISCIPLINES.map((d) => ({ value: d, label: d }))]}
              placeholder="Pick a discipline"
              ariaLabel={`The discipline of ${name}`}
              searchPlaceholder="Search the disciplines"
              minListWidth={220}
            />
          ) : (
            <span title="Read from the number's letters">{r.id.trim() === '' ? '' : letters}</span>
          )
          const page = r.page ? <span title={`Page ${r.page} of the PDF`} style={{ fontVariantNumeric: 'tabular-nums' }}>p. {r.page}</span> : null
          return (
            <div key={r.key} style={{ display: 'grid', gap: '0.2rem' }}>
              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                <button type="button" aria-label={`Move ${name} up`} disabled={i === 0} onClick={() => move(r.key, -1)} style={{ ...smallBtn, opacity: i === 0 ? 0.4 : 1 }}>
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move ${name} down`}
                  disabled={i === rows.length - 1}
                  onClick={() => move(r.key, 1)}
                  style={{ ...smallBtn, opacity: i === rows.length - 1 ? 0.4 : 1 }}
                >
                  ↓
                </button>
                <input
                  ref={(el) => {
                    if (el) inputs.current.set(`${r.key}:id`, el)
                    else inputs.current.delete(`${r.key}:id`)
                  }}
                  aria-label="Sheet number"
                  value={r.id}
                  onChange={(e) => update(r.key, { id: e.target.value.toUpperCase() })}
                  placeholder="A-101"
                  style={{
                    ...field,
                    width: tight ? '5.4rem' : '6.2rem',
                    flex: tight ? '0 0 5.4rem' : '0 0 6.2rem',
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    borderColor: problem ? 'var(--text-amber-700)' : undefined,
                  }}
                />
                <input
                  ref={(el) => {
                    if (el) inputs.current.set(`${r.key}:title`, el)
                    else inputs.current.delete(`${r.key}:title`)
                  }}
                  aria-label={`Title of ${name}`}
                  value={r.title}
                  onChange={(e) => update(r.key, { title: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && i === rows.length - 1) {
                      e.preventDefault()
                      addSheet()
                    }
                  }}
                  placeholder="Floor plan"
                  style={{ ...field, flex: '1 1 6rem', minWidth: 0 }}
                />
                {!tight && <div style={{ flex: '0 0 9.5rem', minWidth: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{discipline}</div>}
                {!tight && <span style={{ flex: '0 0 2.4rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>{page}</span>}
                <button type="button" aria-label={`Take out ${name}`} onClick={() => onRows(rows.filter((x) => x.key !== r.key))} style={smallBtn}>
                  ×
                </button>
              </div>
              {tight && (pick || r.id.trim() !== '' || page) && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', paddingLeft: 'calc(52px + 0.6rem)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <div style={{ flex: pick ? '0 1 13rem' : '0 1 auto', minWidth: 0 }}>{discipline}</div>
                  {page}
                </div>
              )}
              {problem && <div style={{ color: 'var(--text-amber-700)', fontSize: '0.78rem', paddingLeft: 'calc(52px + 0.6rem)' }}>{problem}</div>}
            </div>
          )
        })}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Btn onClick={addSheet}>+ Add sheet</Btn>
          {rows.length > 0 && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              {(() => {
                const last = [...rows].reverse().find((x) => x.id.trim() !== '')
                return last ? `The next one is filled in after ${last.id.trim()}.` : ''
              })()}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
