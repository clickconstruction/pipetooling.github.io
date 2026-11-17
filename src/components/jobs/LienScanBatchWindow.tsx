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
import { saveLienScans, type LienScanSaveResult } from '../../lib/jobs/lienScanBatchIo'
import { LIEN_SCAN_ACCEPT } from '../../lib/jobs/lienScanFile'

type Props = {
  /** Every filed affidavit on the desk (`lienScanTargetsFromDesk`). */
  targets: ReadonlyArray<LienScanTarget>
  isMobile?: boolean
  /** The desk reads again after a save. */
  onChanged: () => void
  onClose: () => void
  /** The writes, handed in by a test. */
  save?: typeof saveLienScans
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

/**
 * Add the stamped scans (punch list #366): several filed liens' scans in one sitting, one file a lien, each saved to
 * its own job. The office picks the files; each is matched to a lien by the recording number or the job number in
 * its name, or by its place, and the line under it says which. The office checks each against the clerk's stamp and
 * changes any match before the press.
 *
 * The press saves what is ready and leaves the rest with its reason. Nothing is recorded here but the saved copy:
 * the filing's own facts stay as **Record filing…** wrote them.
 */
export default function LienScanBatchWindow({ targets, isMobile, onChanged, onClose, save = saveLienScans, zIndex = 1200 }: Props) {
  const isTopmost = useModalStackEntry()
  const { showToast } = useToastContext()
  const input = useRef<HTMLInputElement>(null)
  const [pieces, setPieces] = useState<Held[]>([])
  const [matches, setMatches] = useState<Record<string, LienScanMatch>>({})
  const [withScans, setWithScans] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<LienScanSaveResult['failed']>([])

  // The liens a scan can go to: the ones with none, and the rest only when asked, since saving replaces their link.
  const shown = useMemo(() => targets.filter((t) => withScans || !t.hasScan), [targets, withScans])
  const plan = useMemo(() => lienScanPlan(pieces, matches, shown), [pieces, matches, shown])
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
  }

  const remove = (key: string) => {
    setPieces((cur) => cur.filter((p) => p.key !== key))
    setMatches((cur) => Object.fromEntries(Object.entries(cur).filter(([k]) => k !== key)))
    setFailed((cur) => cur.filter((f) => f.save.key !== key))
  }

  const open = (file: File) => {
    const url = URL.createObjectURL(file)
    window.open(url, '_blank', 'noopener')
    // The tab has the bytes once it opens; the address is let go a minute later.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const saveNow = async () => {
    if (words.dead || busy) return
    setBusy(true)
    try {
      const result = await save(plan.ready.map((r) => ({ key: r.piece.key, file: (r.piece as Held).file, target: r.target })))
      const outcome = lienScanOutcome(result.done.length, result.failed.length)
      showToast(outcome.line, outcome.tone)
      setFailed(result.failed)
      const took = new Set(result.done.map((d) => d.key))
      const left = pieces.filter((p) => !took.has(p.key))
      setPieces(left)
      setMatches((cur) => Object.fromEntries(Object.entries(cur).filter(([k]) => !took.has(k))))
      if (result.done.length > 0) onChanged()
      if (left.length === 0) onClose()
    } finally {
      setBusy(false)
    }
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
                const m = matches[p.key] ?? null
                const hold = heldByKey.get(p.key)
                const why = failed.find((f) => f.save.key === p.key)?.reason
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
