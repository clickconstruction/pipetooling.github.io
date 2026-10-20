import { useMemo, useState } from 'react'
import { LIEN_PEN_WITNESS_HOWS, lienSignedRecordId, lienSignatureWhen, type LienPenWitnessHow } from '../../lib/jobs/lienNoticeSignature'
import { penRecordProblems, penRecordedWords, penSignedAtIso } from '../../lib/jobs/lienPenRecord'
import { recordLienPenSignature } from '../../lib/jobs/lienDeskSignIo'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'

/**
 * He signed the paper with a pen (the pen train, PR 2): the pane the office opens from a held
 * envelope on the run or from a ready notice's footer. It writes down the leader's act on the
 * paper as printed: who (the job's leader, from People), when (the print day is filled in), how
 * the office knows, the signed page when they have it, and which notices. One record per ticked
 * notice, through `recordLienPenSignature`; the caller dresses its rows from what came back.
 * The leader sees the record on his phone and may confirm it later; nothing waits on that.
 */
export type PenPaneNotice = {
  itemId: string
  jobNumber: string
  /** "650 · ATI Schertz" */
  label: string
  amount: number
  /** The row's `fields` as saved: the hash binds the record to the paper as printed. */
  fields: unknown
}

export type PenPaneRecorded = { itemId: string; signedAtIso: string; how: LienPenWitnessHow; pagePath: string | null }

