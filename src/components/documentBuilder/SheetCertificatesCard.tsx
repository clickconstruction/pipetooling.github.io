/**
 * A trade's certificate, held against this job's insurance sheet (punch list #404, step 6). One row a trade on the
 * job, saying where its certificate stands for this job, with the check list for one that waits for a look: one line
 * to tick for each thing the published sheet asks, **Mark it good** and **Send it back**. One certificate for each
 * job (Taunya, 2026-11-21). The rules are `certificates.ts`. A dev alone presses either: the database says so.
 *
 * The drawing put the standing on the send's own row. It sits in a card of its own under the send, so the send list
 * stays as it is.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { certificateCheck, certificateChip, certificateCounts, certificatePress, certificateStanding, type CertRow } from '../../lib/documentBuilder/certificates'
import { markCertificateGood, readCertificates, sendCertificateBack } from '../../lib/documentBuilder/certificatesIo'
import type { BuilderChipTone } from '../../lib/documentBuilder/builders'
import type { SendParty } from '../../lib/documentBuilder/send'
import { readSheetParties } from '../../lib/documentBuilder/sendIo'
import { sheetAsks, type ResolvedSheet } from '../../lib/documentBuilder/sheet'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { formatWorkDateYmdMonthDayShort, todayYmdInAppTz } from '../../utils/dateUtils'

export type SheetCertificatesIo = {
  readParties: typeof readSheetParties
  readCertificates: typeof readCertificates
  markGood: typeof markCertificateGood
  sendBack: typeof sendCertificateBack
}

export const SHEET_CERTIFICATES_IO: SheetCertificatesIo = { readParties: readSheetParties, readCertificates, markGood: markCertificateGood, sendBack: sendCertificateBack }

type Props = {
  projectId: string
  /** The job's name, as the email to a trade says it. */
  job: string
  /** The job's sheet. Null before its row is made. */
  sheetId: string | null
  /** The sheet's published revision. 0 before the first publish. */
  revision: number
  /** The sheet as published: what a certificate is checked against. Null before the first publish. */
  page: ResolvedSheet | null
  /** Today, for a test. */
  today?: string
  io?: SheetCertificatesIo
}

