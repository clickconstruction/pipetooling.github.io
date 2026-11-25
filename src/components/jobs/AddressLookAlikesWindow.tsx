import { useMemo, useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { EmptyState } from '../EmptyState'
import { ValueSentence } from '../valuesInPlace/ValuesInPlace'
import { useToastContext } from '../../contexts/ToastContext'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { answerLookAlike, undoLookAlike, useAddressLookAlikes } from '../../hooks/useAddressLookAlikes'
import AddressSpellingFixWindow from './AddressSpellingFixWindow'
import { markedWords, onFileCountWords, type AddressOnFile } from '../../lib/addresses/addressesOnFile'
import { FIX_SPELLING_WORDS, openJobWords } from '../../lib/addresses/fixSpelling'
import {
  LOOK_ALIKE_GROUPS,
  LOOK_ALIKE_WORDS,
  answeredWords,
  apartWords,
  groupTabWords,
  lookAlikeCountsSentence,
  type LookAlikeGroup,
  type LookAlikePair,
} from '../../lib/addresses/lookAlikes'
import { shortDay } from '../../lib/jobs/jobPapers'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

type Tab = LookAlikeGroup | 'noNumber'

const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem' }
const press: CSSProperties = { minHeight: 44, padding: '0 0.9rem', borderRadius: 8, fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }
const quiet: CSSProperties = { ...press, background: 'var(--surface)', color: 'var(--text-link)', border: '1px solid var(--border-strong)', fontWeight: 600 }
/** Above the page and its bottom bar, under the Job window (1010) that **Open the job** draws over this list. */
const UNDER_THE_JOB_WINDOW = 1005
/** Doors on one no-number row. An address with more jobs than this is a road or a town, opened from the Pipeline. */
const MAX_JOB_DOORS = 4
const mark: CSSProperties = { background: 'var(--bg-amber-200)', borderRadius: 3, padding: '0 2px' }

/** What is at an address: `2 jobs · J1078, J1114`, the first few named. */
function whatIsHere(entry: AddressOnFile): string {
  const shown = entry.labels.slice(0, 4)
  const more = entry.labels.length - shown.length
  const names = shown.length > 0 ? ` · ${shown.join(', ')}${more > 0 ? ` and ${more} more` : ''}` : ''
  return `${onFileCountWords(entry)}${names}`
}

function Address({ entry, other, marked }: { entry: AddressOnFile; other: AddressOnFile; marked: boolean }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
        {marked
          ? markedWords(entry.address, other.address).map((w, i) => (
              <span key={i}>
                {i > 0 ? ' ' : ''}
                {w.differs ? <span style={mark}>{w.text}</span> : w.text}
              </span>
            ))
          : entry.address}
      </div>
      <div style={muted}>{whatIsHere(entry)}</div>
    </div>
  )
}

/**
 * Addresses that look alike (punch list #439, piece 2): the pairs of addresses on file that may be one place
 * written two ways, in three groups, each answered once with **Same place** or **Not the same**. An answer is
 * kept and changes no job's address. **Undo** asks the pair again. **Fix the spelling…** is a second, separate
 * press, on a pair not yet answered or answered Same place: it opens a small window that names the jobs it
 * changes. A fourth tab lists the addresses with no street number, which words alone cannot match, each job
 * there with a door to its own address box.
 *
 * It opens from Jobs → Pipeline → the tools menu.
 */
