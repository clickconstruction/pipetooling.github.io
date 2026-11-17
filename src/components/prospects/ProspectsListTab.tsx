import { EmptyState, type EmptyStateWords } from '../EmptyState'
import type { GcBenchIn } from '../../lib/prospects/gcNeeds'
import { formatDateTime, formatTimerSeconds, formatWebsiteDisplay, getWebsiteHref } from '../../lib/prospects/prospectFormat'
import type { ProspectKind, ProspectKindWords } from '../../lib/prospects/prospectKinds'
import {
  LIST_SECTION_CHIP_LABELS,
  LIST_SECTION_LABELS,
  LIST_SECTION_ORDER,
  LIST_SECTIONS_DEFAULT_OPEN,
  filterProspectsForList,
  groupProspectsForList,
  lastTouchLabel,
  type ListSectionKey,
  type ProspectLastCall,
} from '../../lib/prospects/prospectListGrouping'
import type { Prospect } from '../../lib/prospects/prospectRow'
import type { PlansChoice } from '../../lib/prospects/subsStages'
import { telHrefFor } from '../../lib/phoneContact'
import { SubsLaneList } from './SubsLaneList'
import type { ProspectListTabState } from './useProspectListTab'

export type ProspectsListTabProps = {
  /** The tab's own state, from `useProspectListTab`. */
  list: ProspectListTabState
  kind: ProspectKind
  kindWords: ProspectKindWords
  canAccessFollowUp: boolean
  prospectListLoading: boolean
  prospectListProspects: Prospect[]
  prospectLastCallMap: Record<string, ProspectLastCall>
  /** The page's one flag for a write in flight: it stills every row's presses. */
  saving: boolean
  /** What the list says, and offers, with nothing to list. */
  prospectListEmpty: () => EmptyStateWords
  // The Subs lane's list reads the bench and the For picker too.
  answeredProspectIds: ReadonlySet<string>
  benchQuoted: ReadonlySet<string>
  gcBench: { benches: GcBenchIn[]; ownTrades: string[] }
  gcPlans: PlansChoice[]
  plansFor: string | null
  plansPick: PlansChoice | null
  setPlansFor: (id: string | null) => void
  // The row actions are the page's: each writes its caches.
  openBenchModal: (p: Prospect) => void
  openEditModalForProspect: (p: Prospect) => void
  handleSendBack: (p: Prospect) => void
  handleNotAFitFromList: (p: Prospect) => void
  handleDeleteFromList: (p: Prospect) => void
  openAddSub: (trade: string) => void
}

/**
 * The Prospect List tab: every row of the lane, grouped by pipeline stage, or by trade on the Subs lane
 * (`SubsLaneList`). Its JSX moved out of `src/pages/Prospects.tsx` unchanged; `useProspectListTab`, which the
 * page calls, holds its state, and the page's own handlers do the row actions.
 */
