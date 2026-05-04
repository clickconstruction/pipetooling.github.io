import { memo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { Database } from '../../types/database'
import { formatMercuryKind } from '../../lib/mercuryKindLabels'
import { shortUuidPrefix } from '../../lib/shortUuidPrefix'
import {
  formatMercuryDebitCardIdCompact,
  mercuryDebitCardIdFromRaw,
} from '../../lib/mercuryRawDebitCard'
import type { MercuryJobSplit } from '../MercuryTransactionAllocationsModal'
import {
  MercuryTxNotesEditorPanel,
  MercuryTxNotesReadOnlyPreview,
  mercuryTxNotesPanelDomId,
  mercuryTxNotesPreviewDomId,
  mercuryTxNotesSubRowInnerStyle,
  mercuryTxNotesSubRowTdStyle,
  mercuryTxNotesToggleDomId,
  mercuryTxPipeLineAriaLabel,
  mercuryTxCombinedNoteInlineText,
} from './MercuryTxNotesDisclosure'

export { mercuryTxPipeLineAriaLabel, mercuryTxCombinedNoteInlineText }

export type MercuryTxRowBankingLedger = Database['public']['Tables']['mercury_transactions']['Row']

/** Posted + Amount columns before Counterparty — notes sub-row content aligns with Counterparty */
export const BANKING_DRAG_SORT_NOTES_BEFORE_COUNTERPARTY_COLS = 2

export function bankingMercuryDragSortLedgerColCount(showDragHandle: boolean): number {
  return showDragHandle ? 6 : 5
}

export function bankingMercuryDragSortLedgerNotesContentColspan(showDragHandle: boolean): number {
  return bankingMercuryDragSortLedgerColCount(showDragHandle) - BANKING_DRAG_SORT_NOTES_BEFORE_COUNTERPARTY_COLS
}

/** Drag Sort row handle: yellow field, black ⋮⋮ (matches instructional chip). */
export const BANKING_DRAG_SORT_HANDLE_YELLOW = '#fde047'
export const BANKING_DRAG_SORT_HANDLE_YELLOW_DRAGGING = '#facc15'
export const BANKING_DRAG_SORT_HANDLE_BORDER = '#ca8a04'
export const BANKING_DRAG_SORT_HANDLE_DOTS = '#0f172a'
export const BANKING_DRAG_SORT_HANDLE_GRIP_FONT_SIZE = '1.2rem'
export const BANKING_DRAG_SORT_HANDLE_GRIP_FONT_WEIGHT = 900

export function formatBankingDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export function formatUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function dragSortJobPrimaryLine(
  allocs: MercuryJobSplit[],
  jobLabelById: Record<string, string>,
): { text: string; muted: boolean; detailTitle?: string } {
  if (allocs.length === 0) return { text: '-', muted: true }
  if (allocs.length === 1) {
    const one = allocs[0]
    if (one == null) return { text: '-', muted: true }
    const id = one.job_id
    return { text: jobLabelById[id] ?? shortUuidPrefix(id), muted: false }
  }
  const total = allocs.reduce((s, a) => s + Math.abs(Number(a.amount)), 0)
  const detailTitle = allocs.map((a) => jobLabelById[a.job_id] ?? shortUuidPrefix(a.job_id)).join('; ')
  return {
    text: `${allocs.length} jobs · ${formatUsd(total)}`,
    muted: false,
    detailTitle,
  }
}

export function dragSortPersonSubline(
  txId: string,
  personIdByTxId: Map<string, string | null>,
  userIdByTxId: Map<string, string | null>,
  personNameById: Record<string, string>,
  userNameById: Record<string, string>,
): { text: string; unassigned: boolean } {
  const uid = userIdByTxId.get(txId) ?? null
  const pid = personIdByTxId.get(txId) ?? null
  if (uid) {
    return { text: userNameById[uid] ?? shortUuidPrefix(uid), unassigned: false }
  }
  if (pid) {
    return { text: personNameById[pid] ?? shortUuidPrefix(pid), unassigned: false }
  }
  return { text: '-', unassigned: true }
}

export function BankingMercuryDragSortDragHandle({ txId }: { txId: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: txId })
  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-label="Drag to assign an Accounting Label"
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        boxSizing: 'border-box',
        lineHeight: 0,
        padding: '2px 4px',
        minWidth: 0,
        border: `1px solid ${BANKING_DRAG_SORT_HANDLE_BORDER}`,
        background: isDragging ? BANKING_DRAG_SORT_HANDLE_YELLOW_DRAGGING : BANKING_DRAG_SORT_HANDLE_YELLOW,
        cursor: isDragging ? 'grabbing' : 'grab',
        borderRadius: 3,
        touchAction: 'none',
        opacity: isDragging ? 0 : 1,
        position: 'relative' as const,
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'block',
          color: BANKING_DRAG_SORT_HANDLE_DOTS,
          lineHeight: 1,
          fontSize: BANKING_DRAG_SORT_HANDLE_GRIP_FONT_SIZE,
          fontWeight: BANKING_DRAG_SORT_HANDLE_GRIP_FONT_WEIGHT,
          letterSpacing: '-0.03em',
          textAlign: 'center',
          transform: 'translate(-0.03em, -0.02em)',
        }}
      >
        ⋮⋮
      </span>
    </button>
  )
}

