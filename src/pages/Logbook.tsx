/**
 * The teammate's logbook (punch list #255): one page a teammate. The licenses they hold, what they
 * are working toward in each trade, and the week-by-week record of approved hours a licensing board
 * asks for, with Print for the summary sheet and the full log.
 *
 * Opens for the people who can see People → Licenses (the RPC enforces the same gate), and, as `own`, at
 * /my-logbook for a teammate the office has shown it to (v2.6483: `logbook_shares`, read through `my_logbook()`,
 * without the office's Edit and Add a license). Licenses are
 * read from the Licenses tab's own words and parsed (`lib/logbook/logbook.ts`); the signer for a trade
 * is a current teammate holding that trade's supervising license, unexpired. Time on the company's
 * office job reads as office time, whatever trade its service type names.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { usePeopleAccess } from '../hooks/usePeopleAccess'
import { formatErrorMessage } from '../utils/errorHandling'
import { todayYmdInAppTz } from '../utils/dateUtils'
import type { LicenseHoursLogRow } from '../lib/licenseHoursLog'
import {
  NOT_COUNTED_LABEL,
  TRADES,
  TRADE_LABEL,
  fmtNum,
  goalsFor,
  logWeeks,
  openingsFrom,
  parseLicenseTargets,
  parseLicenseType,
  progressFor,
  supervisorCandidates,
  totalsOf,
  withOfficeJob,
  type Goal,
  type LicenseTarget,
  type ParsedLicense,
  type Progress,
  type Supervisor,
  type Trade,
} from '../lib/logbook/logbook'
import LogbookPrint, { type PrintFace } from '../components/logbook/LogbookPrint'
import LicenseEditWindow, { type LicenseEditTarget } from '../components/logbook/LicenseEditWindow'
import LicenseTargetWindow from '../components/logbook/LicenseTargetWindow'
import { parseMyLogbook, shareStripWords, type LogbookShare } from '../lib/logbook/logbookShare'
import { PORTAL_COMPANY } from '../../supabase/functions/_shared/portalCompany'

const TRADE_COLOR: Record<Trade, string> = { plumbing: '#2563eb', electrical: '#d97706', hvac: '#0d9488' }

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.9rem 1rem' }
const eyebrow: CSSProperties = { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const btn: CSSProperties = { font: 'inherit', fontSize: '0.875rem', fontWeight: 700, padding: '0.45rem 0.9rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer' }
const btnBlue: CSSProperties = { ...btn, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }
/** The small note beside a license's name: "top rung", or the next rung whose rule is not seeded yet. */
const RUNG_NOTE: CSSProperties = { marginLeft: 6, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }

