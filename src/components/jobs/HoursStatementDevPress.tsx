/**
 * The dev-only press for a signed hours statement (punch list #212 PR 1, v2.6069): on the job window's Documents tab,
 * pick one of the people who clocked on the job, a span, and whether the pay shows, and print the paper
 * (`buildHoursStatement` → `buildHoursStatementHtml` → the print window). The window with its switches, the signing and
 * the filing are the later PRs; this press proves the kernel and the print on live rows. Devs only.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { formatDenverDateTimeShort, todayYmdInAppTz } from '../../utils/dateUtils'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import { buildHoursStatement, hoursStatementLongDate } from '../../lib/people/hoursStatement'
import { hoursStatementJobNumber, listHoursStatementPeople, loadHoursStatementInputs, type HoursStatementPerson } from '../../lib/people/hoursStatementRead'
import { buildHoursStatementHtml } from '../../lib/peopleDocuments/buildHoursStatementHtml'

const heading: CSSProperties = { margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-strong)' }
const quiet: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }
const field: CSSProperties = { padding: '0.3rem 0.5rem', fontSize: '0.8125rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)' }
const button: CSSProperties = { padding: '0.3rem 0.7rem', fontSize: '0.8125rem', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 600 }

export function HoursStatementDevPress({ job }: { job: JobWithDetails }) {
  const { role, profileName } = useAuth()
  const { showToast } = useToastContext()
  const [people, setPeople] = useState<HoursStatementPerson[] | null>(null)
  const [userId, setUserId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [withPay, setWithPay] = useState(true)
  const [stated, setStated] = useState(false)
  const [busy, setBusy] = useState(false)
  const isDev = role === 'dev'

  useEffect(() => {
    if (!isDev) return
    let cancelled = false
    listHoursStatementPeople(job.id)
      .then((list) => {
        if (cancelled) return
        setPeople(list)
        const first = list[0]
        if (first) {
          setUserId(first.userId)
          setFrom(first.firstDay)
          setTo(first.lastDay)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) showToast(formatErrorMessage(e), 'error')
      })
    return () => {
      cancelled = true
    }
  }, [isDev, job.id, showToast])

  const person = useMemo(() => people?.find((p) => p.userId === userId) ?? null, [people, userId])

  const pickPerson = useCallback(
    (id: string) => {
      setUserId(id)
      const p = people?.find((x) => x.userId === id)
      if (p) {
        setFrom(p.firstDay)
        setTo(p.lastDay)
      }
    },
    [people],
  )

  const print = useCallback(async () => {
    if (!person || !from || !to || from > to) return
    setBusy(true)
    try {
      const read = await loadHoursStatementInputs({ jobId: job.id, userId: person.userId, periodStart: from, periodEnd: to, withPay, addStatedBlock: stated })
      const statement = buildHoursStatement(read.input)
      const html = buildHoursStatementHtml({
        statement,
        recordId: null,
        worker: read.worker,
        job: { number: hoursStatementJobNumber(job), name: job.job_name, customer: job.customer_name ?? null, site: job.job_address, isOfficeJob: read.isOfficeJob },
        approvedBy: read.approvedBy,
        preparedBy: profileName ?? 'the office',
        preparedOn: hoursStatementLongDate(todayYmdInAppTz()),
        asOf: formatDenverDateTimeShort(Date.now()),
      })
      if (!openHtmlPrintWindow(html)) showToast('The print window was blocked. Allow pop-ups for this site and press Print again.', 'error')
    } catch (e: unknown) {
      showToast(formatErrorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }, [person, from, to, withPay, stated, job, profileName, showToast])

  if (!isDev) return null
  return (
    <section aria-label="Hours statement" style={{ display: 'grid', gap: '0.5rem' }}>
      <h4 style={heading}>Hours statement <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>dev only, PR 1 of #212</span></h4>
      <p style={quiet}>One person’s recorded hours on this job for a span, as the paper they would sign, printed from the clock and the pay reports as they stand.</p>
      {people == null ? (
        <p style={quiet}>Reading who clocked on this job…</p>
      ) : people.length === 0 ? (
        <p style={quiet}>Nothing clocked on this job yet. A statement needs at least one counted session here.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <label style={quiet}>
            Who{' '}
            <select style={field} value={userId} onChange={(e) => pickPerson(e.target.value)} aria-label="Who">
              {people.map((p) => (
                <option key={p.userId} value={p.userId}>
                  {p.name} · {p.sessions} {p.sessions === 1 ? 'session' : 'sessions'}
                </option>
              ))}
            </select>
          </label>
          <label style={quiet}>
            From <input type="date" style={field} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
          </label>
          <label style={quiet}>
            To <input type="date" style={field} value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
          </label>
          <label style={quiet}>
            <input type="checkbox" checked={withPay} onChange={(e) => setWithPay(e.target.checked)} /> Show the rate, the amount and what was paid
          </label>
          <label style={quiet}>
            <input type="checkbox" checked={stated} onChange={(e) => setStated(e.target.checked)} /> Add days the app did not record
          </label>
          <button type="button" style={button} disabled={busy || !person || !from || !to || from > to} onClick={() => void print()}>
            {busy ? 'Reading…' : 'Print the statement'}
          </button>
        </div>
      )}
    </section>
  )
}