export const BankingMercuryDragSortLedgerRow = memo(function BankingMercuryDragSortLedgerRow({
  row,
  jobLineText,
  jobLineMuted,
  jobLineTitle,
  jobLineIsNotSplit,
  personLineText,
  personUnassigned,
  assignId,
  assignName,
  labelDetailTitle,
  nicknameByDebitCard,
  onRemoveLabel,
  onEditAllocations,
  notesOpen,
  onNotesToggle,
  suppressBottomDivider,
  showDragHandle,
}: {
  row: MercuryTxRowBankingLedger
  jobLineText: string
  jobLineMuted: boolean
  jobLineTitle?: string
  jobLineIsNotSplit: boolean
  personLineText: string
  personUnassigned: boolean
  assignId: string | undefined
  assignName: string
  labelDetailTitle: string | undefined
  nicknameByDebitCard: Record<string, string>
  onRemoveLabel: (txId: string) => void
  onEditAllocations?: (r: MercuryTxRowBankingLedger) => void
  notesOpen: boolean
  onNotesToggle: () => void
  suppressBottomDivider: boolean
  showDragHandle: boolean
}) {
  const debitCardId = mercuryDebitCardIdFromRaw(row.raw)
  const ledgerPad = suppressBottomDivider ? '0.5rem 0.75rem 0 0.75rem' : '0.5rem 0.75rem'
  const ledgerHandlePad = suppressBottomDivider ? '0.35rem 0.2rem 0 0.2rem' : '0.35rem 0.2rem'
  return (
    <tr style={{ borderBottom: suppressBottomDivider ? 'none' : '1px solid #e5e7eb' }}>
      <td style={{ padding: ledgerPad }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span>{formatBankingDate(row.posted_at)}</span>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{formatMercuryKind(row.kind)}</span>
        </div>
      </td>
      <td style={{ padding: ledgerPad, verticalAlign: 'top' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          <span>{formatUsd(Number(row.amount))}</span>
          <button
            type="button"
            id={mercuryTxNotesToggleDomId(row.id)}
            aria-expanded={notesOpen}
            aria-controls={mercuryTxNotesPanelDomId(row.id)}
            onClick={(e) => {
              e.stopPropagation()
              onNotesToggle()
            }}
            style={{
              padding: '2px 0',
              margin: 0,
              fontSize: '0.72rem',
              fontWeight: 600,
              color: '#94a3b8',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              textDecoration: 'underline',
              whiteSpace: 'nowrap',
            }}
          >
            {notesOpen ? 'Hide edit' : 'Edit note'}
          </button>
        </div>
      </td>
      <td style={{ padding: ledgerPad, maxWidth: 200 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span>{row.counterparty_name ?? '—'}</span>
          {debitCardId ? (
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
              Card: {nicknameByDebitCard[debitCardId] ?? formatMercuryDebitCardIdCompact(debitCardId)}
            </span>
          ) : null}
        </div>
      </td>
      <td style={{ padding: ledgerPad, maxWidth: 220, verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          {jobLineIsNotSplit && onEditAllocations ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEditAllocations(row)
              }}
              aria-label="Link jobs to this transaction"
              title="Link jobs to this transaction"
              style={{
                alignSelf: 'stretch',
                maxWidth: '100%',
                margin: 0,
                padding: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                font: 'inherit',
                textAlign: 'left',
                color: '#9ca3af',
                fontWeight: 400,
                textDecoration: 'none',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {jobLineText}
            </button>
          ) : (
            <span
              style={{
                color: jobLineMuted ? '#9ca3af' : '#0f172a',
                fontWeight: jobLineMuted ? 400 : 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={jobLineTitle ?? (jobLineMuted ? undefined : jobLineText)}
            >
              {jobLineText}
            </span>
          )}
          {personUnassigned && onEditAllocations ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEditAllocations(row)
              }}
              aria-label="Link person and jobs to this transaction"
              title="Link person and jobs to this transaction"
              style={{
                alignSelf: 'stretch',
                maxWidth: '100%',
                margin: 0,
                padding: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                font: 'inherit',
                textAlign: 'left',
                fontSize: '0.72rem',
                color: '#94a3b8',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {personLineText}
            </button>
          ) : (
            <span
              style={{
                fontSize: '0.72rem',
                color: personUnassigned ? '#94a3b8' : '#64748b',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={personLineText}
            >
              {personLineText}
            </span>
          )}
        </div>
      </td>
      <td style={{ padding: ledgerPad, verticalAlign: 'middle' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 8,
            minWidth: 0,
          }}
        >
          {assignId ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRemoveLabel(row.id)
              }}
              aria-label="Remove Accounting Label from this transaction"
              title="Remove Accounting Label"
              style={{
                flexShrink: 0,
                padding: '2px 4px',
                fontSize: '0.85rem',
                lineHeight: 1,
                fontWeight: 600,
                color: '#b91c1c',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <span aria-hidden>×</span>
            </button>
          ) : null}
          <span
            style={{
              flex: '1 1 auto',
              minWidth: 0,
              fontSize: '0.8125rem',
              color: assignId ? '#0f172a' : '#9ca3af',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={labelDetailTitle}
          >
            {assignName}
          </span>
        </div>
      </td>
      {showDragHandle ? (
        <td style={{ padding: ledgerHandlePad, verticalAlign: 'middle', textAlign: 'center' }}>
          <BankingMercuryDragSortDragHandle txId={row.id} />
        </td>
      ) : null}
    </tr>
  )
})

export function BankingMercuryDragSortLedgerThead({ showDragHandle }: { showDragHandle: boolean }) {
  return (
    <thead>
      <tr style={{ background: '#f9fafb' }}>
        <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>Posted</th>
        <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>Amount</th>
        <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>Counterparty</th>
        <th
          style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}
          title="Job allocations and linked person"
        >
          Job
        </th>
        <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>
          Accounting Label
        </th>
        {showDragHandle ? (
          <th
            style={{
              width: '1%',
              whiteSpace: 'nowrap',
              padding: '0.5rem 0.2rem',
              borderBottom: '1px solid #e5e7eb',
            }}
            aria-label="Drag"
          />
        ) : null}
      </tr>
    </thead>
  )
}

type MercuryTxNotesBankingRow = Parameters<typeof MercuryTxNotesReadOnlyPreview>[0]['row']

export function BankingMercuryDragSortLedgerNotesPreviewRow({
  row,
  orgNoteBody,
  bankDescriptionText,
  dragSortPipeAriaLabel,
  showDragHandle,
}: {
  row: MercuryTxNotesBankingRow
  orgNoteBody: string
  bankDescriptionText: string | null
  dragSortPipeAriaLabel: string
  showDragHandle: boolean
}) {
  const subColspan = bankingMercuryDragSortLedgerNotesContentColspan(showDragHandle)
  return (
    <tr>
      <td
        colSpan={BANKING_DRAG_SORT_NOTES_BEFORE_COUNTERPARTY_COLS}
        aria-hidden
        style={mercuryTxNotesSubRowTdStyle}
        onClick={(e) => e.stopPropagation()}
      />
      <td
        colSpan={subColspan}
        id={mercuryTxNotesPreviewDomId(row.id)}
        role="region"
        aria-label={dragSortPipeAriaLabel}
        style={mercuryTxNotesSubRowTdStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={mercuryTxNotesSubRowInnerStyle}>
          <MercuryTxNotesReadOnlyPreview
            row={row}
            orgBody={orgNoteBody}
            notePreviewVariant="dragSortPipe"
            dragSortBankDescription={bankDescriptionText}
          />
        </div>
      </td>
    </tr>
  )
}

export function BankingMercuryDragSortLedgerNotesEditorRow({
  row,
  orgNoteBody,
  onOrgNoteUpdated,
  onSaveSuccess,
  onCloseRequest,
  bankDescriptionText,
  showDragHandle,
}: {
  row: MercuryTxNotesBankingRow
  orgNoteBody: string
  onOrgNoteUpdated: (txId: string, body: string) => void
  onSaveSuccess: () => void
  onCloseRequest: () => void
  bankDescriptionText: string | null
  showDragHandle: boolean
}) {
  const subColspan = bankingMercuryDragSortLedgerNotesContentColspan(showDragHandle)
  return (
    <tr>
      <td
        colSpan={BANKING_DRAG_SORT_NOTES_BEFORE_COUNTERPARTY_COLS}
        aria-hidden
        style={mercuryTxNotesSubRowTdStyle}
        onClick={(e) => e.stopPropagation()}
      />
      <td
        colSpan={subColspan}
        id={mercuryTxNotesPanelDomId(row.id)}
        role="region"
        aria-labelledby={mercuryTxNotesToggleDomId(row.id)}
        style={mercuryTxNotesSubRowTdStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={mercuryTxNotesSubRowInnerStyle}>
          <MercuryTxNotesEditorPanel
            row={row}
            orgBody={orgNoteBody}
            onOrgNoteUpdated={onOrgNoteUpdated}
            onSaveSuccess={onSaveSuccess}
            onCloseRequest={onCloseRequest}
            notePanelVariant="dragSortPipe"
            dragSortBankDescription={bankDescriptionText}
          />
        </div>
      </td>
    </tr>
  )
}