function shortDate(ymd: string): string {
  const [y = 1970, m = 1, d = 1] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function monthName(ym: string): string {
  const [y = 1970, m = 1] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

type LicenseRow = { id: string; person_name: string; license_type: string; date_of_expiry: string | null; note: string | null }
type NamedRow = { name: string | null; archived_at: string | null }
type ShareRow = { user_id: string; shown_by: string | null; shown_at: string }

/** `own`: the signed-in teammate's own logbook at /my-logbook, once the office showed it. */
export default function Logbook({ own = false }: { own?: boolean } = {}) {
  const { userId: routeUserId } = useParams<{ userId: string }>()
  const { user, profileName } = useAuth()
  const access = usePeopleAccess(user?.id)
  const userId = own ? user?.id : routeUserId
  const allowed = own ? Boolean(user?.id) : access.canAccessLicenses

  const [person, setPerson] = useState<{ id: string; name: string } | null>(null)
  const [licenses, setLicenses] = useState<LicenseRow[]>([])
  // The office's goal a trade (v2.6626): the class, the board's number, the hours before the clock.
  const [targets, setTargets] = useState<LicenseTarget[]>([])
  const [editingTarget, setEditingTarget] = useState<Trade | null>(null)
  const [gone, setGone] = useState<Set<string>>(() => new Set())
  const [rows, setRows] = useState<LicenseHoursLogRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAllWeeks, setShowAllWeeks] = useState(false)
  const [printFace, setPrintFace] = useState<PrintFace | null>(null)
  const [editing, setEditing] = useState<LicenseEditTarget | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [saved, setSaved] = useState<string | null>(null)
  const [notShown, setNotShown] = useState(false)
  const [share, setShare] = useState<LogbookShare | null>(null)
  const [shownByName, setShownByName] = useState<string | null>(null)
  const [shareBusy, setShareBusy] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId || !allowed) return
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        if (own) {
          const { data, error: rpcError } = await supabase.rpc('my_logbook' as never)
          if (rpcError) throw rpcError
          if (cancelled) return
          const mine = parseMyLogbook(data)
          setNotShown(!mine)
          if (!mine) return
          setPerson({ id: userId, name: mine.name })
          setLicenses([
            ...mine.licenses.map((l) => ({ id: l.id, person_name: mine.name, license_type: l.license_type, date_of_expiry: l.date_of_expiry, note: null })),
            ...mine.signers.map((s, i) => ({ id: `signer-${i}`, person_name: s.person_name, license_type: s.license_type, date_of_expiry: s.date_of_expiry, note: null })),
          ])
          setGone(new Set())
          setTargets(mine.targets)
          setRows(withOfficeJob(mine.hours, mine.officeJobId))
          return
        }
        const [u, l, users, people, r, office, shared, t] = await Promise.all([
          supabase.from('users').select('id,name').eq('id', userId).maybeSingle(),
          supabase.from('person_licenses').select('id,person_name,license_type,date_of_expiry,note'),
          supabase.from('users').select('name,archived_at'),
          supabase.from('people').select('name,archived_at'),
          supabase.rpc('list_user_license_hours_log', { p_user_id: userId }),
          supabase.from('app_settings').select('value_text').eq('key', 'overhead_office_job_ledger_id_v1').maybeSingle(),
          supabase.from('logbook_shares' as never).select('user_id,shown_by,shown_at').eq('user_id', userId).maybeSingle(),
          supabase.from('license_targets' as never).select('trade,target_class,target_amount,opening_amount,opening_source').eq('user_id', userId),
        ])
        // The share read is the strip's alone: a failure there names its reason on the strip, never blanks the logbook.
        for (const res of [u, l, users, people, r, t]) if (res.error) throw res.error
        if (cancelled) return
        // A name whose account or roster row is archived has left: they sign for nobody.
        const left = new Set<string>()
        for (const row of [...((users.data ?? []) as NamedRow[]), ...((people.data ?? []) as NamedRow[])]) {
          if (row.archived_at && row.name) left.add(row.name)
        }
        setPerson(u.data ? { id: u.data.id, name: u.data.name ?? '' } : null)
        setLicenses((l.data ?? []) as LicenseRow[])
        setTargets(parseLicenseTargets(t.data))
        setGone(left)
        setRows(withOfficeJob((r.data ?? []) as LicenseHoursLogRow[], office.data?.value_text?.trim() || null))
        setShareError(shared.error ? formatErrorMessage(shared.error) : null)
        const sr = shared.error ? null : (shared.data as ShareRow | null)
        setShare(sr ? { userId: sr.user_id, shownBy: sr.shown_by, shownAt: sr.shown_at } : null)
        if (sr?.shown_by) {
          const by = await supabase.from('users').select('name').eq('id', sr.shown_by).maybeSingle()
          if (!cancelled) setShownByName(by.data?.name ?? null)
        } else setShownByName(null)
      } catch (e) {
        if (!cancelled) setError(formatErrorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, allowed, reloadKey, own])

  async function toggleShare() {
    if (!userId || shareBusy) return
    setShareBusy(true)
    setShareError(null)
    try {
      if (share) {
        const { error: e } = await supabase.from('logbook_shares' as never).delete().eq('user_id', userId)
        if (e) throw e
        setShare(null)
        setShownByName(null)
      } else {
        const { data, error: e } = await supabase
          .from('logbook_shares' as never)
          .insert({ user_id: userId } as never)
          .select('user_id,shown_by,shown_at')
          .single()
        if (e) throw e
        const sr = data as ShareRow
        setShare({ userId: sr.user_id, shownBy: sr.shown_by, shownAt: sr.shown_at })
        setShownByName(user?.id && sr.shown_by === user.id ? profileName : null)
      }
    } catch (e) {
      setShareError(formatErrorMessage(e))
    } finally {
      setShareBusy(false)
    }
  }

  const today = todayYmdInAppTz()
  const name = person?.name ?? ''
  const firstName = name.split(' ')[0] || 'This teammate'
  const strip = shareStripWords(firstName, share, shownByName)
  // Where the page tells the reader to change a license: the office presses Edit; a teammate asks the office.
  const fixLicense = own ? 'Ask the office to put it in' : 'Press Add a license to put in'
  const heldRows = useMemo(() => licenses.filter((l) => l.person_name === name), [licenses, name])
  const held: ParsedLicense[] = useMemo(() => heldRows.map((l) => parseLicenseType(l.license_type, l.date_of_expiry)), [heldRows])
  const signers = useMemo(
    () =>
      licenses
        .filter((l) => !gone.has(l.person_name) && (!l.date_of_expiry || l.date_of_expiry >= today))
        .map((l) => ({ personName: l.person_name, license: parseLicenseType(l.license_type, l.date_of_expiry) })),
    [licenses, gone, today],
  )
  const { goals, topOfLadder, noRuleYet } = useMemo(() => goalsFor(held, targets), [held, targets])
  const openings = useMemo(() => openingsFrom(targets), [targets])
  const progress = useMemo(() => goals.map((g) => progressFor(g, rows, openings, today)), [goals, rows, openings, today])
  /** The highest license held in a trade, the rung a goal climbs from. */
  const topHeld = (trade: Trade): ParsedLicense | null => goals.find((g) => g.requirement.trade === trade)?.holds ?? noRuleYet.find((n) => n.holds.trade === trade)?.holds ?? held.find((l) => l.trade === trade && l.cls) ?? null
  const weeks = useMemo(() => logWeeks(rows), [rows])
  const totals = useMemo(() => totalsOf(rows), [rows])

  const supervisorFor = (trade: Trade, cls: Goal['requirement']['supervisorClass']): Supervisor | null => supervisorCandidates(trade, cls, signers, name)[0] ?? null

  const tradesInLog = TRADES.filter((t) => totals.byTrade[t] > 0 || goals.some((g) => g.requirement.trade === t))
  const notCountedTotal = totals.notCounted.estimating + totals.notCounted.office + totals.notCounted.no_trade
  const shownWeeks = showAllWeeks ? weeks : weeks.slice(0, 6)

  if (!own && access.accessResolved && !allowed) {
    return (
      <div className="pageWrap" style={{ padding: '1rem' }}>
        <div style={card}>The logbook opens for the people who can see People, Licenses. Ask a dev or an assistant to open it for you.</div>
      </div>
    )
  }

  if (own && notShown && !loading) {
    return (
      <div className="pageWrap" style={{ padding: '1rem' }}>
        <div style={card} data-testid="logbook-not-shown">
          Your logbook opens here once the office shows it to you. Ask the office to press Show on your logbook.
        </div>
      </div>
    )
  }

  return (
    <div className="pageWrap" style={{ padding: '1rem', display: 'grid', gap: '1rem', maxWidth: 1000 }} data-testid="logbook-page">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={eyebrow}>
            {own ? 'My logbook' : <Link to="/people?tab=licenses" style={{ color: 'inherit' }}>People · Licenses</Link>}
          </div>
          <h1 style={{ margin: '0.15rem 0 0', fontSize: '1.6rem' }}>{own ? 'Your logbook' : name ? `${firstName}’s logbook` : 'Logbook'}</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {loading
              ? 'Reading the clock…'
              : totals.firstYmd
                ? `${fmtNum(totals.all)} approved hours on the clock, ${shortDate(totals.firstYmd)} to ${shortDate(totals.lastYmd!)}. Each hour counts toward the trade of its job.`
                : own
                  ? 'The clock holds nothing approved for you yet. Approved hours land here week by week.'
                  : 'The clock holds nothing approved for this teammate yet. Approved hours land here week by week.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={btn} onClick={() => setPrintFace('summary')} disabled={loading}>Print summary sheet</button>
          <button type="button" style={btnBlue} onClick={() => setPrintFace('full')} disabled={loading}>Print full log</button>
        </div>
      </header>

      {!own && name && !loading ? (
        <div
          style={{
            ...card,
            padding: '0.6rem 0.9rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            fontSize: '0.9rem',
            ...(strip.shown ? { background: 'var(--bg-green-tint)', borderColor: 'var(--border-green)', color: 'var(--text-green-800)' } : {}),
          }}
          data-testid="logbook-share-strip"
        >
          <span style={{ minWidth: 0 }}>{strip.text}</span>
          <button type="button" style={btn} onClick={() => void toggleShare()} disabled={shareBusy} data-testid="logbook-share-toggle">
            {shareBusy ? (strip.shown ? 'Stopping…' : 'Showing…') : strip.button}
          </button>
          {shareError ? <span style={{ flexBasis: '100%', color: 'var(--text-red-700)' }}>{shareError}</span> : null}
        </div>
      ) : null}

      {error ? <div style={{ ...card, borderColor: 'var(--border-red)', color: 'var(--text-red-700)' }}>{error}</div> : null}

      {goals.length > 0 ? (
        <section style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))' }}>
          {goals.map((g, i) => {
            const pr = progress[i]
            return pr ? (
              <GoalCard
                key={g.requirement.toName}
                goal={g}
                progress={pr}
                supervisor={supervisorFor(g.requirement.trade, g.requirement.supervisorClass)}
                today={today}
                own={own}
                openingSource={targets.find((t) => t.trade === g.requirement.trade)?.openingSource ?? ''}
                onEditGoal={own ? undefined : () => setEditingTarget(g.requirement.trade)}
              />
            ) : null
          })}
        </section>
      ) : !loading ? (
        <div style={{ ...card, color: 'var(--text-muted)' }}>
          {held.some((l) => l.trade)
            ? noRuleYet.length
              ? [
                  ...noRuleYet.map((n) =>
                    own
                      ? `You hold ${n.holds.name}. The next license is ${n.next.name}, and its rule is not seeded yet.`
                      : `${firstName} holds ${n.holds.name}. The next license is ${n.next.name}, and its rule is not seeded yet.`,
                  ),
                  ...(topOfLadder.length
                    ? [
                        own
                          ? `You are at the top rung in ${topOfLadder.map((l) => TRADE_LABEL[l.trade!].toLowerCase()).join(' and ')}.`
                          : `${firstName} is at the top rung in ${topOfLadder.map((l) => TRADE_LABEL[l.trade!].toLowerCase()).join(' and ')}.`,
                      ]
                    : []),
                ].join(' ')
              : own
                ? 'You are at the top rung the logbook tracks in every trade you hold.'
                : `${firstName} is at the top rung the logbook tracks in every trade they hold.`
            : own
              ? 'The office has no trade license on file for you yet. Ask the office to put in your apprentice registration, and the hours start counting toward the next license.'
              : `The Licenses tab holds no trade license for ${firstName} yet. Press Add a license to put in their apprentice registration, and the hours start counting toward the next license.`}
        </div>
      ) : null}

      {!loading
        ? TRADES.filter((t) => totals.byTrade[t] > 0 && !held.some((l) => l.trade === t)).map((t) => (
            <div key={t} style={{ ...card, borderLeft: `4px solid ${TRADE_COLOR[t]}`, background: 'var(--bg-amber-tint)' }} data-testid="logbook-unlicensed-trade">
              <div style={{ fontWeight: 700 }}>
                {fmtNum(totals.byTrade[t])} hours of {TRADE_LABEL[t].toLowerCase()} work count toward no license.
              </div>
              <div style={{ fontSize: '0.875rem', marginTop: 4 }}>
                {own ? `The office has no ${TRADE_LABEL[t].toLowerCase()} license on file for you.` : `The Licenses tab holds no ${TRADE_LABEL[t].toLowerCase()} license for ${firstName}.`} The board counts hours worked while registered. {fixLicense} the registration, and the hours count from that day.
              </div>
            </div>
          ))
        : null}

      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Licenses held</h2>
          {name && !own ? (
            <button type="button" style={btn} onClick={() => setEditing({ id: null, raw: '', expiryYmd: null, note: null })} data-testid="logbook-add-license">
              Add a license
            </button>
          ) : null}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              <th style={{ padding: '4px 6px' }}>License</th>
              <th style={{ padding: '4px 6px' }}>Number</th>
              <th style={{ padding: '4px 6px' }}>Trade</th>
              <th style={{ padding: '4px 6px' }}>Expires</th>
              <th style={{ padding: '4px 6px' }} />
            </tr>
          </thead>
          <tbody>
            {held.map((l, i) => (
              <tr key={heldRows[i]?.id ?? l.raw} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '6px', fontWeight: 600 }}>
                  {l.name}
                  {topOfLadder.includes(l) ? <span style={RUNG_NOTE}>top rung</span> : null}
                  {noRuleYet
                    .filter((n) => n.holds === l)
                    .map((n) => (
                      <span key={n.next.level} style={RUNG_NOTE} data-testid="logbook-no-rule-yet">
                        {n.next.name} next. Its rule is not seeded yet.
                        {own || !n.holds.trade ? null : (
                          <button type="button" style={{ ...btn, marginLeft: 6, padding: '0.1rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setEditingTarget(n.holds.trade)} data-testid="logbook-set-goal">
                            Set the goal
                          </button>
                        )}
                      </span>
                    ))}
                </td>
                <td style={{ padding: '6px', fontVariantNumeric: 'tabular-nums' }}>{l.number ?? '—'}</td>
                <td style={{ padding: '6px' }}>{l.trade ? <TradeChip trade={l.trade} /> : <span style={{ color: 'var(--text-muted)' }}>Not a trade</span>}</td>
                <td style={{ padding: '6px', color: l.expiryYmd && l.expiryYmd < today ? 'var(--text-red-700)' : undefined }}>
                  {l.expiryYmd ? `${shortDate(l.expiryYmd)}, ${l.expiryYmd.slice(0, 4)}` : '—'}
                </td>
                <td style={{ padding: '6px', textAlign: 'right' }}>
                  {own ? null : <button
                    type="button"
                    style={{ ...btn, padding: '0.25rem 0.7rem', fontSize: '0.8rem' }}
                    onClick={() => {
                      const row = heldRows[i]
                      if (row) setEditing({ id: row.id, raw: row.license_type, expiryYmd: row.date_of_expiry, note: row.note })
                    }}
                  >
                    Edit
                  </button>}
                </td>
              </tr>
            ))}
            {held.length === 0 && !loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '6px', color: 'var(--text-muted)' }}>
                  {own ? 'The office has no license on file under your name. Ask the office to add yours.' : 'The Licenses tab holds nothing under this name. Press Add a license.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>The log</h2>
          <div style={{ display: 'flex', gap: 12, fontSize: '0.85rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            {tradesInLog.map((t) => (
              <span key={t}>
                <TradeChip trade={t} /> {fmtNum(totals.byTrade[t])} h
              </span>
            ))}
            <span>Not counted {fmtNum(notCountedTotal)} h</span>
          </div>
        </div>
        <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
          {shownWeeks.map((w) => (
            <div key={w.weekStartYmd} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 10px', background: 'var(--bg-subtle)', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                <b>
                  Week of {shortDate(w.weekStartYmd)} to {shortDate(w.weekEndYmd)}
                </b>
                <span style={{ color: 'var(--text-muted)' }}>
                  {TRADES.filter((t) => w.byTrade[t]).map((t) => `${TRADE_LABEL[t]} ${fmtNum(w.byTrade[t]!)} h`).join(' · ')}
                  {w.notCounted ? `${Object.keys(w.byTrade).length ? ' · ' : ''}not counted ${fmtNum(w.notCounted)} h` : ''}
                </span>
              </div>
              {w.lines.map((l) => (
                <div
                  key={l.jobKey}
                  style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 10, padding: '6px 10px', borderTop: '1px solid var(--border)', fontSize: '0.875rem', alignItems: 'center', color: l.counts.trade ? undefined : 'var(--text-muted)' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 600 }}>
                      {l.jobNumber ? `J${l.jobNumber} · ` : ''}
                      {l.jobName || 'Job'}
                    </span>
                    {l.jobAddress ? <span style={{ color: 'var(--text-muted)' }}> · {l.jobAddress}</span> : null}
                  </div>
                  <div>{l.counts.trade ? <TradeChip trade={l.counts.trade} /> : <span style={{ fontSize: '0.75rem' }}>{NOT_COUNTED_LABEL[l.counts.reason]}, not counted</span>}</div>
                  <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, minWidth: 56, textAlign: 'right' }}>{fmtNum(l.hours)} h</div>
                </div>
              ))}
            </div>
          ))}
        </div>
        {weeks.length > 6 ? (
          <button type="button" style={{ ...btn, marginTop: 10 }} onClick={() => setShowAllWeeks((v) => !v)}>
            {showAllWeeks ? 'Show the last 6 weeks' : `Show all ${weeks.length} weeks`}
          </button>
        ) : null}
        <p style={{ margin: '10px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Not counted: estimating {fmtNum(totals.notCounted.estimating)} h, office {fmtNum(totals.notCounted.office)} h, jobs with no trade {fmtNum(totals.notCounted.no_trade)} h. They stay in the log so the totals match payroll. The boards count only trade work.
        </p>
      </section>

      {saved ? <div style={{ ...card, borderColor: 'var(--border-amber)', color: 'var(--text-amber-800)' }}>{saved}</div> : null}

      {editing ? (
        <LicenseEditWindow
          personName={name}
          target={editing}
          onClose={() => setEditing(null)}
          onSaved={(warning) => {
            setEditing(null)
            setSaved(warning)
            setReloadKey((k) => k + 1)
          }}
        />
      ) : null}

      {editingTarget && userId ? (
        <LicenseTargetWindow
          personName={name}
          userId={userId}
          trade={editingTarget}
          holds={topHeld(editingTarget)}
          current={targets.find((t) => t.trade === editingTarget) ?? null}
          onClose={() => setEditingTarget(null)}
          onSaved={(saved) => {
            setEditingTarget(null)
            setTargets((prev) => [...prev.filter((t) => t.trade !== saved.trade), saved])
          }}
        />
      ) : null}

      {printFace ? (
        <LogbookPrint
          face={printFace}
          onClose={() => setPrintFace(null)}
          personName={name}
          employer={PORTAL_COMPANY.name}
          held={held}
          goals={goals}
          topOfLadder={topOfLadder}
          noRuleYet={noRuleYet}
          progress={progress}
          supervisorFor={supervisorFor}
          weeks={weeks}
          totals={totals}
          openings={openings}
          todayYmd={today}
        />
      ) : null}
    </div>
  )
}

