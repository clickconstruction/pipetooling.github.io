/**
 * The Workflow page's stage list: every step as a card (folded or open), the
 * Hide Old Steps summary row, the money markers between cards and the ledger
 * rail beside them, and — on a workflow with no steps — the empty state with
 * the "Create from template" card.
 *
 * Moved verbatim from the page. The page keeps the data (the steps engine,
 * the projections, the roster), every write, every window the cards open,
 * which cards are folded (\`rowCollapsed\` — its \`onApproved\` folds the
 * approved card) and \`oldStagesCollapsed\` (the header's Hide Old Steps
 * button writes it). The list owns what only it reads: which card sections
 * and money markers are open, and whether the window is wide enough for the
 * rail.
 */
import { useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import type { Database } from '../../types/database'
import { parsePercentCompleteInput } from '../../lib/parsePercentCompleteInput'
import { buildWorkflowMoneyFlow, type WorkflowMoneyMarker } from '../../lib/workflowMoneyFlow'
import {
  balanceColor,
  formatSignedWholeDollars as railAmount,
  itemsTotalByStep,
  ledgerTotalForSteps,
  sumAmounts,
  workflowMoneyTotals,
} from '../../lib/workflowMoneyTotals'
import {
  formatLineItemDate,
  normalizeUrl,
  type AvailableInvoiceOption,
  type AvailablePOOption,
} from '../../lib/projectsForecastStageLineItems'
import {
  daysBetween,
  daysOpen,
  expectedDueState,
  formatAmount,
  formatDateShort,
  formatDatetime,
  formatScheduledDateShort,
} from '../../lib/workflow/workflowFormat'
import { getStepStatusStyle } from '../../lib/workflow/stepStatusStyle'
import { isRowDefaultCollapsed, isSectionDefaultExpanded } from '../../lib/workflow/stageCardDefaults'
import { buildStageDisplayItems } from '../../lib/workflow/stageDisplayItems'
import { stageCardPills, wordCount } from '../../lib/workflow/stageCardPills'
import { toDatetimeLocal } from '../../utils/datetimeLocal'
import { ymdDaysBetween, ymdFromDateLike } from '../../utils/dateUtils'
import { ageChipStyle } from '../../lib/ageState'
import type { WorkflowStepsEngine } from '../../hooks/useWorkflowStepsEngine'
import type { WorkflowStepWrites } from '../../hooks/useWorkflowStepWrites'
import type { WorkflowProjection as Projection, WorkflowProjections } from '../../hooks/useWorkflowProjections'
import type { WorkflowRoster } from '../../hooks/useWorkflowRoster'
import type { WorkflowTemplates } from '../../hooks/useWorkflowTemplates'
import type { ConfirmDeleteLineItem } from './WorkflowLineItemModals'
import { PersonDisplayWithContact, type PersonContactInfo } from './PersonDisplayWithContact'
import { StepCommitmentPanel } from './StepCommitmentPanel'

type Step = Database['public']['Tables']['project_workflow_steps']['Row']
type Project = Database['public']['Tables']['projects']['Row']
type LineItem = Database['public']['Tables']['workflow_step_line_items']['Row']

export type WorkflowStagesListProps = {
  engine: WorkflowStepsEngine
  writes: WorkflowStepWrites
  projections: WorkflowProjections
  roster: WorkflowRoster
  templates: WorkflowTemplates
  /** Loaded — the page draws the list only once it has the project. */
  project: Project
  canManageStages: boolean
  canSeePrivateNotesAndApprove: boolean
  isDevOrMaster: boolean
  oldStagesCollapsed: boolean
  setOldStagesCollapsed: Dispatch<SetStateAction<boolean>>
  rowCollapsed: Record<string, boolean>
  setRowCollapsed: Dispatch<SetStateAction<Record<string, boolean>>>
  // The windows a card opens (the page draws them).
  openAddStep: (insertAfterStepId?: string) => void
  openEditStep: (step: Step) => void
  openExpectedDates: (step: Step) => void
  setAssignPersonStep: Dispatch<SetStateAction<Step | null>>
  setRejectStep: Dispatch<SetStateAction<{ step: Step; reason: string } | null>>
  setSkipStep: Dispatch<SetStateAction<{ step: Step; reason: string } | null>>
  setSetStartStep: Dispatch<SetStateAction<{ step: Step; startDateTime: string } | null>>
  setConfirmDeleteStep: Dispatch<SetStateAction<Step | null>>
  setDeleteStepConfirmText: Dispatch<SetStateAction<string>>
  setPersonContactModal: Dispatch<SetStateAction<PersonContactInfo | null>>
  // The line-item windows a card opens.
  openEditLineItem: (stepId: string, item: LineItem | null) => void
  setConfirmDeleteLineItem: Dispatch<SetStateAction<ConfirmDeleteLineItem | null>>
  setAddingPOToStep: Dispatch<SetStateAction<string | null>>
  setAddingInvoiceToStep: Dispatch<SetStateAction<string | null>>
  loadPODetails: (poId: string) => void
  loadInvoiceDetails: (invoiceId: string) => void
  availablePOs: AvailablePOOption[]
  availableInvoices: AvailableInvoiceOption[]
}

export function WorkflowStagesList({
  engine,
  writes,
  projections: projectionsApi,
  roster: rosterApi,
  templates: templatesApi,
  project,
  canManageStages,
  canSeePrivateNotesAndApprove,
  isDevOrMaster,
  oldStagesCollapsed,
  setOldStagesCollapsed,
  rowCollapsed,
  setRowCollapsed,
  openAddStep,
  openEditStep,
  openExpectedDates,
  setAssignPersonStep,
  setRejectStep,
  setSkipStep,
  setSetStartStep,
  setConfirmDeleteStep,
  setDeleteStepConfirmText,
  setPersonContactModal,
  openEditLineItem,
  setConfirmDeleteLineItem,
  setAddingPOToStep,
  setAddingInvoiceToStep,
  loadPODetails,
  loadInvoiceDetails,
  availablePOs,
  availableInvoices,
}: WorkflowStagesListProps) {
  const {
    steps,
    lineItems,
    stepActions,
    userSubscriptions,
    commitmentsByStep,
    commitmentPaymentsByLaborJobId,
    setError,
    loadCommitmentsForSteps,
  } = engine
  const {
    markApproved,
    markCompleted,
    markReopened,
    updatePercentComplete,
    updateNotifyAssigned,
    updateCrossStepNotify,
    updateNotifyMe,
    updateNotes,
    updatePrivateNotes,
  } = writes
  const { projections, openEditProjection, deleteProjection } = projectionsApi
  const { userRole, currentUserName, roster, personContacts, userNames } = rosterApi
  const { templates, selectedTemplateId, setSelectedTemplateId, creatingFromTemplate, createFromTemplate } = templatesApi
  /** Inline money markers (v2.1194): projection ids whose between-card row is expanded. */
  const [expandedProjectionIds, setExpandedProjectionIds] = useState<Set<string>>(new Set())
  /** Ledger rail (v2.1195): the left balance column needs real horizontal room. */
  const [wideForLedger, setWideForLedger] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1100)
  useEffect(() => {
    const onResize = () => setWideForLedger(window.innerWidth >= 1100)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const [sectionExpanded, setSectionExpanded] = useState<Record<string, boolean>>({})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, alignItems: 'center' }}>
      {steps.length === 0 ? (
        <div>
          {canManageStages ? (
            <>
              <p style={{ marginBottom: '1rem' }}>No steps yet. Add a step or create from a template.</p>
              {templates.length > 0 && (
                <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 8, marginBottom: '1rem', maxWidth: 400 }}>
                  <strong style={{ display: 'block', marginBottom: 8 }}>Create from template</strong>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      style={{ padding: '0.5rem', flex: 1, minWidth: 160 }}
                    >
                      <option value="">Select a template</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={createFromTemplate}
                      disabled={!selectedTemplateId || creatingFromTemplate}
                      title={!selectedTemplateId ? 'Select a template' : undefined}
                      className="wf-btn-primary"
                    >
                      {creatingFromTemplate ? 'Creating...' : 'Create from template'}
                    </button>
                    {!selectedTemplateId && !creatingFromTemplate && (
                      <span style={{ fontSize: '0.8rem', color: '#FF6600', marginLeft: '0.5rem' }}>Select a template</span>
                    )}
                  </div>
                </div>
              )}
              <p>Or <button type="button" onClick={() => openAddStep()} className="wf-btn-link">add a step</button> to build from scratch.</p>
            </>
          ) : (
            <p style={{ marginBottom: '1rem' }}>No steps assigned to you in this workflow.</p>
          )}
        </div>
      ) : (() => {
        const displayItems = buildStageDisplayItems(steps, oldStagesCollapsed)
        // Money flow (v2.1194): projections anchored to steps render as inline
        // markers with running projected/spent totals. Dev/master only — same
        // visibility as the top Projections panel.
        const orderedStepIds = [...steps].sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0)).map((st) => st.id)
        const itemsTotalByStepId = itemsTotalByStep(orderedStepIds, lineItems)
        const moneyFlow = isDevOrMaster
          ? buildWorkflowMoneyFlow(orderedStepIds, projections, itemsTotalByStepId)
          : { beforeByStep: {}, afterByStep: {}, stepProjectedTotal: {}, stepBalance: {} }
        // Ledger rail (v2.1195): a left balance column aligned to every card and
        // marker, plus a sticky margin/balance summary. Wide viewports only —
        // narrow screens keep the marker pills.
        const {
          projectionsTotal,
          ledgerTotal,
          marginPct,
          balance: balanceNow,
          hasMoney,
        } = workflowMoneyTotals(sumAmounts(projections), ledgerTotalForSteps(orderedStepIds, itemsTotalByStepId))
        const showLedgerRail = isDevOrMaster && wideForLedger && hasMoney
        const RAIL_W = 150
        const railGutter = (value: number | null) =>
          showLedgerRail ? (
            <div
              style={{
                width: RAIL_W,
                flexShrink: 0,
                boxSizing: 'border-box',
                textAlign: 'right',
                paddingRight: 14,
                fontSize: '0.75rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
                color: value == null ? 'var(--text-faint)' : balanceColor(value),
                borderRight: '2px solid var(--border)',
                alignSelf: 'stretch',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              {value == null ? '' : railAmount(value)}
            </div>
          ) : null
        const railRow = (value: number | null, content: ReactNode, centerContent = false, key?: string) =>
          showLedgerRail ? (
            <div key={key} style={{ display: 'flex', width: '100%', alignItems: 'stretch' }}>
              {railGutter(value)}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: centerContent ? 'center' : 'stretch',
                  justifyContent: 'center',
                }}
              >
                {content}
              </div>
            </div>
          ) : (
            content
          )
        const stickyLedgerCard = showLedgerRail ? (
          <div key="ledger-sticky" style={{ alignSelf: 'flex-start', position: 'sticky', top: 60, zIndex: 5, marginBottom: 8 }}>
            <div
              style={{
                width: RAIL_W - 16,
                boxSizing: 'border-box',
                border: '1px solid var(--border-strong)',
                borderRadius: 8,
                background: 'var(--surface)',
                padding: '0.5rem 0.65rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Project margin</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: marginPct == null ? 'var(--text-muted)' : balanceColor(marginPct) }}>
                {marginPct == null ? '—' : `${marginPct.toFixed(1)}%`}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4 }}>Balance</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: balanceColor(balanceNow), fontVariantNumeric: 'tabular-nums' }}>
                {railAmount(balanceNow)}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
                proj {railAmount(projectionsTotal)}
                <br />
                spent {railAmount(-ledgerTotal)}
              </div>
            </div>
          </div>
        ) : null
        const renderMoneyMarker = (m: WorkflowMoneyMarker<Projection>) => {
          const p = m.projection
          const expanded = expandedProjectionIds.has(p.id)
          const toggle = () =>
            setExpandedProjectionIds((prev) => {
              const next = new Set(prev)
              if (next.has(p.id)) next.delete(p.id)
              else next.add(p.id)
              return next
            })
          const anchorStep = steps.find((st) => st.id === p.step_id)
          return (
            <div key={p.id} style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '0.25rem' }}>
              <button
                type="button"
                onClick={toggle}
                aria-expanded={expanded}
                title="Projection — click for details"
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '0.45rem',
                  maxWidth: 'min(100%, 640px)',
                  padding: '0.2rem 0.6rem',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '0.8125rem',
                  color: 'var(--text-700)',
                }}
              >
                <span aria-hidden style={{ fontWeight: 700, color: 'var(--text-green-700)' }}>$</span>
                <span style={{ color: 'var(--text-muted)' }}>Projection · {p.memo}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-green-700)', whiteSpace: 'nowrap' }}>{formatAmount(p.amount)}</span>
                <span style={{ padding: '0.1rem 0.5rem', borderRadius: 999, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', fontSize: '0.6875rem', whiteSpace: 'nowrap' }}>
                  projected to here {formatAmount(m.runningProjected)}
                </span>
                <span style={{ padding: '0.1rem 0.5rem', borderRadius: 999, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', fontSize: '0.6875rem', whiteSpace: 'nowrap' }}>
                  spent {formatAmount(m.runningSpent)}
                </span>
                <span aria-hidden style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{expanded ? '▼' : '▶'}</span>
              </button>
              {expanded && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', maxWidth: 'min(100%, 480px)', width: '100%', boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontWeight: 600 }}>
                    <span>{p.stage_name}{p.memo ? ` — ${p.memo}` : ''}</span>
                    <span style={{ color: 'var(--text-green-700)', whiteSpace: 'nowrap' }}>{formatAmount(p.amount)}</span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                    {p.placement === 'before' ? 'before' : 'after'} · {anchorStep?.name ?? 'step'}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: 6 }}>
                    <button type="button" onClick={() => openEditProjection(p)} className="wf-btn-ghost" style={{ fontSize: '0.75rem' }}>Edit</button>
                    <button type="button" onClick={() => deleteProjection(p.id)} className="wf-btn-danger" style={{ fontSize: '0.75rem' }}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          )
        }
        return (<>
        {stickyLedgerCard}
        {displayItems.map((item, index) => {
          if (item.type === 'summary') {
            return (
              <div key="old-stages-summary" id="old-stages-summary">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setOldStagesCollapsed(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setOldStagesCollapsed(false)}
                  style={{
                    padding: '0.5rem 0',
                    marginBottom: '0.25rem',
                    fontSize: '0.8125rem',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  {item.count} previous {item.count === 1 ? 'step' : 'steps'} · Started {formatDateShort(item.firstStarted)}
                </div>
              </div>
            )
          }
          const s = item.step
          const isCollapsed = rowCollapsed[s.id] ?? isRowDefaultCollapsed(s)
          const stepBal = moneyFlow.stepBalance[s.id]
          const stepBalValue = showLedgerRail && stepBal ? stepBal.projected - stepBal.spent : null
          return (
          <div
            key={s.id}
            id={`step-${s.id}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: showLedgerRail ? 'stretch' : isCollapsed ? 'center' : 'stretch',
              alignSelf: showLedgerRail ? 'stretch' : isCollapsed ? 'center' : 'stretch',
              width: showLedgerRail ? '100%' : isCollapsed ? 'fit-content' : '100%',
            }}
          >
            {(moneyFlow.beforeByStep[s.id] ?? []).map((m) =>
              railRow(m.runningProjected - m.runningSpent, renderMoneyMarker(m), true, `rail-${m.projection.id}`),
            )}
            {railRow(stepBalValue, (
            <div
              style={{
                border: '1px solid var(--border-sky)',
                borderRadius: 8,
                padding: '0.5rem 0.75rem',
                marginBottom: '0.25rem',
                background: 'var(--surface)',
                ...(isCollapsed && { display: 'inline-block', width: 'fit-content', maxWidth: 'min(100%, 520px)', borderLeft: `9px solid ${getStepStatusStyle(s.status).color}` }),
                ...(!isCollapsed && s.status === 'in_progress' && { background: 'var(--bg-orange-tint)', borderLeft: '4px solid #E87600' }),
              }}
            >
              {(() => {
                const toggleRow = () => setRowCollapsed((p) => ({ ...p, [s.id]: !(p[s.id] ?? isRowDefaultCollapsed(s)) }))
                return (
                  <>
              {/* Row 1: Chevron · Title · status · Assigned [Assign] [Notify] */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { if (!(e.target as HTMLElement).closest('button, [data-stop]')) toggleRow() }}
                    onKeyDown={(e) => e.key === 'Enter' && toggleRow()}
                    style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginBottom: 4, fontSize: '0.8125rem', cursor: 'pointer', ...(isCollapsed && { minWidth: 0 }) }}
                  >
                    <span style={{ fontSize: '0.75rem', minWidth: 16 }}>{isCollapsed ? '\u25B6' : '\u25BC'}</span>
                    <span style={{ fontWeight: isCollapsed ? getStepStatusStyle(s.status).fontWeight : 600, color: isCollapsed ? getStepStatusStyle(s.status).color : 'var(--text-strong)' }}>{s.name}</span>
                    <span style={{ color: 'var(--text-faint)' }}>·</span>
                    <span style={{ color: s.status === 'rejected' ? '#b91c1c' : s.status === 'skipped' ? 'var(--text-muted)' : 'var(--text-700)', fontWeight: s.status === 'rejected' ? 500 : 'normal' }}>
                      {s.status === 'rejected' ? 'Previous work incomplete' : s.status === 'skipped' ? 'Skipped' : s.status}{s.status === 'rejected' && s.rejection_reason ? ` - ${s.rejection_reason}` : ''}{s.status === 'skipped' && s.skipped_reason ? ` - ${s.skipped_reason}` : ''}{s.status === 'in_progress' && (() => {
                        const d = daysOpen(s.started_at, s.ended_at)
                        return d != null ? ` · ${d === 1 ? '1 day' : `${d} days`} open` : null
                      })()}
                    </span>
                    <span style={{ color: 'var(--text-faint)' }}>·</span>
                    <span style={{ color: 'var(--text-700)' }}>
                      <PersonDisplayWithContact name={s.assigned_to_name} contacts={personContacts} userNames={userNames} onOpenContact={setPersonContactModal} />
                    </span>
                    {canManageStages && !isCollapsed && (
                      <button type="button" data-stop onClick={(e) => { e.stopPropagation(); setAssignPersonStep(s) }} className="wf-btn-ghost">Assign</button>
                    )}
                    {((canManageStages || s.assigned_to_name === currentUserName) || (stepActions[s.id]?.length ?? 0) > 0) && !isCollapsed && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                        {(canManageStages || s.assigned_to_name === currentUserName) && (() => {
                          const key = `${s.id}-notify`
                          const defaultExpanded = isSectionDefaultExpanded(s, 'notify')
                          const isExpanded = sectionExpanded[key] ?? defaultExpanded
                          return (
                            <span
                              role="button"
                              tabIndex={0}
                              data-stop
                              onClick={(e) => { e.stopPropagation(); setSectionExpanded((p) => ({ ...p, [key]: !isExpanded })) }}
                              onKeyDown={(e) => e.key === 'Enter' && setSectionExpanded((p) => ({ ...p, [key]: !isExpanded }))}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500, cursor: 'pointer', color: 'var(--text-muted)' }}
                            >
                              <span style={{ fontSize: '0.75rem', minWidth: 14 }}>{isExpanded ? '\u25BC' : '\u25B6'}</span>
                              <span>Notify</span>
                            </span>
                          )
                        })()}
                        {stepActions[s.id] && stepActions[s.id]!.length > 0 && (() => {
                          const key = `${s.id}-actionLedger`
                          const isExpanded = sectionExpanded[key] ?? false
                          const count = stepActions[s.id]!.length
                          return (
                            <span
                              role="button"
                              tabIndex={0}
                              data-stop
                              onClick={(e) => { e.stopPropagation(); setSectionExpanded((p) => ({ ...p, [key]: !isExpanded })) }}
                              onKeyDown={(e) => e.key === 'Enter' && setSectionExpanded((p) => ({ ...p, [key]: !isExpanded }))}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500, cursor: 'pointer', color: 'var(--text-muted)' }}
                            >
                              <span style={{ fontSize: '0.75rem', minWidth: 14 }}>{isExpanded ? '\u25BC' : '\u25B6'}</span>
                              <span>Action Ledger ({count})</span>
                            </span>
                          )
                        })()}
                      </span>
                    )}
                    {isCollapsed && (() => {
                      const pillStyle = { display: 'inline-flex' as const, alignItems: 'center' as const, padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-muted)' }
                      const expectedPillStyle = { ...pillStyle, background: 'var(--bg-blue-tint)', color: '#1e3a8a' }
                      const {
                        itemCount: count,
                        itemsTotal: total,
                        notesWords,
                        privateWords,
                        daysPrefix,
                        hasExpected,
                      } = stageCardPills(s, lineItems[s.id] || [])
                      // Expected dates against today (journey-map #40 / J31-5): a window months
                      // past no longer reads calm blue — red "N days late", amber on the due day.
                      const due = hasExpected ? expectedDueState(s) : null
                      const duePillStyle = due && due.state !== 'fresh'
                        ? { ...pillStyle, ...ageChipStyle(due.state), fontWeight: 600 }
                        : expectedPillStyle
                      return (
                        <div style={{ flexBasis: '100%', minWidth: 0, marginTop: 4, marginLeft: 20, display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', alignSelf: 'flex-start' }}>
                          <span style={pillStyle}>
                            {daysPrefix}{formatDateShort(s.started_at)} → {formatDateShort(s.ended_at)}
                          </span>
                          {hasExpected && (
                            <span style={duePillStyle} title={due?.label ? `Expected start → Expected end · ${due.label}` : 'Expected start → Expected end'}>
                              Exp: {formatScheduledDateShort(s.scheduled_start_date)} → {formatScheduledDateShort(s.scheduled_end_date)}
                              {due?.label ? ` · ${due.label}` : null}
                            </span>
                          )}
                          {canManageStages && count > 0 && (
                            <span style={pillStyle}>
                              {count} {count === 1 ? 'item' : 'items'} · {formatAmount(total)}
                            </span>
                          )}
                          {notesWords > 0 && (
                            <span style={pillStyle}>Notes: {notesWords}</span>
                          )}
                          {canSeePrivateNotesAndApprove && privateWords > 0 && (
                            <span style={pillStyle}>Office: {privateWords}</span>
                          )}
                        </div>
                      )
                    })()}
                  </div>
              {/* Row 2: Action buttons - only visible when expanded and user can act */}
              {((canManageStages || s.assigned_to_name === currentUserName) && !isCollapsed) && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
                  {(s.status === 'pending' || s.status === 'in_progress') && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Technician:</span>
                      {s.status === 'pending' && (
                        <button type="button" onClick={() => setSetStartStep({ step: s, startDateTime: toDatetimeLocal(new Date().toISOString()) })} className="wf-btn-info">
                          Set Start
                        </button>
                      )}
                      <button type="button" onClick={() => markCompleted(s)} className="wf-btn-success">
                        Mark Complete
                      </button>
                    </span>
                  )}
                  {canSeePrivateNotesAndApprove && (s.status === 'pending' || s.status === 'in_progress') && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 12, paddingLeft: 12, borderLeft: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Office:</span>
                      <button type="button" onClick={() => markApproved(s)} className="wf-btn-info">
                        Approve
                      </button>
                      <button type="button" onClick={() => setRejectStep({ step: s, reason: '' })} className="wf-btn-danger">
                        Send Back: Previous Work Incomplete
                      </button>
                      <button type="button" onClick={() => setSkipStep({ step: s, reason: '' })} className="wf-btn-secondary" style={{ color: 'var(--text-amber-800)' }}>
                        Skip
                      </button>
                    </span>
                  )}
                  {!isCollapsed && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Start: {formatDateShort(s.started_at)}{' \u00B7 '}End: {formatDateShort(s.ended_at)}
                      {s.status === 'in_progress' ? null : (() => {
                        const d = daysBetween(s.started_at, s.ended_at)
                        return d != null ? ` · open for ${d === 1 ? '1 day' : `${d} days`}` : null
                      })()}
                    </span>
                  )}
                </div>
              )}
              {/* Row 2b: Expected (planned) start/end - always visible when expanded */}
              {!isCollapsed && (() => {
                const canEditExpected = canManageStages || s.assigned_to_name === currentUserName
                const startYmd = ymdFromDateLike(s.scheduled_start_date)
                const endYmd = ymdFromDateLike(s.scheduled_end_date)
                const lengthDays = startYmd && endYmd ? ymdDaysBetween(startYmd, endYmd) : null
                const lengthLabel = lengthDays != null
                  ? lengthDays === 1
                    ? '1 day planned'
                    : `${lengthDays} days planned`
                  : null
                const linkButtonStyle = {
                  padding: 0,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-link)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  font: 'inherit',
                } as const
                const renderField = (ymd: string, label: string) => {
                  if (ymd) {
                    const text = formatScheduledDateShort(ymd)
                    return canEditExpected ? (
                      <button
                        type="button"
                        onClick={() => openExpectedDates(s)}
                        style={linkButtonStyle}
                        title={`Edit expected ${label}`}
                        aria-label={`Edit expected ${label}`}
                      >
                        {text}
                      </button>
                    ) : (
                      <span>{text}</span>
                    )
                  }
                  return canEditExpected ? (
                    <button
                      type="button"
                      onClick={() => openExpectedDates(s)}
                      style={linkButtonStyle}
                      title={`Set expected ${label}`}
                      aria-label={`Set expected ${label}`}
                    >
                      set
                    </button>
                  ) : (
                    <span>{'\u2014'}</span>
                  )
                }
                const due = startYmd || endYmd ? expectedDueState(s) : null
                return (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span style={{ marginLeft: 'auto' }}>
                      Expected: Start {renderField(startYmd, 'start')}
                      {' \u00B7 '}
                      End {renderField(endYmd, 'end')}
                      {lengthLabel ? ` · ${lengthLabel}` : null}
                      {due?.label ? (
                        <span style={{ marginLeft: 4, fontWeight: 600, color: due.state === 'red' ? 'var(--text-red-700)' : 'var(--text-amber-800)' }}>
                          · {due.label}
                        </span>
                      ) : null}
                    </span>
                  </div>
                )
              })()}
              {/* Row 2c: Percent complete - same edit gate as Expected dates (assignee
                  or manager). Uncontrolled input re-keys off the persisted value so a
                  Forecast Specific edit elsewhere propagates here automatically. Empty
                  field == null in the DB (== "not tracked"). */}
              {!isCollapsed && (() => {
                const canEditPct = canManageStages || s.assigned_to_name === currentUserName
                const pct = s.percent_complete ?? null
                return (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Complete:{' '}
                      {canEditPct ? (
                        <>
                          <input
                            key={`pct-workflow-${s.id}-${pct ?? 'null'}`}
                            type="number"
                            // `no-spinner` matches the Forecast Specific gutter cell —
                            // hides the browser's up/down stepper arrows for a quieter
                            // input that fits the small `Complete:` row.
                            className="no-spinner"
                            min={0}
                            max={100}
                            inputMode="numeric"
                            defaultValue={pct == null ? '' : String(pct)}
                            placeholder="—"
                            aria-label={`Percent complete for ${s.name}`}
                            title="Optional 0-100 progress estimate. Leave empty when not tracked."
                            onBlur={(e) => {
                              const next = parsePercentCompleteInput(e.currentTarget.value)
                              if (next === pct) return
                              void updatePercentComplete(s, next)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
                            }}
                            style={{
                              width: '3rem',
                              padding: '0.1rem 0.25rem',
                              fontSize: '0.75rem',
                              textAlign: 'right',
                              border: 'none',
                              borderBottom: '1px solid var(--border-strong)',
                              borderRadius: 0,
                              background: 'transparent',
                              color: 'var(--text-slate-900)',
                            }}
                          />
                          <span style={{ color: 'var(--text-muted)' }}>%</span>
                        </>
                      ) : (
                        <span style={{ color: pct == null ? 'var(--text-slate-400)' : 'var(--text-slate-900)' }}>
                          {pct == null ? '\u2014' : `${pct}%`}
                        </span>
                      )}
                    </span>
                  </div>
                )
              })()}
              {/* Collapsed body - hidden when collapsed */}
              {!isCollapsed && (
              <>
              {s.next_step_rejected_notice && (s.status === 'pending' || s.status === 'in_progress') && (
                <div style={{
                  background: '#b91c1c',
                  marginLeft: '-0.75rem',
                  marginRight: '-0.75rem',
                  padding: '0.5rem calc(1.5rem + 0.75rem)',
                  marginBottom: 4,
                  fontSize: '0.8125rem',
                  color: '#ffffff',
                  fontStyle: 'italic',
                  textAlign: 'center',
                }}>
                  Next stage <strong style={{ textDecoration: 'underline' }}>{s.next_step_rejected_notice}</strong> rejected, this stage must be re-completed.
                  {s.next_step_rejection_reason && (
                    <div style={{ marginTop: 2, fontWeight: 600, fontStyle: 'normal', color: '#ffffff' }}>Reason: {s.next_step_rejection_reason}</div>
                  )}
                </div>
              )}
              {/* Notify expanded content */}
              {(canManageStages || s.assigned_to_name === currentUserName) && (() => {
                const key = `${s.id}-notify`
                const defaultExpanded = isSectionDefaultExpanded(s, 'notify')
                const isExpanded = sectionExpanded[key] ?? defaultExpanded
                return isExpanded ? (
                            <>
                    <table style={{ borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', fontWeight: 500 }}></th>
                          {canManageStages && (
                            <th style={{ textAlign: 'center', padding: '0.25rem 0.5rem', fontWeight: 500 }}>ASSIGNED</th>
                          )}
                          <th style={{ textAlign: 'center', padding: '0.25rem 0.5rem', fontWeight: 500 }}>ME</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>started</td>
                          {canManageStages && (
                            <td style={{ padding: '0.25rem 0.5rem', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={!!s.notify_assigned_when_started}
                                onChange={(e) => updateNotifyAssigned(s, 'notify_assigned_when_started', e.target.checked)}
                                style={{ cursor: 'pointer' }}
                              />
                            </td>
                          )}
                          <td style={{ padding: '0.25rem 0.5rem', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={!!userSubscriptions[s.id]?.notify_when_started}
                              onChange={(e) => updateNotifyMe(s, 'notify_when_started', e.target.checked)}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>complete</td>
                          {canManageStages && (
                            <td style={{ padding: '0.25rem 0.5rem', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={!!s.notify_assigned_when_complete}
                                onChange={(e) => updateNotifyAssigned(s, 'notify_assigned_when_complete', e.target.checked)}
                                style={{ cursor: 'pointer' }}
                              />
                            </td>
                          )}
                          <td style={{ padding: '0.25rem 0.5rem', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={!!userSubscriptions[s.id]?.notify_when_complete}
                              onChange={(e) => updateNotifyMe(s, 'notify_when_complete', e.target.checked)}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>re-opened</td>
                          {canManageStages && (
                            <td style={{ padding: '0.25rem 0.5rem', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={!!s.notify_assigned_when_reopened}
                                onChange={(e) => updateNotifyAssigned(s, 'notify_assigned_when_reopened', e.target.checked)}
                                style={{ cursor: 'pointer' }}
                              />
                            </td>
                          )}
                          <td style={{ padding: '0.25rem 0.5rem', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={!!userSubscriptions[s.id]?.notify_when_reopened}
                              onChange={(e) => updateNotifyMe(s, 'notify_when_reopened', e.target.checked)}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    {canManageStages && (
                      <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={s.notify_next_assignee_when_complete_or_approved !== false}
                            onChange={(e) => updateCrossStepNotify(s, 'notify_next_assignee_when_complete_or_approved', e.target.checked)}
                            style={{ cursor: 'pointer' }}
                          />
                          Notify next card assignee when complete or approved
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '0.25rem' }}>
                          <input
                            type="checkbox"
                            checked={s.notify_prior_assignee_when_rejected !== false}
                            onChange={(e) => updateCrossStepNotify(s, 'notify_prior_assignee_when_rejected', e.target.checked)}
                            style={{ cursor: 'pointer' }}
                          />
                          Notify prior card assignee when marked incomplete
                        </label>
                      </div>
                    )}
                            </>
                  ) : null
                })()}
              {s.status === 'approved' && s.approved_by && s.approved_at && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-green-600)', marginBottom: 4, fontWeight: 500 }}>
                  Approved by {s.approved_by} on {formatDatetime(s.approved_at)}
                </div>
              )}
              {stepActions[s.id] && stepActions[s.id]!.length > 0 && (() => {
                const key = `${s.id}-actionLedger`
                const isExpanded = sectionExpanded[key] ?? false
                return isExpanded ? (
                  <div style={{ marginBottom: 4, padding: '0.5rem 0.6rem', background: 'var(--bg-subtle)', borderRadius: 4, border: '1px solid var(--border)' }}>
                    {stepActions[s.id]!.map((action) => (
                      <div key={action.id} style={{ marginBottom: '0.25rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        <span style={{ fontWeight: 500, textTransform: 'capitalize', color: 'var(--text-700)' }}>{action.action_type === 'rejected' ? 'Previous work incomplete' : action.action_type === 'skipped' ? 'Skipped' : action.action_type}</span>
                        {' by '}
                        <span style={{ fontWeight: 500 }}>{action.performed_by}</span>
                        {' on '}
                        <span>{formatDatetime(action.performed_at)}</span>
                        {action.notes && (
                          <div style={{ marginTop: 2, marginLeft: '1rem', fontStyle: 'italic', color: 'var(--text-faint)' }}>
                            {action.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null
              })()}
              <div style={{ marginBottom: 4 }}>
                {(() => {
                  const key = `${s.id}-notes`
                  const defaultExpanded = isSectionDefaultExpanded(s, 'notes')
                  const stored = sectionExpanded[key]
                  const isExpanded = stored ?? defaultExpanded
                  return (
                    <>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setSectionExpanded((p) => ({ ...p, [key]: !isExpanded }))}
                        onKeyDown={(e) => e.key === 'Enter' && setSectionExpanded((p) => ({ ...p, [key]: !isExpanded }))}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 2, fontWeight: 500, cursor: 'pointer', fontSize: '0.8125rem' }}
                      >
                        <span style={{ fontSize: '0.75rem', minWidth: 16 }}>{isExpanded ? '\u25BC' : '\u25B6'}</span>
                        <span>Notes for Tech ({wordCount(s.notes)} words)</span>
                      </div>
                      {isExpanded && (
                        <textarea
                          id={`notes-${s.id}`}
                          key={`notes-${s.id}-${s.notes ?? ''}`}
                          defaultValue={s.notes ?? ''}
                          onBlur={(e) => updateNotes(s, e.target.value)}
                          placeholder="Add notes (visible to everyone who can see this step, including the assigned technician)"
                          rows={2}
                          style={{ width: '100%', padding: '0.35rem', fontSize: '0.8125rem', border: '1px solid var(--border)', borderRadius: 4 }}
                        />
                      )}
                    </>
                  )
                })()}
              </div>
              {/* Notes for Office - dev/master/assistant/superintendent */}
              {canSeePrivateNotesAndApprove && (
                <div style={{ marginBottom: 4 }}>
                  {(() => {
                    const key = `${s.id}-privateNotes`
                    const defaultExpanded = isSectionDefaultExpanded(s, 'privateNotes')
                    const isExpanded = sectionExpanded[key] ?? defaultExpanded
                    return (
                      <>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setSectionExpanded((p) => ({ ...p, [key]: !isExpanded }))}
                          onKeyDown={(e) => e.key === 'Enter' && setSectionExpanded((p) => ({ ...p, [key]: !isExpanded }))}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 2, fontWeight: 500, color: 'var(--text-sky-700)', cursor: 'pointer', fontSize: '0.8125rem' }}
                        >
                          <span style={{ fontSize: '0.75rem', minWidth: 16, color: 'var(--text-strong)' }}>{isExpanded ? '\u25BC' : '\u25B6'}</span>
                          <span>Notes for Office ({wordCount(s.private_notes)} words)</span>
                        </div>
                        {isExpanded && (
                          <textarea
                            id={`private-notes-${s.id}`}
                            key={`private-notes-${s.id}-${s.private_notes ?? ''}`}
                            defaultValue={s.private_notes ?? ''}
                            onBlur={(e) => updatePrivateNotes(s, e.target.value)}
                            placeholder="Add private notes visible to masters, assistants, and superintendents..."
                            rows={2}
                            style={{ width: '100%', padding: '0.35rem', fontSize: '0.8125rem', border: '1px solid var(--border-sky)', borderRadius: 4, background: 'var(--surface)' }}
                          />
                        )}
                      </>
                    )
                  })()}
                </div>
              )}
              
              {/* Money drawer (v2.1194) - dev/master: this step's anchored projections + actual items */}
              {isDevOrMaster && (() => {
                const key = `${s.id}-money`
                const isExpanded = sectionExpanded[key] ?? false
                const beforeProjs = (moneyFlow.beforeByStep[s.id] ?? []).map((m) => m.projection)
                const afterProjs = (moneyFlow.afterByStep[s.id] ?? []).map((m) => m.projection)
                const projectedTotal = moneyFlow.stepProjectedTotal[s.id] ?? 0
                const itemsTotal = itemsTotalByStepId[s.id] ?? 0
                return (
                  <div style={{ marginBottom: 4 }}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSectionExpanded((p) => ({ ...p, [key]: !isExpanded }))}
                      onKeyDown={(e) => e.key === 'Enter' && setSectionExpanded((p) => ({ ...p, [key]: !isExpanded }))}
                      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 2, cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem' }}>
                        <span style={{ fontSize: '0.75rem', minWidth: 16 }}>{isExpanded ? '▼' : '▶'}</span>
                        <span style={{ fontWeight: 500, color: 'var(--text-green-700)' }}>
                          Money
                          {projectedTotal !== 0 && <> · {formatAmount(projectedTotal)} projected</>}
                          {itemsTotal !== 0 && <> · {formatAmount(itemsTotal)} items</>}
                        </span>
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{ fontSize: '0.8125rem', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {beforeProjs.length === 0 && afterProjs.length === 0 && (
                          <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No projections attached to this step.</div>
                        )}
                        {[...beforeProjs.map((p) => ({ p, tag: 'before' })), ...afterProjs.map((p) => ({ p, tag: 'after' }))].map(({ p, tag }) => (
                          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ color: 'var(--text-muted)', width: 42, flexShrink: 0 }}>{tag}</span>
                            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.memo}</span>
                            <span style={{ fontWeight: 600, color: 'var(--text-green-700)', whiteSpace: 'nowrap' }}>{formatAmount(p.amount)}</span>
                            <button type="button" onClick={() => openEditProjection(p)} className="wf-btn-ghost" style={{ fontSize: '0.75rem' }}>Edit</button>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', borderTop: '1px dashed var(--border)', paddingTop: 4, color: 'var(--text-muted)' }}>
                          <span>Line items (actual)</span>
                          <span>{formatAmount(itemsTotal)}</span>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => openEditProjection(null, { step_id: s.id, placement: 'after' })}
                            className="wf-btn-ghost"
                            style={{ fontSize: '0.75rem' }}
                          >
                            + Add projection here
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Sub work orders (step commitments) - RUN_SUBS_PLAN PR 2.2 */}
              {canManageStages && (
                <StepCommitmentPanel
                  stepId={s.id}
                  stepStatus={s.status}
                  stepName={s.name}
                  stepScheduledStart={s.scheduled_start_date}
                  stepScheduledEnd={s.scheduled_end_date}
                  projectId={project.id}
                  projectName={project.name}
                  offeredByName={currentUserName ?? 'The office'}
                  commitments={commitmentsByStep[s.id] ?? []}
                  paymentsByLaborJobId={commitmentPaymentsByLaborJobId}
                  roster={roster.filter((r): r is { name: string; personId: string } => !!r.personId)}
                  isSuperintendentOnly={userRole === 'superintendent'}
                  onChanged={() => void loadCommitmentsForSteps(steps.map((st) => st.id))}
                  onError={(m) => setError(m)}
                />
              )}

              {/* Line Items For Office - dev/master/assistant */}
              {canManageStages && (
                <div style={{ marginBottom: 4 }}>
                  {(() => {
                    const key = `${s.id}-lineItems`
                    const defaultExpanded = isSectionDefaultExpanded(s, 'lineItems')
                    const stored = sectionExpanded[key]
                    const isExpanded = stored ?? defaultExpanded
                    return (
                      <>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setSectionExpanded((p) => ({ ...p, [key]: !isExpanded }))}
                          onKeyDown={(e) => e.key === 'Enter' && setSectionExpanded((p) => ({ ...p, [key]: !isExpanded }))}
                          style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 2, cursor: 'pointer' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem' }}>
                            <span style={{ fontSize: '0.75rem', minWidth: 16 }}>{isExpanded ? '\u25BC' : '\u25B6'}</span>
                            <span style={{ fontWeight: 500, color: 'var(--text-sky-700)' }}>
                              Line Items For Office
                              {!isExpanded && (
                                <> | {formatAmount((lineItems[s.id] || []).reduce((sum, item) => sum + (item.amount || 0), 0))}</>
                              )}
                            </span>
                          </div>
                        </div>
                        {isExpanded && (
                          <>
                  {(lineItems[s.id] && lineItems[s.id]!.length > 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <div style={{ fontSize: '0.8125rem', background: 'var(--surface)', border: '1px solid var(--border-sky)', borderRadius: 4, overflow: 'hidden', width: 'fit-content' }} onClick={(e) => e.stopPropagation()}>
                      <table style={{ borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem', fontWeight: 600, borderBottom: '1px solid var(--border-sky)' }}>Memo</th>
                            <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem', fontWeight: 600, borderBottom: '1px solid var(--border-sky)', whiteSpace: 'nowrap' }}>Date</th>
                            <th style={{ textAlign: 'right', padding: '0.35rem 0.5rem', fontWeight: 600, borderBottom: '1px solid var(--border-sky)' }}>Amount</th>
                            <th style={{ width: 1, padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border-sky)' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems[s.id]!.map((item, idx) => {
                            const isLast = idx === lineItems[s.id]!.length - 1
                            const rowBorder = isLast ? 'none' : '1px solid var(--border-sky)'
                            return (
                            <tr key={item.id}>
                              <td style={{ padding: '0.35rem 0.5rem', borderBottom: rowBorder, verticalAlign: 'middle' }}>
                                {item.link && item.link.trim() && normalizeUrl(item.link) ? (
                                  <a
                                    href={normalizeUrl(item.link)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ color: 'var(--text-link)', textDecoration: 'underline' }}
                                    title={item.link}
                                  >
                                    {item.memo}
                                  </a>
                                ) : (
                                  <span>{item.memo}</span>
                                )}
                              </td>
                              <td style={{ padding: '0.35rem 0.5rem', borderBottom: rowBorder, verticalAlign: 'middle', fontSize: '0.8125rem', color: 'var(--text-600)', whiteSpace: 'nowrap' }}>
                                {formatLineItemDate(item.item_date)}
                              </td>
                              <td style={{ padding: '0.35rem 0.5rem', borderBottom: rowBorder, textAlign: 'right', color: (item.amount || 0) < 0 ? 'var(--text-red-700)' : 'var(--text-700)', fontWeight: 500, verticalAlign: 'middle' }}>
                                {formatAmount(item.amount)}
                              </td>
                              <td style={{ padding: '0.35rem 0.5rem', borderBottom: rowBorder, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', gap: '0.2rem', justifyContent: 'flex-end' }}>
                                  {item.purchase_order_id && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); loadPODetails(item.purchase_order_id!) }}
                                      className="wf-btn-secondary wf-btn-secondary-blue"
                                    >
                                      View PO
                                    </button>
                                  )}
                                  {item.supply_house_invoice_id && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); loadInvoiceDetails(item.supply_house_invoice_id!) }}
                                      className="wf-btn-secondary wf-btn-secondary-blue"
                                    >
                                      View Invoice
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); openEditLineItem(s.id, item) }}
                                    title="Edit"
                                    aria-label="Edit"
                                    style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-700)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                      <path d="M535.6 85.7C513.7 63.8 478.3 63.8 456.4 85.7L432 110.1L529.9 208L554.3 183.6C576.2 161.7 576.2 126.3 554.3 104.4L535.6 85.7zM236.4 305.7C230.3 311.8 225.6 319.3 222.9 327.6L193.3 416.4C190.4 425 192.7 434.5 199.1 441C205.5 447.5 215 449.7 223.7 446.8L312.5 417.2C320.7 414.5 328.2 409.8 334.4 403.7L496 241.9L398.1 144L236.4 305.7zM160 128C107 128 64 171 64 224L64 480C64 533 107 576 160 576L416 576C469 576 512 533 512 480L512 384C512 366.3 497.7 352 480 352C462.3 352 448 366.3 448 384L448 480C448 497.7 433.7 512 416 512L160 512C142.3 512 128 497.7 128 480L128 224C128 206.3 142.3 192 160 192L256 192C273.7 192 288 177.7 288 160C288 142.3 273.7 128 256 128L160 128z"/>
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteLineItem({ item, stepName: s.name }) }}
                                    title="Delete"
                                    aria-label="Delete"
                                    style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-red-800)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                      <path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z"/>
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )})}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-amber-800)', margin: 0, fontStyle: 'italic', textAlign: 'center' }}>No line items yet. Click "Add Line Item" to add one.</p>
                  ))}
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => openEditLineItem(s.id, null)}
                                className="wf-btn-success-soft"
                              >
                                + Add Line Item
                              </button>
                              {availableInvoices.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setAddingInvoiceToStep(s.id)}
                                  className="wf-btn-success-soft"
                                >
                                  + Add Supply House Invoice
                                </button>
                              )}
                              {availablePOs.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setAddingPOToStep(s.id)}
                                  className="wf-btn-success-soft"
                                >
                                  + Add PO
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                {canManageStages && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => openEditStep(s)} className="wf-btn-ghost">Edit</button>
                    <button type="button" onClick={() => { setConfirmDeleteStep(s); setDeleteStepConfirmText('') }} className="wf-btn-danger">Delete</button>
                  </div>
                )}
                {(s.status === 'completed' || s.status === 'approved' || s.status === 'rejected' || s.status === 'skipped') && canManageStages && (
                  <button type="button" onClick={() => markReopened(s)} className="wf-btn-ghost">
                    Re-open
                  </button>
                )}
              </div>
              </>
              )}
                  </>
                )
              })()}
            </div>
            ), isCollapsed)}
            {(moneyFlow.afterByStep[s.id] ?? []).map((m) =>
              railRow(m.runningProjected - m.runningSpent, renderMoneyMarker(m), true, `rail-${m.projection.id}`),
            )}
            {index < displayItems.length - 1 &&
              railRow(null, <div style={{ textAlign: 'center', marginBottom: '0.15rem', color: 'var(--text-faint)' }}>{"\u2193"}</div>)}
          </div>
          )
        })}
        </>)
      })()
      }
    </div>
  )
}
