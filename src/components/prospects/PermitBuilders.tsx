import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { EmptyState } from '../EmptyState'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { shortDay, type BuilderMarkValue } from '../../lib/research/permitResearch'
import {
  BUILDER_KINDS,
  BUILDER_KIND_WORDS,
  BUILDER_SHOWING_WORDS,
  builderChipCounts,
  builderCountWords,
  builderName,
  buildersShowing,
  isBuilderKind,
  markHold,
  ourBidsWords,
  plumberUsedWords,
  type BuilderKind,
  type BuilderRow,
  type BuilderShowing,
} from '../../lib/research/permitBuilders'
import { googleAskForCompany, sitePermitLines, type SitePermit } from '../../lib/research/permitPublic'
import { historyAsk, historyDoneWords, permitsColumnWords, reachWords, recordsReach, recordsStartLine, theirPermitsTitle, type RecordsReach } from '../../lib/research/permitReach'
import { usePermitRecordsStart } from '../../hooks/usePermitRecordsStart'
import { loadBuilders, loadPermitsOfBuilder, markBuilder, pullPermitsBack, saveBuilder } from '../../lib/research/permitResearchIo'
import { GoogleSearchPress } from './GoogleSearchPress'

/**
 * Permits, Builders (punch list #302, PR 6): every name that pulled a commercial building permit
 * in the city as far back as the records go, a year at most, with our mark, how busy it is, how many of its permits have no
 * plumber yet, our bids with it and the plumber it uses. The chip *3 or more permits and never
 * bid* is who to get to know. A row opens the builder: its mark with the reason, what kind of
 * company it is, and its permits.
 */
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.78rem' }
const chip = (on: boolean): CSSProperties => ({ padding: '5px 11px', borderRadius: 999, fontSize: '0.78rem', border: `1px solid ${on ? '#2563eb' : 'var(--border)'}`, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text)', fontWeight: on ? 600 : 400, minHeight: 32, cursor: 'pointer', font: 'inherit', whiteSpace: 'nowrap' })
const th: CSSProperties = { textAlign: 'left', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, padding: '8px 10px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '9px 10px', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontSize: '0.8125rem' }
const num: CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const smallPress: CSSProperties = { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: '0.8125rem', minHeight: 34, cursor: 'pointer', font: 'inherit' }

function MarkPill({ mark }: { mark: BuilderMarkValue | null }) {
  const base: CSSProperties = { display: 'inline-block', borderRadius: 999, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }
  if (mark === 'good') return <span style={{ ...base, background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' }}>Good</span>
  if (mark === 'avoid') return <span style={{ ...base, background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' }}>Avoid</span>
  return <span style={{ ...base, background: 'var(--bg-200)', color: 'var(--text-700)' }}>{BUILDER_SHOWING_WORDS.unmarked}</span>
}

const SHOWING: BuilderShowing[] = ['all', 'never_bid', 'good', 'avoid', 'unmarked']

export function PermitBuilders({ city, authUserId, todayYmd, isMobile, onChanged }: { city: string; authUserId: string; todayYmd: string; isMobile: boolean; /** A mark or a kind changed: the deck's rows carry them, so they read again. */ onChanged: () => void }) {
  const [rows, setRows] = useState<BuilderRow[] | null>(null)
  const [notYet, setNotYet] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showing, setShowing] = useState<BuilderShowing>('all')
  const [search, setSearch] = useState('')
  const [openKey, setOpenKey] = useState<string | null>(null)
  // How far back every count here can see (punch list #307): the day the records start, or a year.
  const { showToast } = useToastContext()
  const [readBacks, setReadBacks] = useState(0)
  const [reading, setReading] = useState(false)
  const recordsStart = usePermitRecordsStart(city, readBacks)
  const reach = useMemo(() => recordsReach(recordsStart, todayYmd), [recordsStart, todayYmd])
  // One step further back as history, while the records are short of the goal (punch list #307).
  const ask = historyAsk(city, recordsStart, todayYmd)
  const reachSays = reachWords(reach, todayYmd)
  const startLine = recordsStartLine(city, reach, todayYmd)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await loadBuilders(city)
      setNotYet(list == null)
      setRows(list ?? [])
    } catch (e) {
      setError(formatErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [city])
  useEffect(() => {
    void load()
  }, [load])

  const readBack = async () => {
    if (!ask || reading) return
    setReading(true)
    try {
      const kept = await pullPermitsBack(city, ask.since, ask.until)
      showToast(historyDoneWords(kept, ask.since, todayYmd), 'success')
      setReadBacks((n) => n + 1)
      await load()
      onChanged()
    } catch (e) {
      showToast(formatErrorMessage(e), 'error')
    } finally {
      setReading(false)
    }
  }

  const all = useMemo(() => rows ?? [], [rows])
  const counts = useMemo(() => builderChipCounts(all), [all])
  const list = useMemo(() => buildersShowing(all, showing, search), [all, showing, search])
  const open = useMemo(() => all.find((r) => r.key === openKey) ?? null, [all, openKey])

  if (loading && rows == null) return <div style={muted}>Reading the builders…</div>
  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
        <span>{error}</span>
        <button type="button" onClick={() => void load()} style={smallPress}>
          Retry
        </button>
      </div>
    )
  }
  if (notYet) return <div style={muted}>Builders opens once tonight’s database change is in. Nothing is lost: every permit already carries who pulled it.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div role="group" aria-label="Which builders" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {SHOWING.map((s) => (
          <button key={s} type="button" aria-pressed={showing === s} onClick={() => setShowing(s)} style={chip(showing === s)}>
            {BUILDER_SHOWING_WORDS[s]} {counts[s]}
          </button>
        ))}
        <input type="search" aria-label="Search builders" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a builder or a plumber" style={{ flex: '1 1 200px', minWidth: 0, border: '1px solid var(--border)', borderRadius: 8, padding: '7px 11px', font: 'inherit', fontSize: '0.875rem', minHeight: 36, background: 'var(--surface)', color: 'var(--text)' }} />
      </div>

      {(startLine || ask) && all.length > 0 && (
        <div style={{ ...muted, background: 'var(--bg-200)', color: 'var(--text-700)', borderRadius: 8, padding: '8px 12px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: '1 1 260px' }}>{startLine ?? ask?.words}</span>
          {ask && (
            <button type="button" disabled={reading} onClick={() => void readBack()} style={{ ...smallPress, cursor: reading ? 'default' : 'pointer' }}>
              {reading ? ask.busy : ask.press}
            </button>
          )}
        </div>
      )}

      {list.length === 0 ? (
        all.length === 0 ? (
          <EmptyState main="No builders yet." tail="A builder shows here once the next pull has read who pulled each permit." compact />
        ) : (
          <EmptyState
            {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'builders', query: search }), {
              onPress: () => {
                setSearch('')
                setShowing('all')
              },
            })}
            compact
          />
        )
      ) : isMobile ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', overflow: 'hidden' }}>
          {list.map((r, i) => (
            <button key={r.key} type="button" onClick={() => setOpenKey(r.key)} style={{ display: 'grid', gap: 3, width: '100%', textAlign: 'left', padding: '11px 14px', border: 0, borderTop: i === 0 ? 0 : '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', cursor: 'pointer' }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                <strong style={{ fontSize: '0.9375rem' }}>{builderName(r)}</strong>
                <MarkPill mark={r.mark} />
              </span>
              <span style={{ fontSize: '0.8125rem' }}>{builderCountWords(r, reachSays)}</span>
              <span style={muted}>
                Our bids: {ourBidsWords(r)} · Plumber: {plumberUsedWords(r)}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr>
                <th style={th}>Builder</th>
                <th style={th}>Mark</th>
                <th style={{ ...th, textAlign: 'right' }}>{permitsColumnWords(reach, todayYmd)}</th>
                <th style={{ ...th, textAlign: 'right' }}>Without a plumber</th>
                <th style={th}>Last permit</th>
                <th style={th}>Our bids</th>
                <th style={th}>Plumber they use</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.key}>
                  <td style={td}>
                    <button type="button" onClick={() => setOpenKey(r.key)} style={{ background: 'transparent', border: 0, padding: 0, font: 'inherit', fontWeight: 700, color: 'var(--text-link)', textAlign: 'left', cursor: 'pointer' }}>
                      {builderName(r)}
                    </button>
                    {isBuilderKind(r.kind) && (
                      <>
                        <br />
                        <span style={muted}>{BUILDER_KIND_WORDS[r.kind]}</span>
                      </>
                    )}
                  </td>
                  <td style={td}>
                    <MarkPill mark={r.mark} />
                  </td>
                  <td style={num}>{r.permits}</td>
                  <td style={num}>{r.open}</td>
                  <td style={td}>{shortDay(r.last_permit_on)}</td>
                  <td style={td}>{ourBidsWords(r)}</td>
                  <td style={td}>{plumberUsedWords(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <BuilderSheet
          row={open}
          city={city}
          authUserId={authUserId}
          todayYmd={todayYmd}
          reach={reach}
          onClose={() => setOpenKey(null)}
          onSaved={() => {
            void load()
            onChanged()
          }}
        />
      )}
    </div>
  )
}

/** One builder: our mark with its reason, what kind of company it is, our bids with it, and its permits. */
function BuilderSheet({ row, city, authUserId, todayYmd, reach, onClose, onSaved }: { row: BuilderRow; city: string; authUserId: string; todayYmd: string; reach: RecordsReach; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToastContext()
  const name = builderName(row)
  const [mark, setMark] = useState<BuilderMarkValue | 'none'>(row.mark ?? 'none')
  const [reason, setReason] = useState(row.mark ? (row.mark_reason ?? '') : '')
  const [kind, setKind] = useState<BuilderKind | ''>(isBuilderKind(row.kind) ? row.kind : '')
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permits, setPermits] = useState<SitePermit[] | null>(null)

  useEffect(() => {
    let live = true
    loadPermitsOfBuilder(city, row.key, todayYmd)
      .then((list) => live && setPermits(list))
      .catch(() => live && setPermits([]))
    return () => {
      live = false
    }
  }, [city, row.key, todayYmd])

  const hold = markHold(mark, reason)
  const markChanged = mark !== (row.mark ?? 'none') || (mark !== 'none' && reason.trim() !== (row.mark_reason ?? '').trim())
  const kindChanged = kind !== (isBuilderKind(row.kind) ? row.kind : '')
  const dead = saving || (!markChanged && !kindChanged) || (markChanged && hold != null)
  const lines = permits ? sitePermitLines(permits, null) : []

  const save = async () => {
    setTried(true)
    if (dead) return
    setSaving(true)
    setError(null)
    try {
      if (kindChanged) await saveBuilder(row.key, name, kind === '' ? null : kind, authUserId)
      if (markChanged) await markBuilder(row.key, mark, mark === 'none' ? '' : reason, authUserId)
      showToast(markChanged ? (mark === 'none' ? `The mark on ${name} is cleared.` : `${name} is marked ${mark === 'good' ? 'Good' : 'Avoid'}.`) : `${name} is kept.`, 'success')
      onSaved()
      onClose()
    } catch (e) {
      setError(formatErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const seg = (value: BuilderMarkValue | 'none', words: string, tone: 'green' | 'red' | 'grey') => {
    const on = mark === value
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() => setMark(value)}
        style={{ padding: '8px 14px', fontSize: '0.8125rem', fontWeight: 600, minHeight: 40, border: 0, borderLeft: value === 'good' ? 0 : '1px solid var(--border)', cursor: 'pointer', font: 'inherit', background: on ? (tone === 'green' ? 'var(--bg-green-tint)' : tone === 'red' ? 'var(--bg-red-tint)' : 'var(--bg-200)') : 'var(--surface)', color: on ? (tone === 'green' ? 'var(--text-green-700)' : tone === 'red' ? 'var(--text-red-700)' : 'var(--text)') : 'var(--text-muted)' }}
      >
        {words}
      </button>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 750, paddingTop: 'var(--app-top-chrome, 0px)' }} onClick={() => !saving && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="builder-title" style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 12, padding: '1.25rem 1.5rem', maxWidth: 600, width: '92%', maxHeight: 'min(92vh, 100%)', overflowY: 'auto', boxShadow: '0 12px 32px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: '1rem' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={muted}>Builder</div>
            <h2 id="builder-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
              {name}
            </h2>
            <div style={muted}>
              {builderCountWords(row, reachWords(reach, todayYmd))} · last filed {shortDay(row.last_permit_on)}
            </div>
            <div style={{ marginTop: 8 }}>
              <GoogleSearchPress ask={googleAskForCompany(name, city)} words="Google the builder" />
            </div>
          </div>
          <span style={{ flex: '1 1 auto' }} />
          <button type="button" aria-label="Close" onClick={onClose} disabled={saving} style={{ background: 'transparent', border: 0, color: 'var(--text-muted)', width: 36, height: 36, borderRadius: 8, fontSize: 20, lineHeight: 1, cursor: 'pointer' }}>
            ×
          </button>
        </div>

        <section>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 6 }}>Our mark</div>
          <div role="group" aria-label="Our mark" style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {seg('good', 'Good', 'green')}
            {seg('none', 'No mark', 'grey')}
            {seg('avoid', 'Avoid', 'red')}
          </div>
          {mark !== 'none' && (
            <div style={{ marginTop: 8 }}>
              <label htmlFor="builder-mark-why" style={{ ...muted, display: 'block', marginBottom: 3 }}>
                Why, in a line
              </label>
              <input id="builder-mark-why" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Pays on time. Sends plans early." style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 11px', font: 'inherit', fontSize: '0.9375rem', minHeight: 42, background: 'var(--surface)', color: 'var(--text)' }} />
            </div>
          )}
          <div style={{ ...muted, marginTop: 6, color: tried && markChanged && hold ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
            {tried && markChanged && hold ? hold : row.mark ? `Marked ${row.mark === 'good' ? 'Good' : 'Avoid'} by ${row.mark_by_name ?? 'someone'}${row.mark_at ? ` on ${new Date(row.mark_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}. A new mark keeps your name and today.` : 'Your name and today go on the mark. Every estimator sees it on the skim card.'}
          </div>
        </section>

        <section>
          <label htmlFor="builder-kind" style={{ fontWeight: 600, fontSize: '0.875rem', display: 'block', marginBottom: 6 }}>
            What kind of company
          </label>
          <select id="builder-kind" value={kind} onChange={(e) => setKind(e.target.value as BuilderKind | '')} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', font: 'inherit', background: 'var(--surface)', color: 'var(--text)', minHeight: 40 }}>
            <option value="">Not said yet</option>
            {BUILDER_KINDS.map((k) => (
              <option key={k} value={k}>
                {BUILDER_KIND_WORDS[k]}
              </option>
            ))}
          </select>
          <div style={{ ...muted, marginTop: 6 }}>Files for others is a name that pulls permits for other people. Its cards lead with the county’s owner, and it leaves the list of who to get to know.</div>
        </section>

        <section>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>In our books</div>
          <div style={{ fontSize: '0.875rem' }}>
            Our bids: {ourBidsWords(row)}
            {row.last_bid_on ? `, the last on ${shortDay(row.last_bid_on)}` : ''}. Plumber they use: {plumberUsedWords(row)}.
          </div>
          <div style={{ ...muted, marginTop: 4 }}>People and calls are kept on the lead a pursued permit makes, on the GCs deck.</div>
        </section>

        <section>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>{theirPermitsTitle(reach, todayYmd)}</div>
          {permits == null && <div style={muted}>Reading their permits…</div>}
          {permits != null && lines.length === 0 && <div style={muted}>The feed holds none under this name’s key yet.</div>}
          {lines.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr)', gap: '3px 10px', fontSize: '0.875rem', lineHeight: 1.45 }}>
              {lines.slice(0, 20).map((l) => (
                <Fragment key={l.id}>
                  <span style={muted}>{shortDay(l.day)}</span>
                  <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                    {l.what}
                    {l.where ? <span style={muted}> · {l.where}</span> : null}
                  </span>
                </Fragment>
              ))}
            </div>
          )}
          {lines.length > 20 && <div style={{ ...muted, marginTop: 4 }}>and {lines.length - 20} older ones</div>}
        </section>

        {error && <div style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 12, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => void save()} aria-disabled={dead} style={{ background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : '#ffffff', border: 0, borderRadius: 8, padding: '11px 16px', fontSize: '0.9375rem', fontWeight: 600, minHeight: 44, cursor: dead ? 'default' : 'pointer' }}>
            {saving ? 'Keeping…' : markChanged ? (mark === 'none' ? 'Clear the mark' : `Mark as ${mark === 'good' ? 'Good' : 'Avoid'}`) : 'Keep the kind'}
          </button>
          <span style={{ flex: '1 1 auto' }} />
          <button type="button" onClick={onClose} disabled={saving} style={smallPress}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