function TradeChip({ trade }: { trade: Trade }) {
  return <span style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 700, padding: '1px 8px', borderRadius: 999, color: '#fff', background: TRADE_COLOR[trade] }}>{TRADE_LABEL[trade]}</span>
}

function GoalCard({
  goal,
  progress: p,
  supervisor,
  today,
  own,
  openingSource,
  onEditGoal,
}: {
  goal: Goal
  progress: Progress
  supervisor: Supervisor | null
  today: string
  own: boolean
  /** Where the hours before the clock came from, when the office put some in. */
  openingSource: string
  /** The office's press to set the class, the number and the hours before the clock; none on the teammate's own page. */
  onEditGoal?: () => void
}) {
  const r = goal.requirement
  const color = TRADE_COLOR[r.trade]
  return (
    <div style={{ ...card, borderTop: `4px solid ${color}` }} data-testid="logbook-goal">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={eyebrow}>
          {TRADE_LABEL[r.trade]} · from {goal.holds.name}
          {goal.holds.number ? ` #${goal.holds.number}` : ''}
        </div>
        {onEditGoal ? (
          <button type="button" style={{ ...btn, padding: '0.15rem 0.6rem', fontSize: '0.75rem' }} onClick={onEditGoal} data-testid="logbook-edit-goal">
            Edit the goal
          </button>
        ) : null}
      </div>
      <div style={{ marginTop: 4, fontSize: '0.9rem', fontWeight: 600 }}>
        Working toward {r.toName.toLowerCase()}
        {goal.fromOffice ? <span style={RUNG_NOTE}>set by the office</span> : null}
      </div>
      {p.opening > 0 ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }} data-testid="logbook-opening">
          Includes {fmtNum(p.opening)} {p.unit} before the clock started{openingSource ? `: ${openingSource}` : ''}.
        </div>
      ) : null}
      {goal.holds.expiryYmd && goal.holds.expiryYmd < today ? (
        <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 6, background: 'var(--bg-red-tint)', color: 'var(--text-red-800)', fontSize: '0.8rem' }}>
          The Licenses tab says this {goal.holds.name.toLowerCase()} registration expired {shortDate(goal.holds.expiryYmd)}, {goal.holds.expiryYmd.slice(0, 4)}. The board counts hours worked while it is current. Renew it, {own ? 'then give the office the new date.' : 'or press Edit on the license to put in the new date.'}
        </div>
      ) : null}
      <div style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1.1, marginTop: 4 }}>
        {fmtNum(p.done)} <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>of {fmtNum(p.need)} {p.unit}</span>
      </div>
      {p.unit === 'hours' ? (
        <>
          <div style={{ position: 'relative', height: 12, borderRadius: 999, background: 'var(--bg-muted)', overflow: 'hidden', marginTop: 8 }}>
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${p.pct * 100}%`, background: color }} />
          </div>
          {p.nextMark ? (
            <div style={{ fontSize: '0.875rem', marginTop: 6 }}>
              Next mark <b>{fmtNum(p.nextMark.at)} h</b>. {fmtNum(p.nextMark.away)} hours away.
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 3, marginTop: 8 }} aria-label={`${p.done} of ${p.need} months`}>
            {Array.from({ length: p.need }, (_, i) => (
              <div key={i} style={{ height: 12, borderRadius: 3, background: i < p.done ? color : 'var(--bg-muted)' }} />
            ))}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
            A month counts with 80 or more HVAC hours.{p.monthsCounted[0] ? ` Latest: ${monthName(p.monthsCounted[0])}.` : ' The clock holds none yet.'}
            {r.windowMonths ? ` Only the last ${r.windowMonths} months count.` : ''}
          </div>
        </>
      )}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        {supervisor ? (
          <>
            Signs: <b style={{ color: 'var(--text-base)' }}>{supervisor.personName}</b>, {supervisor.licenseName}
            {supervisor.number ? ` #${supervisor.number}` : ''}
          </>
        ) : (
          <span style={{ color: 'var(--text-amber-800)' }}>The Licenses tab holds no current license for a teammate who can sign {TRADE_LABEL[r.trade] === 'HVAC' ? 'HVAC' : TRADE_LABEL[r.trade].toLowerCase()} hours. {own ? 'Ask the office to add the license of the teammate who supervises you.' : 'Add the license of the teammate who supervises.'}</span>
        )}
        <br />
        Proof: the {r.board} {r.proofForm}.
        {r.caveat ? <div style={{ color: 'var(--text-amber-800)', marginTop: 4 }}>{r.caveat}</div> : null}
      </div>
    </div>
  )
}