export function ProspectsListTab(props: ProspectsListTabProps) {
  const {
    list,
    kind,
    kindWords,
    canAccessFollowUp,
    prospectListLoading,
    prospectListProspects,
    prospectLastCallMap,
    saving,
    prospectListEmpty,
    answeredProspectIds,
    benchQuoted,
    gcBench,
    gcPlans,
    plansFor,
    plansPick,
    setPlansFor,
    openBenchModal,
    openEditModalForProspect,
    handleSendBack,
    handleNotAFitFromList,
    handleDeleteFromList,
    openAddSub,
  } = props
  const { prospectListSearchQuery, setProspectListSearchQuery, prospectListSectionOpen, selectedProspectForList, prospectLedgerSecondsMap, subsSectionOpen, toggleSubsSection, toggleProspectListSection, jumpToProspectListSection, selectProspectForList } = list

  return (
    <>
      {!canAccessFollowUp ? (
        <p style={{ color: 'var(--text-muted)' }}>You do not have access to Prospect List.</p>
      ) : prospectListLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : (
        <>
          <div style={{ width: '100%', marginBottom: '0.25rem' }}>
            <input
              type="search"
              placeholder="Search company, contact, phone, or email..."
              value={prospectListSearchQuery}
              onChange={(e) => setProspectListSearchQuery(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              style={{ width: '100%', padding: '0.35rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
            />
          </div>
          {(() => {
        const filtered = filterProspectsForList(prospectListProspects, prospectListSearchQuery)
        const calledIds = new Set(Object.keys(prospectLastCallMap))
        const nowMs = Date.now()
        // The Subs lane's list (v2.5807): the strip, For, and the lane by trade, not the recency buckets.
        if (kind === 'sub') {
          return (
            <SubsLaneList
              filtered={filtered}
              calledIds={calledIds}
              nowMs={nowMs}
              answeredIds={answeredProspectIds}
              quotedCompanyIds={benchQuoted}
              benches={gcBench.benches}
              ownTrades={gcBench.ownTrades}
              plans={gcPlans}
              plansFor={plansFor}
              picked={plansPick}
              onPick={setPlansFor}
              sectionOpen={subsSectionOpen}
              onToggleSection={toggleSubsSection}
              selectedId={selectedProspectForList?.id ?? null}
              lastCalls={prospectLastCallMap}
              saving={saving}
              kindWords={kindWords}
              empty={prospectListEmpty()}
              onCall={selectProspectForList}
              onBench={openBenchModal}
              onEdit={openEditModalForProspect}
              onSendBack={handleSendBack}
              onDelete={handleDeleteFromList}
              onAddSub={openAddSub}
            />
          )
        }
        const sections = groupProspectsForList(filtered, calledIds, nowMs)
        const isTerminal = (k: ListSectionKey) => k === 'converted' || k === 'cant_reach' || k === 'not_a_fit'
        const chipKeys = LIST_SECTION_ORDER.filter((k) => k !== 'cant_reach' && k !== 'not_a_fit')
        const chipColors: Partial<Record<ListSectionKey, { background: string; color: string }>> = {
          never_called: { background: 'var(--bg-green-100)', color: 'var(--text-green-700)' },
          going_cold: { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' },
          converted: { background: 'var(--bg-violet-100)', color: 'var(--text-violet-700)' },
        }
        return filtered.length === 0 ? (
          <EmptyState {...prospectListEmpty()} />
        ) : (
          <div>
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', margin: '0.75rem 0 0.25rem' }}>
              {chipKeys.map((key) => {
                const n = sections[key].length
                const palette = chipColors[key]
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => jumpToProspectListSection(key)}
                    disabled={n === 0}
                    style={{
                      padding: '0.2rem 0.6rem',
                      borderRadius: 999,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      border: '1px solid transparent',
                      cursor: n === 0 ? 'default' : 'pointer',
                      opacity: n === 0 ? 0.45 : 1,
                      background: palette?.background ?? 'var(--bg-subtle)',
                      color: palette?.color ?? 'var(--text-muted)',
                      borderColor: palette ? 'transparent' : 'var(--border)',
                    }}
                  >
                    {key === 'converted' ? kindWords.landedChip : LIST_SECTION_CHIP_LABELS[key]} {n}
                  </button>
                )
              })}
            </div>
            {LIST_SECTION_ORDER.map((sectionKey) => {
              const prospects = sections[sectionKey]
              if (prospects.length === 0) return null
              const isOpen = prospectListSectionOpen[sectionKey] ?? LIST_SECTIONS_DEFAULT_OPEN.has(sectionKey)
              return (
                <div key={sectionKey} id={`plist-sec-${sectionKey}`}>
                  <button
                    type="button"
                    onClick={() => toggleProspectListSection(sectionKey)}
                    aria-expanded={isOpen}
                    style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                  >
                    <span aria-hidden>{isOpen ? '\u25BC' : '\u25B6'}</span>
                    {`${sectionKey === 'converted' ? kindWords.landed : LIST_SECTION_LABELS[sectionKey]} (${prospects.length})`}
                    {sectionKey === 'never_called' && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>\u2014 oldest first, matches the calling queue</span>
                    )}
                  </button>
                  {isOpen && (
                    <div className="prospectListWrapper">
                      {/* Desktop: table */}
                      <div className="prospectListDesktop">
                        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                          <colgroup>
                            <col style={{ width: '17%' }} />
                            <col style={{ width: '11%' }} />
                            <col style={{ width: '11%' }} />
                            <col style={{ width: '8%' }} />
                            <col style={{ width: '14%' }} />
                            <col style={{ width: '22%' }} />
                            <col style={{ width: isTerminal(sectionKey) ? '17%' : '10%' }} />
                          </colgroup>
                          <thead style={{ background: 'var(--bg-subtle)' }}>
                            <tr>
                              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Company</th>
                              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Contact</th>
                              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Phone</th>
                              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Added</th>
                              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Last touch</th>
                              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Email / Links</th>
                              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{isTerminal(sectionKey) ? 'Actions' : ''}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {prospects.length === 0 ? (
                              <tr><td colSpan={7} style={{ padding: 0 }}><EmptyState compact main="No prospects in this group" /></td></tr>
                            ) : (
                              prospects.map((p) => (
                                <tr
                                  key={p.id}
                                  onClick={() => selectProspectForList(p)}
                                  style={{
                                    borderBottom: '1px solid var(--border)',
                                    cursor: 'pointer',
                                    background: selectedProspectForList?.id === p.id ? 'var(--bg-blue-tint)' : undefined,
                                  }}
                                >
                                  <td style={{ padding: '0.75rem' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                                      {p.company_name || '—'}
                                      {(p.warmth_count ?? 0) > 0 && (
                                        <span style={{ padding: '0.05rem 0.4rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600, background: 'var(--bg-orange-100)', color: 'var(--text-orange-700)', whiteSpace: 'nowrap' }}>
                                          🔥 {p.warmth_count}
                                        </span>
                                      )}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.75rem' }}>{p.contact_name || '—'}</td>
                                  <td style={{ padding: '0.75rem' }}>
                                    {p.phone_number ? (
                                      <a href={telHrefFor(p.phone_number)} style={{ color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer' }}>
                                        {p.phone_number}
                                      </a>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                  <td style={{ padding: '0.75rem' }}>{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                                  <td style={{ padding: '0.75rem' }} title={p.last_contact ? `Last contact ${formatDateTime(p.last_contact)}` : undefined}>
                                    {lastTouchLabel(p, prospectLastCallMap[p.id], nowMs)}
                                    {(prospectLedgerSecondsMap[p.id] ?? 0) > 0 && (
                                      <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace, monospace', color: 'var(--text-green-600)' }}>
                                        {' · '}{formatTimerSeconds(prospectLedgerSecondsMap[p.id] ?? 0)}
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding: '0.75rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                      <div>
                                        {p.email ? (
                                          <a href={`mailto:${encodeURIComponent(p.email)}`} style={{ color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer' }}>
                                            {p.email}
                                          </a>
                                        ) : (
                                          '—'
                                        )}
                                      </div>
                                      <div>
                                        {p.links_to_website ? (
                                          <a
                                            href={getWebsiteHref(p.links_to_website)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer' }}
                                          >
                                            {formatWebsiteDisplay(p.links_to_website)}
                                          </a>
                                        ) : (
                                          '—'
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  {isTerminal(sectionKey) ? (
                                    <td style={{ padding: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                        <button type="button" onClick={() => openEditModalForProspect(p)} disabled={saving} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: saving ? 'not-allowed' : 'pointer' }}>Edit</button>
                                        <button type="button" onClick={() => handleSendBack(p)} disabled={saving} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: saving ? 'not-allowed' : 'pointer' }}>Send back</button>
                                        <button type="button" onClick={() => handleNotAFitFromList(p)} disabled={saving} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: saving ? 'not-allowed' : 'pointer' }}>Not a fit</button>
                                        <button type="button" onClick={() => handleDeleteFromList(p)} disabled={saving} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid #dc2626', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-red-600)', cursor: saving ? 'not-allowed' : 'pointer' }}>Delete</button>
                                      </div>
                                    </td>
                                  ) : (
                                    <td style={{ padding: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                                      <button type="button" onClick={() => selectProspectForList(p)} style={{ padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                        Call now →
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                      {/* Mobile: cards */}
                      <div className="prospectListMobile">
                        {prospects.length === 0 ? (
                          <EmptyState compact main="No prospects in this group" />
                        ) : (
                          prospects.map((p) => (
                            <div key={p.id} style={{ position: 'relative' }}>
                              <button
                                type="button"
                                onClick={() => selectProspectForList(p)}
                                className={`prospectListMobileCard ${selectedProspectForList?.id === p.id ? 'prospectListMobileCardSelected' : ''}`}
                                style={isTerminal(sectionKey) ? { paddingBottom: '3rem' } : undefined}
                              >
                                <div className="prospectListMobileCardTitle">{p.company_name || '—'}</div>
                                <div className="prospectListMobileCardRow">
                                  <span className="prospectListMobileCardLabel">Contact</span>
                                  <span>{p.contact_name || '—'}</span>
                                </div>
                                <div className="prospectListMobileCardRow">
                                  <span className="prospectListMobileCardLabel">Address</span>
                                  <span>{p.address || '—'}</span>
                                </div>
                                <div className="prospectListMobileCardRow">
                                  <span className="prospectListMobileCardLabel">Phone</span>
                                  <span>
                                    {p.phone_number ? (
                                      <a href={telHrefFor(p.phone_number)} onClick={(e) => e.stopPropagation()} style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
                                        {p.phone_number}
                                      </a>
                                    ) : (
                                      '—'
                                    )}
                                  </span>
                                </div>
                                <div className="prospectListMobileCardRow">
                                  <span className="prospectListMobileCardLabel">Last touch</span>
                                  <span>
                                    {lastTouchLabel(p, prospectLastCallMap[p.id], nowMs)}
                                    {(prospectLedgerSecondsMap[p.id] ?? 0) > 0 && (
                                      <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace, monospace', color: 'var(--text-green-600)' }}>
                                        {' · '}{formatTimerSeconds(prospectLedgerSecondsMap[p.id] ?? 0)}
                                      </span>
                                    )}
                                  </span>
                                </div>
                                <div className="prospectListMobileCardRow">
                                  <span className="prospectListMobileCardLabel">Email / Links</span>
                                  <span style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <span>
                                      {p.email ? (
                                        <a href={`mailto:${encodeURIComponent(p.email)}`} onClick={(e) => e.stopPropagation()} style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
                                          {p.email}
                                        </a>
                                      ) : (
                                        '—'
                                      )}
                                    </span>
                                    <span>
                                      {p.links_to_website ? (
                                        <a
                                          href={getWebsiteHref(p.links_to_website)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          style={{ color: 'var(--text-link)', textDecoration: 'underline' }}
                                        >
                                          {formatWebsiteDisplay(p.links_to_website)}
                                        </a>
                                      ) : (
                                        '—'
                                      )}
                                    </span>
                                  </span>
                                </div>
                                <div className="prospectListMobileCardMeta">
                                  <span>Warmth {p.warmth_count ?? 0}</span>
                                </div>
                              </button>
                              {isTerminal(sectionKey) && (
                                <div style={{ position: 'absolute', bottom: '0.5rem', left: '0.5rem', right: '0.5rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                                  <button type="button" onClick={() => openEditModalForProspect(p)} disabled={saving} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: saving ? 'not-allowed' : 'pointer' }}>Edit</button>
                                  <button type="button" onClick={() => handleSendBack(p)} disabled={saving} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: saving ? 'not-allowed' : 'pointer' }}>Send back</button>
                                  <button type="button" onClick={() => handleNotAFitFromList(p)} disabled={saving} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: saving ? 'not-allowed' : 'pointer' }}>Not a fit</button>
                                  <button type="button" onClick={() => handleDeleteFromList(p)} disabled={saving} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid #dc2626', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-red-600)', cursor: saving ? 'not-allowed' : 'pointer' }}>Delete</button>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}
        </>
      )}
    </>
  )
}
