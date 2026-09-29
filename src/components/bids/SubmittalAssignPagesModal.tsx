/**
 * Assign pages (Submittals stage 3, v2.4143): a full-screen walk through one vendor PDF.
 * Left, the page at reading size with the answer pre-filled — the row whose model the
 * page's text names, else the row the page before is on, else the next row in the
 * schedule. Right, the rows in order with the lit answer and what each already has.
 * Below, every page as a strip colored by row: the map. Keys do the work: Space says
 * yes and moves on, Enter or a click puts the page on a row, X marks a page that is not
 * a cut sheet, ← → move without deciding, Backspace undoes the last pick, typing finds
 * a row. The package goes to the customer, so Done unlocks only when every page has
 * been seen and decided; nothing is written before then (the owner's rule — the file is
 * a working file, the record is the pages on rows).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import {
  commonHeader,
  decide,
  decisionsToWrites,
  fileSectionTags,
  doneButtonText,
  findPagesForRow,
  initialDecisions,
  pagesByItem,
  readPages,
  readsFromGuesses,
  rowColor,
  runStart,
  suggestFor,
  walkProgressText,
  walkRowsFrom,
  walkSummary,
  type Decision,
  type ItemWrite,
  type PageReads,
  type WalkDecisions,
} from '../../lib/submittals/assignPagesWalk'
import type { OpenPdf } from '../../lib/submittals/pdfThumbnails'
import { needsSheet, type SourceFile, type SubmittalItemRow } from '../../lib/submittals/submittalRevision'

type Props = {
  file: SourceFile
  fileIndex: number
  items: SubmittalItemRow[]
  /** The file's bytes from storage. */
  loadBytes: () => Promise<ArrayBuffer>
  /** The robot's guesses for this file (page → tag), when a split task answered. */
  guesses?: ReadonlyMap<number, { tag: string; sure: boolean }>
  busy: boolean
  onDone: (writes: ItemWrite[]) => void | Promise<void>
  /** v2.4171 · once every page is read: how many name a row, and whether the file is sectioned — for the file's line. */
  onReads?: (reads: { namesRows: number; sectioned: boolean }) => void
  onClose: () => void
}

const PAGE_WIDTH = 760
const THUMB_WIDTH = 44

const btn: CSSProperties = { padding: '0.4rem 0.85rem', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 500 }
const btnPrimary: CSSProperties = { ...btn, background: '#16a34a', borderColor: '#16a34a', color: 'white', fontWeight: 600 }
const btnQuiet: CSSProperties = { ...btn, background: 'transparent', borderColor: 'transparent', color: 'var(--text-muted)' }
const key: CSSProperties = { display: 'inline-block', font: '0.7rem/1 ui-monospace, Menlo, monospace', padding: '3px 6px', border: '1px solid var(--border-strong)', borderBottomWidth: 2, borderRadius: 4, background: 'var(--surface)', color: 'var(--text-strong)', marginRight: 4 }
const smallMuted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }

type Snapshot = { decisions: WalkDecisions; page: number }

