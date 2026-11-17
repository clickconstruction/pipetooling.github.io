import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { addFileSizeWords } from '../../lib/jobs/jobFolderAddFile'
import {
  LIEN_SCAN_BATCH_WORDS,
  LIEN_SCAN_MATCH_WORDS,
  lienScanLeadWords,
  lienScanMatches,
  lienScanOutcome,
  lienScanPlan,
  lienScanPlanWords,
  lienScanTargetWords,
  type LienScanMatch,
  type LienScanPiece,
  type LienScanTarget,
} from '../../lib/jobs/lienScanBatch'
import { saveLienScans, type LienScanSave, type LienScanSaveResult } from '../../lib/jobs/lienScanBatchIo'
import { LIEN_SCAN_ACCEPT, lienScanIsPdf } from '../../lib/jobs/lienScanFile'
import {
  LIEN_SCAN_STACK_CHOICE,
  LIEN_SCAN_STACK_WORDS,
  lienScanPagesWords,
  lienScanStackChoiceOf,
  lienScanStackHeadWords,
  lienScanStackPageOf,
  lienScanStackPages,
  lienScanStackPieces,
  lienScanStackResolve,
  lienScanStackWith,
  type LienScanStackPage,
  type LienScanStackPiece,
  type LienScanStackResolved,
} from '../../lib/jobs/lienScanStack'
import { cutLienScanPages, lienScanPageCount } from '../../lib/jobs/lienScanStackIo'
import { PdfPageCanvas } from '../contracts/formStudio/PdfPageCanvas'

type Props = {
  /** Every filed affidavit on the desk (`lienScanTargetsFromDesk`). */
  targets: ReadonlyArray<LienScanTarget>
  isMobile?: boolean
  /** The desk reads again after a save. */
  onChanged: () => void
  onClose: () => void
  /** The writes, handed in by a test. */
  save?: typeof saveLienScans
  /** A picked PDF's page count and a lien's pages cut from a stack, handed in by a test. */
  countPages?: typeof lienScanPageCount
  cut?: typeof cutLienScanPages
  zIndex?: number
}

/** A piece as the window holds it: the kernel's facts and the file itself. */
type Held = LienScanPiece & { file: File }