export default function AddressLookAlikesWindow({ onClose, onOpenJob }: { onClose: () => void; /** Open a job on its address box. With none, a no-number row has no door. */ onOpenJob?: (jobId: string) => void }) {
  const { showToast } = useToastContext()
  const { found, failure, loading, reload } = useAddressLookAlikes()
  const [tab, setTab] = useState<Tab>('alikeSameSpot')
  const [busy, setBusy] = useState<string | null>(null)
  const [fixing, setFixing] = useState<LookAlikePair | null>(null)
  const jobOpen = useJobDetailModal()?.isOpen === true

  const rows = useMemo(() => (found && tab !== 'noNumber' ? found.pairs.filter((p) => p.group === tab) : []), [found, tab])

  async function act(pair: LookAlikePair, run: () => Promise<string | null>) {
    setBusy(pair.id)
    const refusal = await run()
    setBusy(null)
    if (refusal) showToast(refusal, 'error')
    reload()
  }

  return (
    // While the small window or a job is open over this list, Escape and a press outside are theirs: they must
    // not close the list too. It sits under the Job window (1010), which a no-number row opens on top of it.
    <ResponsiveModalShell title={LOOK_ALIKE_WORDS.title} onRequestClose={fixing || jobOpen ? () => undefined : onClose} maxWidthDesktop={980} zIndex={UNDER_THE_JOB_WINDOW}>
      <div data-testid="address-look-alikes" style={{ display: 'grid', gap: '0.75rem', padding: '0.25rem 0 0.75rem', fontSize: '0.875rem' }}>
        <p style={{ margin: 0, ...muted }}>{LOOK_ALIKE_WORDS.lead}</p>
        {failure && !found ? (
          <OfflineRetryPanel failure={failure} onRetry={reload} surface="address-look-alikes" idempotent busy={loading} />
        ) : !found ? (
          <p style={{ margin: 0, ...muted }}>Loading…</p>
        ) : (
          <>
            {/* One line of counts, not three tiles: the tabs under it already carry each group's own count, and on a
                phone the tiles pushed the first pair off the screen. */}
            <p data-testid="address-look-alike-counts" style={{ margin: 0 }}>
              <ValueSentence text={lookAlikeCountsSentence(found)} />
            </p>
            <div role="tablist" aria-label="Kinds of pair" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {[...LOOK_ALIKE_GROUPS, 'noNumber' as const].map((t) => {
                const on = t === tab
                const words = t === 'noNumber' ? `${LOOK_ALIKE_WORDS.noNumber} · ${found.noNumber.length}` : groupTabWords(t, found.byGroup[t])
                return (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setTab(t)}
                    style={{ ...press, fontWeight: 600, borderRadius: 999, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-link)' : 'var(--text-700)', border: on ? '1px solid var(--border-blue)' : '1px solid var(--border-strong)' }}
                  >
                    {words}
                  </button>
                )
              })}
            </div>
            {tab === 'noNumber' ? (
              found.noNumber.length === 0 ? (
                <EmptyState main="Nothing waiting. Every address has a street number." compact />
              ) : (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {found.noNumber.map((entry) => (
                    <div key={entry.key} data-testid="address-no-number-row" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem 0.9rem', padding: '0.55rem 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ flex: '1 1 15rem', minWidth: 0 }}>
                        <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{entry.address}</div>
                        <div style={muted}>{whatIsHere(entry)}</div>
                      </div>
                      {onOpenJob ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginLeft: 'auto' }}>
                          {entry.things
                            .filter((t) => t.kind === 'job')
                            .slice(0, MAX_JOB_DOORS)
                            .map((t) => (
                              <button key={t.id} type="button" onClick={() => onOpenJob(t.id)} style={quiet}>
                                {openJobWords(t, entry.jobs)}
                              </button>
                            ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )
            ) : rows.length === 0 ? (
              <EmptyState main={LOOK_ALIKE_WORDS.nothing} compact />
            ) : (
              <div style={{ borderTop: '1px solid var(--border)' }}>
                {rows.map((pair) => {
                  const apart = apartWords(pair.meters)
                  const answered = pair.answer
                  return (
                    <div
                      key={pair.id}
                      data-testid="address-look-alike-row"
                      data-answered={answered ? 'true' : 'false'}
                      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 0.9rem', padding: '0.6rem 0', borderBottom: '1px solid var(--border)', opacity: answered ? 0.75 : 1 }}
                    >
                      <div style={{ flex: '1 1 15rem', minWidth: 0 }}>
                        <Address entry={pair.a} other={pair.b} marked={false} />
                      </div>
                      <div style={{ flex: '1 1 15rem', minWidth: 0 }}>
                        <Address entry={pair.b} other={pair.a} marked />
                        {apart ? <div style={muted}>{apart}</div> : null}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}>
                        {answered ? (
                          <>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-green-700)' }}>
                              {answeredWords(answered, shortDay(answered.at ? calendarYmdInAppTzFromIso(answered.at) : null))}
                            </span>
                            <button type="button" disabled={busy === pair.id} onClick={() => void act(pair, () => undoLookAlike(pair))} style={quiet}>
                              {LOOK_ALIKE_WORDS.undo}
                            </button>
                            {answered.same ? (
                              <button type="button" disabled={busy === pair.id} onClick={() => setFixing(pair)} style={quiet}>
                                {FIX_SPELLING_WORDS.door}
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={busy === pair.id}
                              onClick={() => void act(pair, () => answerLookAlike(pair, true))}
                              style={{ ...press, background: '#2563eb', color: '#fff', border: '1px solid #2563eb' }}
                            >
                              {LOOK_ALIKE_WORDS.same}
                            </button>
                            <button type="button" disabled={busy === pair.id} onClick={() => void act(pair, () => answerLookAlike(pair, false))} style={quiet}>
                              {LOOK_ALIKE_WORDS.notSame}
                            </button>
                            <button type="button" disabled={busy === pair.id} onClick={() => setFixing(pair)} style={quiet}>
                              {FIX_SPELLING_WORDS.door}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <p style={{ margin: 0, ...muted }}>{LOOK_ALIKE_WORDS.foot}</p>
          </>
        )}
      </div>
      {fixing ? <AddressSpellingFixWindow pair={fixing} onClose={() => setFixing(null)} onChanged={reload} /> : null}
    </ResponsiveModalShell>
  )
}
