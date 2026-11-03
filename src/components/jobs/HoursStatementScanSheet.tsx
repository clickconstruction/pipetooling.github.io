/**
 * File a signed scan (punch list #212, PR 3): the paper path inside the Hours statement window. The worker signed the
 * printed paper with a pen; the office attaches the photo or PDF, says who signed and on what day, types the days the
 * worker wrote into the stated block exactly as written, confirms it, and files it. The function fills those days into
 * the statement's form with no signature drawn (the ink stays on the scan), files both in the private bucket, and the
 * statement reads signed. Rules in `lib/people/hoursStatementSigning.ts` (`hoursStatementScanProblem`).
 */
import { useState, type CSSProperties } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { hoursStatementScanProblem, type ScanStatedRow } from '../../lib/people/hoursStatementSigning'

const field: CSSProperties = { padding: '0.35rem 0.5rem', fontSize: '0.875rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit', width: '100%', boxSizing: 'border-box' }
const label: CSSProperties = { display: 'grid', gap: '0.2rem', fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }
const quiet: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }
const btn: CSSProperties = { font: 'inherit', fontSize: '0.875rem', padding: '0.45rem 0.9rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer', fontWeight: 600 }
const btnPrimary: CSSProperties = { ...btn, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }
const btnDead: CSSProperties = { ...btn, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, border: '1px solid transparent', cursor: 'not-allowed' }

export type ScanSheetDraft = { file: File | null; signedOn: string; printedName: string; rows: ScanStatedRow[] }

export function HoursStatementScanSheet({
  workerName,
  todayYmd,
  initialRows,
  showStatedRows,
  busy,
  onFile,
  onCancel,
}: {
  workerName: string
  todayYmd: string
  /** The days the office already stated on the paper, to correct from what the worker wrote. */
  initialRows: ScanStatedRow[]
  /** The paper carried a stated block, so the sheet asks for its rows. */
  showStatedRows: boolean
  busy: boolean
  onFile: (draft: ScanSheetDraft) => void
  onCancel: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [signedOn, setSignedOn] = useState(todayYmd)
  const [printedName, setPrintedName] = useState(workerName)
  const [rows, setRows] = useState<ScanStatedRow[]>(initialRows.length > 0 ? initialRows : showStatedRows ? [{ day: '', hours: '', note: '' }] : [])
  const [attested, setAttested] = useState(false)
  const problem = hoursStatementScanProblem({ file: file ? { type: file.type, size: file.size } : null, signedOn, printedName, attested, rows, todayYmd })
  const dead = problem != null || busy
  const setRow = (i: number, patch: Partial<ScanStatedRow>) => setRows((cur) => cur.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  return (
    <section aria-labelledby="hours-statement-scan-title" data-testid="hours-statement-scan-sheet" style={{ display: 'grid', gap: '0.7rem', padding: '0.8rem 1rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
        <h3 id="hours-statement-scan-title" style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-strong)', flex: 1 }}>
          File a signed scan · {workerName}
        </h3>
        <button type="button" style={{ ...btn, padding: '0.25rem 0.6rem', fontSize: '0.8125rem' }} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
      <p style={quiet}>The worker signed the printed paper with a pen. Attach a photo or a PDF of it. The signature stays on the scan; the statement reads signed with the days below.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
        <label style={label}>
          The signed paper
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" style={field} disabled={busy} aria-label="The signed paper" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <label style={label}>
          Signed by, as written
          <input type="text" style={field} value={printedName} disabled={busy} aria-label="Signed by, as written" onChange={(e) => setPrintedName(e.target.value)} />
        </label>
        <label style={label}>
          Signed on
          <input type="date" style={field} value={signedOn} max={todayYmd} disabled={busy} aria-label="Signed on" onChange={(e) => setSignedOn(e.target.value)} />
        </label>
      </div>
      {showStatedRows ? (
        <div style={{ display: 'grid', gap: '0.4rem' }}>
          <p style={{ ...quiet, fontWeight: 600, color: 'var(--text-strong)' }}>Days the worker wrote in the stated block</p>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 70px minmax(0, 1fr) auto', gap: '0.4rem', alignItems: 'center' }}>
              <input type="date" style={field} value={r.day} disabled={busy} aria-label={`Stated day ${i + 1}`} onChange={(e) => setRow(i, { day: e.target.value })} />
              <input type="text" inputMode="decimal" style={field} value={r.hours} placeholder="Hours" disabled={busy} aria-label={`Stated hours ${i + 1}`} onChange={(e) => setRow(i, { hours: e.target.value })} />
              <input type="text" style={field} value={r.note} placeholder="What they were working on" maxLength={80} disabled={busy} aria-label={`Stated note ${i + 1}`} onChange={(e) => setRow(i, { note: e.target.value })} />
              <button type="button" style={{ ...btn, padding: '0.3rem 0.6rem', fontSize: '0.8125rem' }} disabled={busy} aria-label={`Remove stated row ${i + 1}`} onClick={() => setRows((cur) => cur.filter((_, idx) => idx !== i))}>
                ×
              </button>
            </div>
          ))}
          <div>
            <button type="button" style={{ ...btn, fontSize: '0.8125rem' }} disabled={busy} onClick={() => setRows((cur) => [...cur, { day: '', hours: '', note: '' }])}>
              Add a day
            </button>
          </div>
        </div>
      ) : null}
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', fontSize: '0.875rem', color: 'var(--text-base)', cursor: 'pointer' }}>
        <input type="checkbox" checked={attested} disabled={busy} onChange={(e) => setAttested(e.target.checked)} style={{ marginTop: 3 }} />
        <span>The days above are typed exactly as the worker wrote them, and the paper attached is the one they signed.</span>
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <button type="button" style={dead ? btnDead : btnPrimary} disabled={dead} title={problem ?? undefined} onClick={() => onFile({ file, signedOn, printedName, rows })}>
          {busy ? 'Filing…' : 'File the signed scan'}
        </button>
        {problem ? <span style={{ ...quiet, color: 'var(--text-amber-800)' }}>{problem}</span> : null}
      </div>
    </section>
  )
}

export default HoursStatementScanSheet