const CARD: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'grid', gap: 10, minWidth: 0 }
const CARD_TITLE: CSSProperties = { margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-strong)' }
const MUTED: CSSProperties = { margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }
const FINE: CSSProperties = { margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }
const REFUSAL: CSSProperties = { margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-red-700)' }
const CHIP: CSSProperties = { display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'normal' }
const CHIP_TONES: Record<BuilderChipTone, CSSProperties> = {
  ok: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' },
  wait: { background: 'var(--bg-muted)', color: 'var(--text-700)' },
  warn: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
}
const ROW: CSSProperties = { display: 'grid', gap: 6, padding: '8px 0', borderTop: '1px solid var(--border)', minWidth: 0 }
const BTNS: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }
const SMALL_PRESS: CSSProperties = { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', borderRadius: 8, padding: '3px 10px', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600, minHeight: 32, cursor: 'pointer' }
const INPUT: CSSProperties = { color: 'var(--text-base)', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '7px 9px', fontFamily: 'inherit', fontSize: '1rem', minWidth: 0, boxSizing: 'border-box' }
const LABEL: CSSProperties = { display: 'grid', gap: 4, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-700)', justifyItems: 'start' }
const CHECK_BOX: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', display: 'grid', gap: 8, minWidth: 0, background: 'var(--bg-subtle)' }
const TICK: CSSProperties = { display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.85rem', color: 'var(--text-base)', cursor: 'pointer' }

function mainPress(dead: boolean): CSSProperties {
  return { border: 0, background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : 'white', borderRadius: 9, padding: '9px 14px', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 700, minHeight: 40, cursor: dead ? 'not-allowed' : 'pointer' }
}
function secondPress(dead: boolean): CSSProperties {
  return { border: '1px solid var(--border-strong)', background: dead ? DEAD_PRESS_FILL : 'var(--surface)', color: dead ? DEAD_PRESS_TEXT : 'var(--text-strong)', borderRadius: 9, padding: '7px 12px', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 600, minHeight: 38, cursor: dead ? 'not-allowed' : 'pointer' }
}

export function SheetCertificatesCard({ projectId, job, sheetId, revision, page, today = todayYmdInAppTz(), io = SHEET_CERTIFICATES_IO }: Props) {
  const [parties, setParties] = useState<SendParty[] | null>(null)
  const [certs, setCerts] = useState<CertRow[]>([])
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [reading, setReading] = useState(true)
  const [tries, setTries] = useState(0)
  /** The certificate open in the check list, by the company and the paper. */
  const [open, setOpen] = useState<{ companyId: string; paperId: string } | null>(null)
  const [ticked, setTicked] = useState<boolean[]>([])
  const [goodUntil, setGoodUntil] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  /** What the last press did, when it needs saying: a send-back whose email did not go. */
  const [said, setSaid] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setReading(true)
    void (async () => {
      try {
        const got = await io.readParties(projectId, sheetId)
        const rows = await io.readCertificates(got.map((p) => p.id))
        if (cancelled) return
        setParties(got)
        setCerts(rows)
        setFailure(null)
      } catch (e) {
        if (!cancelled) setFailure(recoveryFailureFromError(e, "This job's certificates did not read."))
      } finally {
        if (!cancelled) setReading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [io, projectId, sheetId, revision, tries])

  const asks = useMemo(() => (page ? sheetAsks(page) : []), [page])
  const published = revision > 0 && sheetId != null && page != null

  const openCheck = useCallback(
    (companyId: string, row: CertRow) => {
      setOpen({ companyId, paperId: row.id })
      setTicked(asks.map(() => false))
      setGoodUntil(row.expiresOn ?? '')
      setProblem(null)
      setSaid(null)
    },
    [asks],
  )
  const close = useCallback(() => {
    setOpen(null)
    setProblem(null)
  }, [])

  if (failure) return <OfflineRetryPanel failure={failure} onRetry={() => setTries((n) => n + 1)} surface="documents-builder-certificates" idempotent busy={reading} />
  if (!parties) return <p style={MUTED}>Reading this job's certificates…</p>
  // The send card above already says a job with no trade has none.
  if (parties.length === 0) return null

  const standings = parties.map((p) => ({ party: p, standing: certificateStanding(certs, p.id, projectId, asks, today) }))
  const counts = certificateCounts(standings.map((s) => s.standing))
  const check = certificateCheck(asks, ticked, goodUntil, today)

  const markGood = async (paperId: string) => {
    if (!sheetId || !check.canMarkGood || busy) return
    setBusy(true)
    setProblem(null)
    const res = await io.markGood({ paperId, sheetId, asks: [...asks], goodUntil })
    setBusy(false)
    if (!res.ok) return setProblem(res.error)
    setOpen(null)
    setTries((n) => n + 1)
  }
  const sendBack = async (companyId: string, paperId: string) => {
    if (!sheetId || !check.canSendBack || busy) return
    setBusy(true)
    setProblem(null)
    const res = await io.sendBack({ paperId, sheetId, projectId, companyId, job, missing: check.missing })
    setBusy(false)
    if (!res.ok) return setProblem(res.error)
    setSaid(res.value.emailed ? null : res.value.emailWords)
    setOpen(null)
    setTries((n) => n + 1)
  }

  return (
    <div style={CARD} data-testid="sheet-certificates">
      <h3 style={CARD_TITLE}>Certificates for this job</h3>
      <p style={MUTED}>Each trade sends its certificate of insurance from its own page. Check it here against what this job's sheet asks.</p>
      {!published ? <p style={MUTED}>Publish this job's sheet first. A certificate is checked against the published sheet.</p> : counts ? <p style={MUTED} data-testid="certificate-counts">{counts}</p> : null}
      {said ? <p style={REFUSAL} role="status">{said}</p> : null}
      <div>
        {standings.map(({ party, standing }) => {
          const chip = certificateChip(standing)
          const press = published ? certificatePress(standing) : null
          const isOpen = open?.companyId === party.id && press != null && open.paperId === press.row.id
          return (
            <div key={party.id} style={ROW} data-certificate-row={party.id}>
              <div style={{ ...BTNS, justifyContent: 'space-between' }}>
                <div style={{ display: 'grid', gap: 3, minWidth: 0 }}>
                  <strong style={{ fontSize: '0.875rem', color: 'var(--text-strong)' }}>{party.name}</strong>
                  <span style={{ ...CHIP, ...CHIP_TONES[chip.tone], justifySelf: 'start' }}>{chip.words}</span>
                </div>
                {press && !isOpen ? (
                  <button type="button" style={SMALL_PRESS} onClick={() => openCheck(party.id, press.row)} aria-label={`${press.label}, ${party.name}`}>
                    {press.label}
                  </button>
                ) : null}
              </div>
              {standing.kind === 'sentBack' && standing.row.missing?.length ? (
                <ul style={{ ...FINE, paddingLeft: 18 }}>
                  {standing.row.missing.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
              {isOpen && press ? (
                <div style={CHECK_BOX} data-testid="certificate-check">
                  <div style={{ display: 'grid', gap: 4 }}>
                    <strong style={{ fontSize: '0.8rem', color: 'var(--text-700)' }}>{party.name}'s certificate</strong>
                    {press.row.url ? (
                      <a href={press.row.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', color: 'var(--text-link)', fontWeight: 600 }}>
                        Open their file
                      </a>
                    ) : (
                      <span style={MUTED}>This certificate has no file to open.</span>
                    )}
                    {press.row.sentOn ? <span style={FINE}>They sent it {formatWorkDateYmdMonthDayShort(press.row.sentOn)}.</span> : null}
                  </div>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--text-700)' }}>What this job's sheet asks, revision {revision}</strong>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {asks.map((line, i) => (
                      <label key={line} style={TICK}>
                        <input type="checkbox" checked={ticked[i] === true} onChange={(e) => setTicked((was) => asks.map((_, k) => (k === i ? e.target.checked : was[k] === true)))} style={{ marginTop: 3 }} />
                        <span>{line}</span>
                      </label>
                    ))}
                  </div>
                  <label style={LABEL}>
                    Good until
                    <input type="date" value={goodUntil} onChange={(e) => setGoodUntil(e.target.value)} style={INPUT} />
                  </label>
                  {check.goodWhy ? <p style={REFUSAL}>{check.goodWhy}</p> : null}
                  {problem ? <p style={REFUSAL} role="alert">{problem}</p> : null}
                  <div style={BTNS}>
                    <button type="button" style={mainPress(!check.canMarkGood || busy)} disabled={!check.canMarkGood || busy} onClick={() => void markGood(press.row.id)}>
                      {check.goodLabel}
                    </button>
                    <button type="button" style={secondPress(!check.canSendBack || busy)} disabled={!check.canSendBack || busy} onClick={() => void sendBack(party.id, press.row.id)}>
                      {check.backLabel}
                    </button>
                    <button type="button" style={secondPress(busy)} disabled={busy} onClick={close}>
                      Close
                    </button>
                  </div>
                  <p style={FINE}>Tick what the certificate shows. What is left unticked is what goes back to them, in words.</p>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