export function SubmittalAssignPagesModal({ file, fileIndex, items, loadBytes, guesses, busy, onDone, onReads, onClose }: Props) {
  const confirm = useConfirmDialog()
  const rows = useMemo(() => walkRowsFrom(items), [items])
  const rowIndex = useMemo(() => new Map(rows.map((r, i) => [r.id, i])), [rows])
  const wants = useCallback((id: string) => {
    const it = items.find((i) => i.id === id)
    return it ? needsSheet(it) : false
  }, [items])

  const [pdf, setPdf] = useState<OpenPdf | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [pageCount, setPageCount] = useState(file.pages)
  const [texts, setTexts] = useState<string[]>([])
  const [textsDone, setTextsDone] = useState(false)
  const [thumbs, setThumbs] = useState<Record<number, string>>({})
  const [bigs, setBigs] = useState<Record<number, string>>({})
  const [page, setPage] = useState(1)
  const initial = useMemo(() => initialDecisions(items, fileIndex), [items, fileIndex])
  const [decisions, setDecisions] = useState<WalkDecisions>(initial)
  const [seen, setSeen] = useState<Set<number>>(() => new Set([1]))
  const [history, setHistory] = useState<Snapshot[]>([])
  const [filter, setFilter] = useState('')
  const [finding, setFinding] = useState<{ id: string; pages: number[] } | null>(null)
  const [saving, setSaving] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const stripRef = useRef<HTMLDivElement | null>(null)

  // Open the file once: the page count, then every page's thumbnail and text in order.
  useEffect(() => {
    let cancelled = false
    let opened: OpenPdf | null = null
    void (async () => {
      try {
        const bytes = await loadBytes()
        const { openPdf } = await import('../../lib/submittals/pdfThumbnails')
        opened = await openPdf(bytes)
        if (cancelled) return
        setPdf(opened)
        setPageCount(opened.numPages)
        setStatus('ready')
        const collected: string[] = []
        for (let p = 1; p <= opened.numPages; p++) {
          if (cancelled) return
          const [thumb, text] = await Promise.all([opened.renderPage(p, THUMB_WIDTH, 0.5).catch(() => ''), opened.pageText(p).catch(() => '')])
          collected.push(text)
          setThumbs((t) => ({ ...t, [p]: thumb }))
          setTexts([...collected])
        }
        setTextsDone(true)
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()
    return () => {
      cancelled = true
      opened?.destroy()
    }
  }, [loadBytes])

  // The page at reading size, drawn when it is reached and kept.
  useEffect(() => {
    if (!pdf || bigs[page]) return
    let cancelled = false
    void pdf.renderPage(page, PAGE_WIDTH).then((url) => {
      if (!cancelled) setBigs((b) => ({ ...b, [page]: url }))
    }).catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [pdf, page, bigs])

  useEffect(() => {
    setSeen((s) => (s.has(page) ? s : new Set([...s, page])))
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-page="${page}"]`)
    el?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [page])

  useEffect(() => {
    rootRef.current?.focus()
  }, [status])

  const reads: PageReads = useMemo(() => ({ ...readsFromGuesses(guesses, rows), ...readPages(texts, rows) }), [guesses, rows, texts])
  const onReadsRef = useRef(onReads)
  onReadsRef.current = onReads
  useEffect(() => {
    if (!textsDone) return
    const header = commonHeader(texts)
    onReadsRef.current?.({ namesRows: Object.values(readPages(texts, rows)).filter((r) => r.itemId !== null).length, sectioned: header ? fileSectionTags(texts, header).length > 0 : false })
  }, [textsDone, texts, rows])
  const suggestion = useMemo(() => suggestFor(page, decisions, reads, rows), [page, decisions, reads, rows])
  const summary = useMemo(() => walkSummary(decisions, seen, pageCount, rows, wants), [decisions, seen, pageCount, rows, wants])
  const have = useMemo(() => pagesByItem(decisions), [decisions])
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows])

  const filtered = useMemo(() => {
    const q = filter.trim().toUpperCase()
    if (!q) return rows
    return rows.filter((r) => r.tag.toUpperCase().includes(q) || r.label.toUpperCase().includes(q) || r.models.some((m) => m.replace(/ /g, '').includes(q.replace(/[^A-Z0-9]/g, ''))))
  }, [rows, filter])

  const goTo = useCallback((p: number) => {
    setPage(Math.min(Math.max(1, p), pageCount))
  }, [pageCount])

  const pick = useCallback((value: Decision) => {
    setHistory((h) => [...h.slice(-199), { decisions, page }])
    setDecisions((d) => decide(d, page, value))
    setFilter('')
    setFinding(null)
    if (page < pageCount) setPage(page + 1)
  }, [decisions, page, pageCount])

  const undo = useCallback(() => {
    setHistory((h) => {
      const last = h[h.length - 1]
      if (!last) return h
      setDecisions(last.decisions)
      setPage(last.page)
      return h.slice(0, -1)
    })
  }, [])

  const dirty = useMemo(() => decisionsToWrites(items, fileIndex, decisions).length > 0, [items, fileIndex, decisions])

  const close = useCallback(async () => {
    if (dirty) {
      const ok = await confirm({ title: 'Leave the walk?', message: 'Nothing has been written to the rows. The picks you made in this walk are lost.', confirmLabel: 'Leave', danger: true })
      if (!ok) return
    }
    onClose()
  }, [dirty, confirm, onClose])

  const finish = useCallback(async () => {
    if (!summary.done || saving) return
    setSaving(true)
    try {
      await onDone(decisionsToWrites(items, fileIndex, decisions))
    } finally {
      setSaving(false)
    }
  }, [summary.done, saving, onDone, items, fileIndex, decisions])

  const onKey = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (status !== 'ready' || saving) return
    const k = e.key
    if (k === ' ' || (k === 'Enter' && !filter.trim())) {
      e.preventDefault()
      if (suggestion.value != null) pick(suggestion.value)
      return
    }
    if (k === 'Enter') {
      e.preventDefault()
      const first = filtered[0]
      if (first) pick(first.id)
      return
    }
    if (k === 'ArrowRight') {
      e.preventDefault()
      goTo(page + 1)
      return
    }
    if (k === 'ArrowLeft') {
      e.preventDefault()
      goTo(page - 1)
      return
    }
    if (k === 'Backspace') {
      e.preventDefault()
      if (filter) setFilter((f) => f.slice(0, -1))
      else undo()
      return
    }
    if (k === 'Escape') {
      e.preventDefault()
      if (filter) setFilter('')
      else void close()
      return
    }
    if ((k === 'x' || k === 'X') && !filter) {
      e.preventDefault()
      pick('skip')
      return
    }
    if (k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      setFilter((f) => (f + k).slice(0, 24))
    }
  }, [status, saving, filter, suggestion, pick, filtered, goTo, page, undo, close])

  const sug = suggestion.value != null && suggestion.value !== 'skip' ? byId.get(suggestion.value) : null
  const bannerTone = suggestion.why === 'read' || suggestion.why === 'kept' ? 'sure' : suggestion.why === 'none' ? 'none' : 'guess'
  const bannerHead =
    suggestion.why === 'none' ? 'No row to suggest — pick one, or X if this is not a cut sheet'
      : suggestion.value === 'skip' ? (suggestion.why === 'kept' ? 'Not a cut sheet' : reads[page]?.why === 'other' ? `Stamped ${(reads[page] as { tag: string }).tag} — not a row on this revision` : 'Looks like the index — not a cut sheet')
      : suggestion.why === 'kept' ? `Already on ${sug?.tag || sug?.label}`
      : suggestion.why === 'read' ? `Looks like ${sug?.tag || ''} · ${sug?.label || ''}`
      : suggestion.why === 'continue' ? `${sug?.tag || sug?.label} continues`
      : `Next in the schedule: ${sug?.tag || ''} · ${sug?.label || ''}`
  const bannerSub =
    suggestion.why === 'read' ? (suggestion.value === 'skip' ? (reads[page]?.why === 'other' ? 'X leaves it out; pick a row if it belongs to one' : 'the page names four or more rows') : reads[page]?.why === 'stamp' ? 'the file stamps its tag on the page' : reads[page]?.why === 'tag' ? 'its tag is on the page' : 'its model number is on the page')
      : suggestion.why === 'kept' ? 'kept from before — Space keeps it'
      : suggestion.why === 'continue' ? `same as page ${runStart(decisions, page - 1)}${runStart(decisions, page - 1) !== page - 1 ? `–${page - 1}` : ''} · nothing read on this page`
      : suggestion.why === 'next' ? 'nothing read on this page; the PDF usually follows the schedule'
      : ''

  const bannerStyle: CSSProperties = bannerTone === 'sure'
    ? { background: 'var(--bg-green-tint)', border: '1px solid #16a34a' }
    : bannerTone === 'guess' ? { background: 'var(--bg-yellow-tint)', border: '1px solid #d97706' }
      : { background: 'var(--bg-muted)', border: '1px solid var(--border)' }

  return (
    <div role="dialog" aria-modal="true" aria-label={`Assign pages — ${file.name}`} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--surface)', color: 'var(--text-base)', display: 'flex', flexDirection: 'column' }} data-testid="assign-pages">
      <div ref={rootRef} tabIndex={-1} onKeyDown={onKey} style={{ outline: 'none', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <div>
            <b style={{ fontSize: '0.95rem' }}>Assign pages</b> <span style={smallMuted}>· {file.name} · {pageCount} page{pageCount === 1 ? '' : 's'}{status === 'ready' && !textsDone ? ' · reading…' : ''}</span>
          </div>
          <span style={smallMuted} data-testid="assign-progress">{walkProgressText(summary)}</span>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button type="button" onClick={() => void close()} style={btnQuiet} disabled={saving}>Cancel</button>
            <button type="button" onClick={undo} style={btnQuiet} disabled={history.length === 0 || saving} title="Undo the last pick (Backspace)">Undo</button>
            <button type="button" onClick={() => void finish()} disabled={!summary.done || busy || saving} style={{ ...btnPrimary, opacity: summary.done ? 1 : 0.55 }} title={summary.done ? 'Write the pages onto the rows' : 'Every page has to be seen and decided first'} data-testid="assign-done">
              {saving ? 'Writing…' : doneButtonText(summary)}
            </button>
          </div>
        </div>

        {status === 'error' ? (
          <div style={{ padding: '2rem', color: 'var(--text-red-700)' }}>Could not open the file — it may not be a readable PDF.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 1fr)', flex: 1, minHeight: 0 }}>
            <div style={{ padding: '0.7rem 1rem', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.6rem', minHeight: 0 }}>
              <div style={{ ...bannerStyle, borderRadius: 8, padding: '0.55rem 0.8rem', display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }} data-testid="assign-banner">
                <div style={{ flex: 1, minWidth: 200 }}>
                  <b style={{ fontSize: '0.9rem' }}>{bannerHead}</b>
                  {bannerSub ? <div style={smallMuted}>{bannerSub}</div> : null}
                </div>
                <div style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                  {suggestion.value != null ? <><span style={key}>Space</span> yes, next page &nbsp;</> : null}
                  <span style={key}>X</span> not a cut sheet
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', ...smallMuted }}>
                <span>Page <b style={{ color: 'var(--text-strong)' }}>{page}</b> of {pageCount} · <span style={key}>←</span><span style={key}>→</span> move without deciding</span>
                {decisions[page] !== undefined && decisions[page] !== 'skip' && runStart(decisions, page) !== page ? <span>run started at {runStart(decisions, page)}</span> : null}
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: 'var(--bg-muted)', borderRadius: 6, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '0.5rem' }}>
                {bigs[page] ? (
                  <img src={bigs[page]} alt={`Page ${page}`} style={{ maxWidth: '100%', boxShadow: '0 2px 10px rgba(0,0,0,0.35)', background: 'var(--surface)' }} data-testid="assign-page-image" />
                ) : (
                  <span style={{ ...smallMuted, padding: '2rem' }}>{status === 'loading' ? 'Opening the file…' : 'Drawing the page…'}</span>
                )}
              </div>
            </div>

            <div style={{ padding: '0.7rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: 0 }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', ...smallMuted }}>
                Find
                <span style={{ flex: 1, border: '1px solid var(--border-strong)', borderRadius: 5, padding: '0.3rem 0.5rem', background: 'var(--bg-muted)', color: filter ? 'var(--text-strong)' : 'var(--text-muted)', minHeight: '1.9rem' }} data-testid="assign-filter">
                  {filter || 'type a tag or a model… Enter picks the first match'}
                </span>
                {filter ? <button type="button" onClick={() => setFilter('')} style={btnQuiet}>clear</button> : null}
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8 }} data-testid="assign-rows">
                {filtered.map((r) => {
                  const i = rowIndex.get(r.id) ?? 0
                  const pages = have.get(r.id) ?? []
                  const isSug = suggestion.value === r.id
                  const owes = wants(r.id) && pages.length === 0
                  const found = finding?.id === r.id ? finding.pages : null
                  return (
                    <div key={r.id} data-testid="assign-row" data-suggested={isSug ? 'true' : undefined}>
                      <button
                        type="button"
                        onClick={() => pick(r.id)}
                        disabled={status !== 'ready' || saving}
                        style={{ display: 'grid', gridTemplateColumns: '92px 1fr auto', gap: '0.5rem', width: '100%', textAlign: 'left', padding: '0.4rem 0.6rem', border: 'none', borderBottom: '1px solid var(--border)', background: isSug ? 'var(--bg-blue-tint)' : 'transparent', color: 'var(--text-base)', font: 'inherit', fontSize: '0.8125rem', cursor: 'pointer', alignItems: 'center', outline: isSug ? '1px solid #2563eb' : 'none', outlineOffset: -1 }}
                        title={`Put page ${page} on ${r.tag || r.label}`}
                      >
                        <span style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: rowColor(i), marginRight: 6, verticalAlign: 'middle' }} />{r.tag || 'accessory'}</span>
                        <span style={{ ...smallMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label || '—'}</span>
                        <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', color: pages.length ? 'var(--text-green-700)' : owes ? 'var(--text-amber-700)' : 'var(--text-muted)' }}>
                          {pages.length ? `p. ${describePages(pages)}` : owes ? 'no sheet yet' : '—'}
                        </span>
                      </button>
                      {owes && textsDone ? (
                        <div style={{ padding: '0 0.6rem 0.35rem', ...smallMuted, display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          {found ? (
                            found.length ? (
                              <>
                                names it on: {found.map((p) => (
                                  <button key={p} type="button" onClick={() => { setFinding(null); goTo(p) }} style={{ ...btn, padding: '0 0.45rem', fontSize: '0.72rem', borderRadius: 999 }}>p. {p}</button>
                                ))}
                              </>
                            ) : <span>no page names its model</span>
                          ) : (
                            <button type="button" onClick={() => setFinding({ id: r.id, pages: findPagesForRow(texts, r) })} style={{ ...btnQuiet, padding: 0, textDecoration: 'underline', fontSize: '0.72rem' }} data-testid="assign-find">find its pages</button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
                {filtered.length === 0 ? <div style={{ padding: '0.6rem', ...smallMuted }}>No row matches “{filter}”.</div> : null}
              </div>
              <div style={smallMuted}>Schedule order. <b style={{ color: 'var(--text-strong)' }}>Enter</b> or a click puts this page on the lit row and moves on. Every page must be seen before Done — the package goes to the customer.</div>
            </div>
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--border)', padding: '0.5rem 1rem 0.6rem' }}>
          <div ref={stripRef} style={{ display: 'flex', gap: 3, overflowX: 'auto', paddingBottom: 4 }} data-testid="assign-strip">
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => {
              const d = decisions[p]
              const color = d === undefined ? null : d === 'skip' ? 'skip' : rowColor(rowIndex.get(d) ?? 0)
              const starts = d !== undefined && d !== 'skip' && decisions[p - 1] !== d
              return (
                <button key={p} type="button" data-page={p} onClick={() => goTo(p)} title={`Page ${p}${d === 'skip' ? ' · not a cut sheet' : d ? ` · ${byId.get(d)?.tag ?? ''}` : seen.has(p) ? ' · seen, undecided' : ' · not seen yet'}`} style={{ flex: '0 0 auto', width: THUMB_WIDTH, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', font: 'inherit', textAlign: 'center' }}>
                  <div style={{ height: 40, borderRadius: 2, overflow: 'hidden', background: seen.has(p) ? 'var(--bg-muted)' : 'var(--border)', outline: p === page ? '2px solid var(--text-strong)' : 'none', outlineOffset: 1, position: 'relative', opacity: d === 'skip' ? 0.45 : 1 }}>
                    {thumbs[p] ? <img src={thumbs[p]} alt="" style={{ width: '100%', display: 'block' }} /> : null}
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, background: color === 'skip' ? 'repeating-linear-gradient(135deg, var(--text-muted) 0 3px, transparent 3px 6px)' : color ?? 'transparent' }} />
                  </div>
                  <div style={{ fontSize: '0.6rem', color: starts ? 'var(--text-strong)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: starts ? 700 : 400 }}>{starts ? byId.get(d)?.tag || p : p}</div>
                </button>
              )
            })}
          </div>
          <div style={{ ...smallMuted, display: 'flex', gap: '0.9rem', flexWrap: 'wrap', marginTop: 4 }}>
            <span><b style={{ color: 'var(--text-strong)' }}>Space</b> yes / same as the last page</span>
            <span><b style={{ color: 'var(--text-strong)' }}>Enter</b> or click a row</span>
            <span><b style={{ color: 'var(--text-strong)' }}>← →</b> move</span>
            <span><b style={{ color: 'var(--text-strong)' }}>Backspace</b> undo</span>
            <span><b style={{ color: 'var(--text-strong)' }}>X</b> not a cut sheet</span>
            <span><b style={{ color: 'var(--text-strong)' }}>type</b> to find a row</span>
            <span>click a page to jump · grey bar = not decided · hatched = not a cut sheet</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** "3–6" · "3, 8" · "3–4, 9" */
function describePages(pages: number[]): string {
  const out: string[] = []
  let start = pages[0]!
  let prev = start
  for (let i = 1; i <= pages.length; i++) {
    const p = pages[i]
    if (p !== undefined && p === prev + 1) {
      prev = p
      continue
    }
    out.push(start === prev ? String(start) : `${start}–${prev}`)
    if (p !== undefined) {
      start = p
      prev = p
    }
  }
  return out.join(', ')
}