export default function LienPenSignaturePane({
  leader,
  recorder,
  notices,
  printedYmd,
  todayYmd,
  onRecorded,
  onClose,
  compact = false,
}: {
  /** The job's leader: whose signature is on the paper. */
  leader: { userId: string | null; name: string }
  /** The signed-in office user writing it down. */
  recorder: { userId: string | null; name: string }
  /** The unsigned notices the office may tick; all ticked to start. */
  notices: PenPaneNotice[]
  /** When the packet printed (the day filled in), or null. */
  printedYmd: string | null
  todayYmd: string
  /** Every record that was written, in order; the caller re-dresses its rows. */
  onRecorded: (recorded: PenPaneRecorded[], words: string) => void
  onClose: () => void
  /** Tighter spacing inside a run's envelope row. */
  compact?: boolean
}) {
  const [ymd, setYmd] = useState(printedYmd ?? todayYmd)
  const [how, setHow] = useState<LienPenWitnessHow>('watched')
  const [page, setPage] = useState<File | null>(null)
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(notices.map((n) => n.itemId)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const problems = useMemo(() => penRecordProblems({ ymd, todayYmd, printedYmd, ticked: ticked.size, leaderName: leader.name }), [ymd, todayYmd, printedYmd, ticked, leader.name])
  const count = ticked.size

  const record = async () => {
    if (busy || problems.length) return
    const signedAtIso = penSignedAtIso(ymd)
    if (!signedAtIso) {
      setError('Type the day he signed.')
      return
    }
    setBusy(true)
    setError(null)
    const done: PenPaneRecorded[] = []
    let failed: string | null = null
    try {
      for (const n of notices) {
        if (!ticked.has(n.itemId)) continue
        const r = await recordLienPenSignature({
          itemId: n.itemId,
          fields: n.fields,
          signer: { userId: leader.userId, printedName: leader.name },
          recordedBy: { userId: recorder.userId, name: recorder.name },
          how,
          signedAtIso,
          page: page ? { blob: page, type: page.type } : null,
        })
        if (!r.ok) {
          failed = r.message
          break
        }
        done.push({ itemId: n.itemId, signedAtIso: r.signedAtIso, how: r.how, pagePath: r.pagePath })
      }
    } finally {
      setBusy(false)
    }
    if (done.length) {
      const { day } = lienSignatureWhen(signedAtIso)
      onRecorded(done, penRecordedWords({ count: done.length, leaderName: leader.name, dayWords: day, how: page ? 'page' : how, recorderName: recorder.name }))
    }
    if (failed) setError(done.length ? `${done.length} recorded, then: ${failed}` : failed)
  }

  const pad = compact ? '0.6rem 0.75rem' : '0.8rem 1rem'
  const field = { font: 'inherit', fontSize: '0.8125rem', padding: '4px 7px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' } as const
  return (
    <div data-testid="lien-pen-pane" role="group" aria-label="He signed the paper with a pen" style={{ marginTop: '0.45rem', border: '1px solid var(--border-strong)', borderRadius: 10, background: 'var(--bg-subtle)', padding: pad, display: 'grid', gap: '0.55rem', fontSize: '0.8125rem', maxWidth: 640 }}>
      <div>
        <strong>He signed the paper with a pen.</strong>{' '}
        <span style={{ color: 'var(--text-muted)' }}>You are writing down his act. The record names you as the one who wrote it, and him as the one who signed. He sees it on his phone.</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.4rem 0.75rem', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-muted)' }}>Who signed</span>
        <span>
          <strong>{leader.name || '—'}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>the job’s leader</span>
        </span>
        <label htmlFor="lien-pen-day" style={{ color: 'var(--text-muted)' }}>When he signed</label>
        <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input id="lien-pen-day" type="date" value={ymd} max={todayYmd} onChange={(ev) => setYmd(ev.target.value)} disabled={busy} style={field} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{printedYmd ? 'The print day is filled in. Change it if he signed later.' : 'The day he put pen to paper.'}</span>
        </span>
        <span style={{ color: 'var(--text-muted)', alignSelf: 'start' }}>How you know</span>
        <span style={{ display: 'grid', gap: '0.2rem' }}>
          {LIEN_PEN_WITNESS_HOWS.map((h) => (
            <label key={h.key} style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', cursor: 'pointer' }}>
              <input type="radio" name="lien-pen-how" value={h.key} checked={how === h.key} onChange={() => setHow(h.key)} disabled={busy} />
              {h.label}
            </label>
          ))}
        </span>
        <label htmlFor="lien-pen-page" style={{ color: 'var(--text-muted)', alignSelf: 'start' }}>The signed page</label>
        <span style={{ display: 'grid', gap: '0.2rem' }}>
          <input id="lien-pen-page" type="file" accept="image/*,application/pdf" onChange={(ev) => setPage(ev.target.files?.[0] ?? null)} disabled={busy} style={{ fontSize: '0.78rem' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{page ? `${page.name} · it is the proof: the record ID in the frame’s corner ties the page to the row.` : 'Optional, and asked for. A photo from your phone is enough. The record ID in the frame’s corner ties it to the row.'}</span>
        </span>
        <span style={{ color: 'var(--text-muted)', alignSelf: 'start' }}>Which notices</span>
        <span style={{ display: 'grid', gap: '0.2rem' }}>
          {notices.map((n) => (
            <label key={n.itemId} style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'baseline', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={ticked.has(n.itemId)}
                onChange={(ev) => setTicked((prev) => { const next = new Set(prev); if (ev.target.checked) next.add(n.itemId); else next.delete(n.itemId); return next })}
                disabled={busy}
                aria-label={`${n.label} signed with a pen`}
              />
              <span>
                {n.label} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{formatUsdNoCents(n.amount)} · <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{lienSignedRecordId(n.jobNumber, n.itemId)}</span></span>
              </span>
            </label>
          ))}
        </span>
      </div>
      {problems.length ? <div style={{ color: 'var(--text-red-600)', fontSize: '0.75rem' }} data-testid="lien-pen-problems">{problems[0]}</div> : null}
      {error ? <div role="alert" style={{ color: 'var(--text-red-600)', fontSize: '0.78rem' }}>{error}</div> : null}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={() => void record()} disabled={busy || problems.length > 0} data-testid="lien-pen-record" style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--text-link)', background: 'var(--text-link)', color: '#fff', font: 'inherit', fontSize: '0.8125rem', fontWeight: 700, cursor: busy || problems.length ? 'not-allowed' : 'pointer' }}>
          {busy ? 'Recording…' : `Record ${count} pen signature${count === 1 ? '' : 's'} ▸`}
        </button>
        <button type="button" onClick={onClose} disabled={busy} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
          Not now
        </button>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>A notice whose draft changed after it printed stays unsigned: the paper he signed is not the paper on the desk.</span>
      </div>
    </div>
  )
}