const head: CSSProperties = { margin: 0, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const small: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const btn: CSSProperties = { padding: '0.4rem 0.95rem', fontSize: '0.8125rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 600, cursor: 'pointer' }
const press: CSSProperties = { ...btn, border: '1px solid transparent', background: '#2563eb', color: '#ffffff' }
const dead: CSSProperties = { ...btn, border: '1px solid var(--border)', background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'not-allowed' }
const field: CSSProperties = { padding: '0.3rem 0.45rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'inherit', minWidth: 0, width: '100%' }
const quiet: CSSProperties = { border: 'none', background: 'none', padding: 0, font: 'inherit', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer' }

let pieceSeq = 0

/** A page's picture, in CSS px per PDF point: a Letter page is 171 px wide on a computer and 122 px in a phone's two columns, inside its tile. */
const PAGE_SCALE = 0.28
const PAGE_SCALE_PHONE = 0.2

/** A file's bytes, for the page pictures. An older browser has no `arrayBuffer` on a file, so the reader is the way there. */
function readBytes(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Add the stamped scans (punch list #366): several filed liens' scans in one sitting, one file a lien, each saved to
 * its own job. The office picks the files; each is matched to a lien by the recording number or the job number in
 * its name, or by its place, and the line under it says which. The office checks each against the clerk's stamp and
 * changes any match before the press.
 *
 * A PDF of several pages is one file for one lien until the office says it holds several liens. Then its pages are
 * shown, each goes to a lien (in order to start with), and each lien's pages are cut into a PDF of their own when the
 * press saves. The stack itself is never uploaded.
 *
 * The press saves what is ready and leaves the rest with its reason. Nothing is recorded here but the saved copy:
 * the filing's own facts stay as **Record filing…** wrote them.
 */
export default function LienScanBatchWindow({ targets, isMobile, onChanged, onClose, save = saveLienScans, countPages = lienScanPageCount, cut = cutLienScanPages, zIndex = 1200 }: Props) {
  const isTopmost = useModalStackEntry()
  const { showToast } = useToastContext()
  const input = useRef<HTMLInputElement>(null)
  const [pieces, setPieces] = useState<Held[]>([])
  const [matches, setMatches] = useState<Record<string, LienScanMatch>>({})
  const [withScans, setWithScans] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<LienScanSaveResult['failed']>([])
  // A picked PDF's page count, once read; a file with more than one page is offered the split.
  const [pageCounts, setPageCounts] = useState<Record<string, number>>({})
  // The files the office split into liens (punch list #366, the stack): one rule a page, and the bytes for the thumbnails.
  const [stacks, setStacks] = useState<Record<string, LienScanStackPage[]>>({})
  const [stackBytes, setStackBytes] = useState<Record<string, ArrayBuffer>>({})
  // Pages already saved from a stack: they are shown as saved and go nowhere again.
  const [savedPages, setSavedPages] = useState<Record<string, number[]>>({})

  // The liens a scan can go to: the ones with none, and the rest only when asked, since saving replaces their link.
  const shown = useMemo(() => targets.filter((t) => withScans || !t.hasScan), [targets, withScans])
  // What the plan reads: a file that is one lien's stands as itself, and a split stack stands as one piece for each
  // lien that gets pages. A stack's in-order run steps over the liens the single files and the stacks above it hold.
  const laid = useMemo(() => {
    const taken = new Set(pieces.flatMap((p) => (stacks[p.key] ? [] : matches[p.key] ? [matches[p.key]!.filingId] : [])))
    const planPieces: LienScanPiece[] = []
    const planMatches: Record<string, LienScanMatch> = {}
    const resolved: Record<string, LienScanStackResolved> = {}
    for (const p of pieces) {
      const pages = stacks[p.key]
      if (!pages) {
        planPieces.push(p)
        planMatches[p.key] = matches[p.key] ?? null
        continue
      }
      const r = lienScanStackResolve(pages, shown, taken)
      resolved[p.key] = r
      for (const g of r.groups) taken.add(g.filingId)
      const cutUp = lienScanStackPieces({ key: p.key, name: p.name, size: p.size, pages }, r)
      planPieces.push(...cutUp.pieces)
      Object.assign(planMatches, cutUp.matches)
    }
    return { planPieces, planMatches, resolved }
  }, [pieces, matches, stacks, shown])
  const plan = useMemo(() => lienScanPlan(laid.planPieces, laid.planMatches, shown), [laid, shown])
  const words = lienScanPlanWords(plan)
  const heldByKey = new Map(plan.held.map((h) => [h.piece.key, h]))
  const anyWithScan = targets.some((t) => t.hasScan)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || busy || !isTopmost()) return
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, isTopmost, onClose])

  const add = (files: FileList | null) => {
    const picked: Held[] = Array.from(files ?? []).map((file) => ({ key: `p${(pieceSeq += 1)}`, name: file.name, size: file.size, type: file.type, file }))
    if (picked.length === 0) return
    // New files take the liens nobody has yet; a match already made or changed by hand stays.
    const taken = new Set(Object.values(matches).flatMap((m) => (m ? [m.filingId] : [])))
    const fresh = lienScanMatches(picked, shown.filter((t) => !taken.has(t.filingId)))
    setPieces((cur) => [...cur, ...picked])
    setMatches((cur) => ({ ...cur, ...fresh }))
    if (input.current) input.current.value = ''
    // A PDF's pages are counted behind the list: one of several pages is offered the split.
    for (const p of picked) {
      if (!lienScanIsPdf(p)) continue
      void countPages(p.file).then((n) => {
        if (n && n > 1) setPageCounts((cur) => ({ ...cur, [p.key]: n }))
      })
    }
  }

  const split = async (p: Held) => {
    const count = pageCounts[p.key]
    if (!count) return
    setStacks((cur) => ({ ...cur, [p.key]: lienScanStackPages(count) }))
    // The file's own lien is free again: its pages take liens of their own.
    setMatches((cur) => ({ ...cur, [p.key]: null }))
    try {
      const bytes = await readBytes(p.file)
      setStackBytes((cur) => ({ ...cur, [p.key]: bytes }))
    } catch {
      // The pages still split by their numbers; only the pictures are missing.
    }
  }

  const keepWhole = (p: Held) => {
    setStacks((cur) => Object.fromEntries(Object.entries(cur).filter(([k]) => k !== p.key)))
    setSavedPages((cur) => Object.fromEntries(Object.entries(cur).filter(([k]) => k !== p.key)))
    const taken = new Set(laid.planPieces.flatMap((x) => ((x as Partial<LienScanStackPiece>).stackKey === p.key ? [] : laid.planMatches[x.key] ? [laid.planMatches[x.key]!.filingId] : [])))
    setMatches((cur) => ({ ...cur, ...lienScanMatches([p], shown.filter((t) => !taken.has(t.filingId))) }))
  }

  const setPage = (key: string, index: number, next: LienScanStackPage) => setStacks((cur) => (cur[key] ? { ...cur, [key]: lienScanStackWith(cur[key], index, next) } : cur))

  const remove = (key: string) => {
    setPieces((cur) => cur.filter((p) => p.key !== key))
    setMatches((cur) => Object.fromEntries(Object.entries(cur).filter(([k]) => k !== key)))
    setFailed((cur) => cur.filter((f) => f.save.key !== key && !f.save.key.startsWith(`${key}:`)))
    setStacks((cur) => Object.fromEntries(Object.entries(cur).filter(([k]) => k !== key)))
    setStackBytes((cur) => Object.fromEntries(Object.entries(cur).filter(([k]) => k !== key)))
    setSavedPages((cur) => Object.fromEntries(Object.entries(cur).filter(([k]) => k !== key)))
  }

  const open = (file: File, page?: number) => {
    const url = URL.createObjectURL(file)
    // A browser's own PDF reader opens on the page named after the #.
    window.open(page ? `${url}#page=${page}` : url, '_blank', 'noopener')
    // The tab has the bytes once it opens; the address is let go a minute later.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const saveNow = async () => {
    if (words.dead || busy) return
    setBusy(true)
    try {
      const fileOf = (key: string) => pieces.find((p) => p.key === key)?.file
      const result = await save(
        plan.ready.flatMap((r): LienScanSave[] => {
          const piece = r.piece as LienScanPiece & Partial<LienScanStackPiece>
          if (piece.stackKey && piece.pages) {
            const stack = fileOf(piece.stackKey)
            const pages = piece.pages
            // A lien's pages are cut when its turn comes, so a cut that fails is that lien's own failure.
            return stack ? [{ key: piece.key, target: r.target, file: () => cut(stack, pages, piece.name) }] : []
          }
          const file = fileOf(piece.key)
          return file ? [{ key: piece.key, target: r.target, file }] : []
        }),
      )
      const outcome = lienScanOutcome(result.done.length, result.failed.length)
      showToast(outcome.line, outcome.tone)
      setFailed(result.failed)
      const took = new Set(result.done.map((d) => d.key))
      // A stack is frozen as it stood for this press: each page keeps the lien it had, and the pages that saved go
      // nowhere again. Without this, the liens that just got their scan would leave the list and the in-order pages
      // behind them would slide onto other liens.
      const frozen: Record<string, LienScanStackPage[]> = {}
      const nowSaved: Record<string, number[]> = { ...savedPages }
      for (const [key, pages] of Object.entries(stacks)) {
        const r = laid.resolved[key]
        if (!r) continue
        const savedHere = new Set(plan.ready.flatMap((x) => ((x.piece as Partial<LienScanStackPiece>).stackKey === key && took.has(x.piece.key) ? ((x.piece as LienScanStackPiece).pages ?? []) : [])))
        frozen[key] = pages.map((pg, i) => {
          const at = r.pages[i]
          if (savedHere.has(i + 1) || pg.kind === 'skip') return { kind: 'skip' }
          return at?.filingId ? { kind: 'hand', filingId: at.filingId } : pg
        })
        if (savedHere.size > 0) nowSaved[key] = [...new Set([...(nowSaved[key] ?? []), ...savedHere])].sort((a, b) => a - b)
      }
      // A stack leaves the window once every page of it is saved or left out; a single file once it is saved.
      const stackDone = (key: string) => (frozen[key] ?? []).every((pg) => pg.kind === 'skip') && (nowSaved[key]?.length ?? 0) > 0
      const left = pieces.filter((p) => (stacks[p.key] ? !stackDone(p.key) : !took.has(p.key)))
      const keep = new Set(left.map((p) => p.key))
      setPieces(left)
      setStacks(Object.fromEntries(Object.entries(frozen).filter(([k]) => keep.has(k))))
      setSavedPages(Object.fromEntries(Object.entries(nowSaved).filter(([k]) => keep.has(k))))
      setMatches((cur) => Object.fromEntries(Object.entries(cur).filter(([k]) => keep.has(k))))
      if (result.done.length > 0) onChanged()
      if (left.length === 0) onClose()
    } finally {
      setBusy(false)
    }
  }

  /** A split stack: every page with its picture, the lien it goes to, and a list to change that. */
  const stackBlock = (p: Held) => {
    const pages = stacks[p.key] ?? []
    const resolved = laid.resolved[p.key]
    const bytes = stackBytes[p.key]
    const saved = new Set(savedPages[p.key] ?? [])
    const byId = new Map(shown.map((t) => [t.filingId, t]))
    const fails = failed.filter((f) => f.save.key.startsWith(`${p.key}:`))
    return (
      <div key={p.key} data-lien-scan-stack={p.name} style={{ border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.55rem 0.7rem', display: 'grid', gap: '0.45rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.7rem', alignItems: 'baseline' }}>
          <span data-lien-scan-stack-head style={{ fontWeight: 700, fontSize: '0.8125rem', minWidth: 0, overflowWrap: 'anywhere' }}>{resolved ? lienScanStackHeadWords({ name: p.name, pages }, resolved) : p.name}</span>
          <button type="button" onClick={() => open(p.file)} style={quiet}>
            {LIEN_SCAN_BATCH_WORDS.open} ›
          </button>
          {saved.size === 0 ? (
            <button type="button" onClick={() => keepWhole(p)} disabled={busy} style={quiet}>
              {LIEN_SCAN_STACK_WORDS.keep}
            </button>
          ) : null}
          <button type="button" onClick={() => remove(p.key)} disabled={busy} aria-label={`Remove ${p.name}`} style={{ ...quiet, marginLeft: 'auto', color: 'var(--text-muted)' }}>
            {LIEN_SCAN_BATCH_WORDS.remove}
          </button>
        </div>
        <div style={small}>{LIEN_SCAN_STACK_WORDS.how}</div>
        {fails.map((f) => (
          <div key={f.save.key} data-lien-scan-failed style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-red-700)' }}>
            {f.save.target.jobLabel} was not saved: {f.reason}
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(11.5rem, 1fr))', gap: '0.6rem' }}>
          {pages.map((pg, i) => {
            const at = resolved?.pages[i]
            const target = at?.filingId ? byId.get(at.filingId) : undefined
            const done = saved.has(i + 1)
            const hold = target ? heldByKey.get(`${p.key}:lien:${target.filingId}`) : undefined
            return (
              <div key={i} data-lien-scan-page={i + 1} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.4rem', display: 'grid', gap: '0.3rem', alignContent: 'start', minWidth: 0 }}>
                <button type="button" onClick={() => open(p.file, i + 1)} title={LIEN_SCAN_STACK_WORDS.openPage} aria-label={`${LIEN_SCAN_STACK_WORDS.openPage}, page ${i + 1}`} style={{ border: '1px solid var(--border)', borderRadius: 4, padding: 0, background: 'var(--bg-subtle)', cursor: 'pointer', overflow: 'hidden', display: 'grid', placeItems: 'center', minHeight: '6rem' }}>
                  {bytes ? <PdfPageCanvas bytes={bytes} page={i + 1} scale={isMobile ? PAGE_SCALE_PHONE : PAGE_SCALE} /> : <span style={small}>Page {i + 1}</span>}
                </button>
                <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>Page {i + 1}</div>
                {done ? (
                  <div data-lien-scan-page-saved style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-green-700)' }}>
                    Saved
                  </div>
                ) : (
                  <>
                    <select value={lienScanStackChoiceOf(pg)} onChange={(e) => setPage(p.key, i, lienScanStackPageOf(e.target.value))} aria-label={`${p.name}, page ${i + 1}, the lien it is for`} disabled={busy} style={{ ...field, fontSize: '0.75rem', ...(isMobile ? { minHeight: 44 } : {}) }}>
                      <option value={LIEN_SCAN_STACK_CHOICE.auto}>{LIEN_SCAN_STACK_WORDS.auto}</option>
                      {i > 0 ? <option value={LIEN_SCAN_STACK_CHOICE.join}>{LIEN_SCAN_STACK_WORDS.join}</option> : null}
                      <option value={LIEN_SCAN_STACK_CHOICE.skip}>{LIEN_SCAN_STACK_WORDS.skip}</option>
                      {shown.map((t) => (
                        <option key={t.filingId} value={t.filingId}>
                          {lienScanTargetWords(t)}
                        </option>
                      ))}
                    </select>
                    {pg.kind === 'skip' ? (
                      <div style={small}>{LIEN_SCAN_STACK_WORDS.skipped}</div>
                    ) : target ? (
                      <div data-lien-scan-page-lien style={{ fontSize: '0.75rem', lineHeight: 1.3, overflowWrap: 'anywhere' }}>
                        {target.jobLabel}
                        <div style={{ fontWeight: 700 }}>{target.recordingNumber ? `no. ${target.recordingNumber}` : 'no recording number yet'}</div>
                      </div>
                    ) : (
                      <div data-lien-scan-held="no_lien" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-red-700)' }}>
                        {LIEN_SCAN_STACK_WORDS.left}
                      </div>
                    )}
                    {hold ? (
                      <div data-lien-scan-held={hold.key} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-red-700)' }}>
                        {hold.reason}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            )
          })}
        </div>
        {resolved && resolved.groups.length > 0 ? (
          <div data-lien-scan-stack-pieces style={small}>
            {resolved.groups.map((g) => `${byId.get(g.filingId)?.jobNumber ?? 'A lien'}: ${lienScanPagesWords(g.pages)}`).join(' · ')}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={LIEN_SCAN_BATCH_WORDS.title}
      data-testid="lien-scan-batch-window"
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget && !busy) onClose()
      }}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--app-bottom-chrome, 0px)', paddingTop: 'var(--app-top-chrome, 0px)', background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex }}
    >
      <div style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: isMobile ? 0 : 10, width: isMobile ? '100%' : 'min(50rem, calc(100vw - 2rem))', maxHeight: isMobile ? '100%' : 'calc(100% - 2rem)', height: isMobile ? '100%' : undefined, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '1rem', fontWeight: 700 }}>{LIEN_SCAN_BATCH_WORDS.title}</div>
            <div data-lien-scan-lead style={{ ...small, marginTop: '0.15rem' }}>
              {lienScanLeadWords(targets)}
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" style={{ ...btn, padding: '0.25rem 0.6rem' }}>
            ×
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '0.9rem 1.1rem', display: 'grid', gap: '0.8rem' }}>
          <div style={{ display: 'grid', gap: '0.35rem', justifyItems: 'start' }}>
            <input ref={input} type="file" multiple accept={LIEN_SCAN_ACCEPT} aria-label={LIEN_SCAN_BATCH_WORDS.pick} onChange={(e) => add(e.target.files)} style={{ display: 'none' }} />
            <button type="button" onClick={() => input.current?.click()} disabled={busy || shown.length === 0} data-lien-scan-pick style={{ ...(shown.length === 0 ? dead : btn), ...(isMobile ? { minHeight: 44 } : {}) }}>
              {pieces.length > 0 ? LIEN_SCAN_BATCH_WORDS.more : LIEN_SCAN_BATCH_WORDS.pick}
            </button>
            <div style={small}>{LIEN_SCAN_BATCH_WORDS.how}</div>
            {anyWithScan ? (
              <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input type="checkbox" checked={withScans} onChange={(e) => setWithScans(e.target.checked)} />
                {LIEN_SCAN_BATCH_WORDS.withScans}
              </label>
            ) : null}
          </div>

          {pieces.length > 0 ? (
            <section style={{ display: 'grid', gap: '0.45rem' }}>
              <h3 style={head}>The scans</h3>
              <div style={{ ...small, color: 'var(--text-amber-700)', fontWeight: 600 }}>{LIEN_SCAN_BATCH_WORDS.check}</div>
              {pieces.map((p) => {
                if (stacks[p.key]) return stackBlock(p)
                const m = matches[p.key] ?? null
                const hold = heldByKey.get(p.key)
                const why = failed.find((f) => f.save.key === p.key)?.reason
                const pageCount = pageCounts[p.key] ?? 0
                return (
                  <div key={p.key} data-lien-scan-piece={p.name} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.7rem', display: 'grid', gap: '0.3rem' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.7rem', alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.8125rem', minWidth: 0, overflowWrap: 'anywhere' }}>{p.name}</span>
                      <span style={small}>{addFileSizeWords(p.size)}</span>
                      <button type="button" onClick={() => open(p.file)} style={quiet}>
                        {LIEN_SCAN_BATCH_WORDS.open} ›
                      </button>
                      <button type="button" onClick={() => remove(p.key)} disabled={busy} aria-label={`Remove ${p.name}`} style={{ ...quiet, marginLeft: 'auto', color: 'var(--text-muted)' }}>
                        {LIEN_SCAN_BATCH_WORDS.remove}
                      </button>
                    </div>
                    <select
                      value={m?.filingId ?? ''}
                      onChange={(e) => setMatches((cur) => ({ ...cur, [p.key]: e.target.value ? { filingId: e.target.value, by: 'hand' } : null }))}
                      aria-label={`${p.name}, the lien it is for`}
                      disabled={busy}
                      style={{ ...field, ...(isMobile ? { minHeight: 44 } : {}) }}
                    >
                      <option value="">{LIEN_SCAN_BATCH_WORDS.none}</option>
                      {shown.map((t) => (
                        <option key={t.filingId} value={t.filingId}>
                          {lienScanTargetWords(t)}
                        </option>
                      ))}
                    </select>
                    {hold ? (
                      <div data-lien-scan-held={hold.key} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-red-700)' }}>
                        {hold.reason}
                      </div>
                    ) : m && LIEN_SCAN_MATCH_WORDS[m.by] ? (
                      <div data-lien-scan-match={m.by} style={{ ...small, ...(m.by === 'order' ? { color: 'var(--text-amber-700)' } : {}) }}>
                        {LIEN_SCAN_MATCH_WORDS[m.by]}
                      </div>
                    ) : null}
                    {why ? (
                      <div data-lien-scan-failed style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-red-700)' }}>
                        Not saved: {why}
                      </div>
                    ) : null}
                    {/* A PDF of several pages may be a whole stack (punch list #366): the office says so, never the app. */}
                    {pageCount > 1 ? (
                      <div data-lien-scan-split-offer style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.6rem', alignItems: 'baseline', ...small }}>
                        {LIEN_SCAN_STACK_WORDS.offer(pageCount)}
                        <button type="button" onClick={() => void split(p)} disabled={busy} style={quiet}>
                          {LIEN_SCAN_STACK_WORDS.split}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </section>
          ) : null}

          {plan.without.length > 0 ? (
            <section data-lien-scan-without style={{ display: 'grid', gap: '0.25rem' }}>
              <h3 style={head}>{pieces.length > 0 ? 'Still without a scan' : 'Filed liens with no scan'}</h3>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.78rem', display: 'grid', gap: '0.1rem' }}>
                {plan.without.map((t) => (
                  <li key={t.filingId}>{lienScanTargetWords(t)}</li>
                ))}
              </ul>
            </section>
          ) : null}
          <div style={small}>{LIEN_SCAN_BATCH_WORDS.where}</div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center', justifyContent: 'flex-end', padding: '0.7rem 1.1rem', borderTop: '1px solid var(--border)' }}>
          {words.foot ? <span style={{ ...small, marginRight: 'auto', color: 'var(--text-amber-700)', fontWeight: 600 }}>{words.foot}</span> : null}
          <button type="button" onClick={onClose} disabled={busy} style={btn}>
            Close
          </button>
          <button type="button" onClick={() => void saveNow()} disabled={words.dead || busy} data-lien-scan-save style={{ ...(words.dead ? dead : press), ...(busy ? { cursor: 'wait' } : {}), ...(isMobile ? { minHeight: 44 } : {}) }}>
            {busy ? 'Saving…' : words.button}
          </button>
        </div>
      </div>
    </div>
  )
}
