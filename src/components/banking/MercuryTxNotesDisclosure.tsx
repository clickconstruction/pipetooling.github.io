import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import type { MercuryTxRow } from '../../lib/bankingMercurySearch'

const MERCURY_ORG_NOTE_MAX = 2000

const readOnlyBox: CSSProperties = {
  marginTop: 4,
  padding: '8px 10px',
  fontSize: '0.8125rem',
  color: 'var(--text-700)',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  maxHeight: '12rem',
  overflow: 'auto',
}

/** Tighter chrome for inline preview row only (editor panel keeps `readOnlyBox`). */
const readOnlyBoxPreview: CSSProperties = {
  ...readOnlyBox,
  marginTop: 2,
  padding: '6px 8px',
}

const labelStyle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: 2,
}

const labelStylePreview: CSSProperties = {
  ...labelStyle,
  marginBottom: 1,
}

/** Full-width note sub-row `<td>` (Ledger / Drag Sort); transparent to match parent row; rule under band. */
export const mercuryTxNotesSubRowTdStyle: CSSProperties = {
  padding: 0,
  borderBottom: '1px solid var(--border)',
  background: 'transparent',
}

/** Inner wrapper: padding aligned with Counterparty grid (no heuristic left gutter). */
export const mercuryTxNotesSubRowInnerStyle: CSSProperties = {
  padding: '0 0.75rem 0.125rem 0.75rem',
}

export function mercuryTxNotesPanelDomId(txId: string): string {
  return `mercury-tx-notes-panel-${txId}`
}

export function mercuryTxNotesPreviewDomId(txId: string): string {
  return `mercury-tx-notes-preview-${txId}`
}

export function mercuryTxNotesToggleDomId(txId: string): string {
  return `mercury-tx-notes-toggle-${txId}`
}

export function mercuryTxHasNotePreview(row: MercuryTxRow, orgBody: string): boolean {
  const m = (row.note ?? '').trim()
  const x = (row.external_memo ?? '').trim()
  const o = orgBody.trim()
  return m !== '' || x !== '' || o !== ''
}

/** Drag Sort: show bank | note preview row when either bank text exists or synced/org notes exist. */
export function mercuryTxDragSortBankNoteRowVisible(
  row: MercuryTxRow,
  orgBody: string,
  bankDescription: string | null | undefined,
): boolean {
  const bankTrim = typeof bankDescription === 'string' ? bankDescription.trim() : ''
  if (bankTrim !== '') return true
  return mercuryTxHasNotePreview(row, orgBody)
}

export type MercuryTxNotesChromeVariant = 'default' | 'dragSortPipe'

function singleLineSnippet(s: string): string {
  return s.replace(/\r\n|\r|\n/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Mercury note + external memo + org, single line for Drag Sort pipe. */
export function mercuryTxCombinedNoteInlineText(row: MercuryTxRow, orgBodyFragment: string): string {
  const mercuryNoteText = (row.note ?? '').trim()
  const externalMemoText = (row.external_memo ?? '').trim()
  const orgText = orgBodyFragment.trim()
  const parts = [mercuryNoteText, externalMemoText, orgText].map(singleLineSnippet).filter((p) => p.length > 0)
  return parts.join(' · ')
}

/** Spaced delimiter between bankDescription and combined note (Drag Sort pipe). */
const MERCURY_DRAG_SORT_PIPE_NOTE = '  |  note: '

export function mercuryTxPipeLineAriaLabel(bankTrim: string, combinedNote: string): string {
  const hasBank = bankTrim !== ''
  const hasNote = combinedNote !== ''
  if (hasBank && hasNote) return `${bankTrim}${MERCURY_DRAG_SORT_PIPE_NOTE}${combinedNote}`
  if (hasBank) return bankTrim
  if (hasNote) return `note: ${combinedNote}`
  return ''
}

const mercuryTxPipeLineBoxStyle: CSSProperties = {
  fontSize: '0.8125rem',
  margin: 0,
  maxHeight: '12rem',
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}

type MercuryTxNotesPipeLineBoxProps = {
  bankTrim: string
  combinedNoteText: string
}

function MercuryTxNotesPipeLineBox({ bankTrim, combinedNoteText }: MercuryTxNotesPipeLineBoxProps) {
  const hasBank = bankTrim !== ''
  const hasNote = combinedNoteText !== ''
  if (!hasBank && !hasNote) return null
  const labelMuted: CSSProperties = { fontWeight: 600, color: 'var(--text-muted)' }

  return (
    <div role="presentation" style={mercuryTxPipeLineBoxStyle}>
      {hasBank ? (
        <span style={{ color: 'var(--text-700)' }}>
          {bankTrim}
          {hasNote ? MERCURY_DRAG_SORT_PIPE_NOTE : null}
        </span>
      ) : null}
      {hasNote ? (
        <span style={{ color: 'var(--text-700)' }}>
          {!hasBank ? <span style={labelMuted}>note: </span> : null}
          {combinedNoteText}
        </span>
      ) : null}
    </div>
  )
}

type RowNoteTexts = {
  mercuryNoteText: string
  externalMemoText: string
  orgText: string
}

function readRowNoteTexts(row: MercuryTxRow, orgBody: string): RowNoteTexts {
  return {
    mercuryNoteText: (row.note ?? '').trim(),
    externalMemoText: (row.external_memo ?? '').trim(),
    orgText: orgBody.trim(),
  }
}

const notesInnerWrapStyle: CSSProperties = {
  maxWidth: 900,
}

const orgNotePreviewLineStyle: CSSProperties = {
  margin: 0,
  paddingLeft: '1.25rem',
  fontSize: '0.75rem',
  lineHeight: 1.35,
  color: 'var(--text-slate-500)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  minWidth: 0,
}

type PreviewProps = {
  row: MercuryTxRow
  orgBody: string
  /** When `dragSortPipe`, render single `bank: … | note: …` line (Banking Ledger / User Sort omit this). */
  notePreviewVariant?: MercuryTxNotesChromeVariant
  /** Mercury `bankDescription` from sync raw; only used when `notePreviewVariant` is `dragSortPipe`. */
  dragSortBankDescription?: string | null
}

/** Read-only Mercury / external / org text for the inline preview row (editor closed). */
export function MercuryTxNotesReadOnlyPreview({
  row,
  orgBody,
  notePreviewVariant = 'default',
  dragSortBankDescription = null,
}: PreviewProps) {
  if (notePreviewVariant === 'dragSortPipe') {
    const bankTrim = (dragSortBankDescription ?? '').trim()
    const combined = mercuryTxCombinedNoteInlineText(row, orgBody)
    if (!bankTrim && !combined) return null
    return (
      <div style={notesInnerWrapStyle} onClick={(e) => e.stopPropagation()}>
        <MercuryTxNotesPipeLineBox bankTrim={bankTrim} combinedNoteText={combined} />
      </div>
    )
  }

  const { mercuryNoteText, externalMemoText, orgText } = readRowNoteTexts(row, orgBody)
  const orgSingleLine = orgText.replace(/\r\n|\r|\n/g, ' ').replace(/\s+/g, ' ').trim()
  return (
    <div style={notesInnerWrapStyle} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {mercuryNoteText !== '' ? (
          <div>
            <div style={labelStylePreview}>Mercury note (from sync, read-only)</div>
            <div style={readOnlyBoxPreview}>{mercuryNoteText}</div>
          </div>
        ) : null}
        {externalMemoText !== '' ? (
          <div>
            <div style={labelStylePreview}>External memo (from sync, read-only)</div>
            <div style={readOnlyBoxPreview}>{externalMemoText}</div>
          </div>
        ) : null}
        {orgText !== '' ? (
          <div style={{ minWidth: 0, width: '100%', alignSelf: 'stretch' }}>
            <p style={orgNotePreviewLineStyle} title={orgText} aria-label="Transaction note">
              {orgSingleLine}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

type PanelProps = {
  row: MercuryTxRow
  orgBody: string
  onOrgNoteUpdated?: (txId: string, body: string) => void
  /** Called after Save succeeds so parent can close the editor (e.g. collapse notes sub-row). */
  onSaveSuccess?: () => void
  /** When the draft is empty, **Close** dismisses the editor without clearing server state. */
  onCloseRequest?: () => void
  notePanelVariant?: MercuryTxNotesChromeVariant
  dragSortBankDescription?: string | null
}

function syncOrgNoteTextareaHeight(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  const maxPxStr = getComputedStyle(el).maxHeight
  const maxPx = parseFloat(maxPxStr)
  const cap = Number.isFinite(maxPx) && maxPx > 0 ? maxPx : Infinity
  const sh = el.scrollHeight
  const next = Math.min(sh, cap)
  el.style.height = `${next}px`
  el.style.overflowY = sh > cap ? 'auto' : 'hidden'
}

/** Full-width editor row: Mercury / external read-only + org textarea (linked to toggle via `mercuryTxNotesPanelDomId`). */
export function MercuryTxNotesEditorPanel({
  row,
  orgBody,
  onOrgNoteUpdated,
  onSaveSuccess,
  onCloseRequest,
  notePanelVariant = 'default',
  dragSortBankDescription = null,
}: PanelProps) {
  const { showToast } = useToastContext()
  const orgTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [orgDraft, setOrgDraft] = useState(orgBody)
  const [orgSaving, setOrgSaving] = useState(false)

  useEffect(() => {
    setOrgDraft(orgBody)
  }, [orgBody])

  useLayoutEffect(() => {
    syncOrgNoteTextareaHeight(orgTextareaRef.current)
  }, [orgDraft])

  useEffect(() => {
    const el = orgTextareaRef.current
    if (!el || el.disabled) return
    el.focus()
    const len = el.value.length
    el.setSelectionRange(len, len)
    syncOrgNoteTextareaHeight(el)
  }, [])

  const saveOrg = useCallback(async () => {
    if (orgDraft.length > MERCURY_ORG_NOTE_MAX) {
      showToast(`Transaction note must be at most ${MERCURY_ORG_NOTE_MAX} characters.`, 'error')
      return
    }
    setOrgSaving(true)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.rpc('upsert_mercury_org_transaction_note', {
            p_mercury_transaction_id: row.id,
            p_body: orgDraft,
          }),
        'save mercury org note banking',
      )
      const trimmed = orgDraft.trim()
      onOrgNoteUpdated?.(row.id, trimmed)
      showToast(trimmed === '' ? 'Transaction note cleared.' : 'Transaction note saved.', 'success')
      onSaveSuccess?.()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save transaction note.', 'error')
    } finally {
      setOrgSaving(false)
    }
  }, [orgDraft, onOrgNoteUpdated, onSaveSuccess, row.id, showToast])

  const clearOrg = useCallback(async () => {
    setOrgSaving(true)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.rpc('upsert_mercury_org_transaction_note', {
            p_mercury_transaction_id: row.id,
            p_body: '',
          }),
        'clear mercury org note banking',
      )
      setOrgDraft('')
      onOrgNoteUpdated?.(row.id, '')
      showToast('Transaction note cleared.', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not clear transaction note.', 'error')
    } finally {
      setOrgSaving(false)
    }
  }, [onOrgNoteUpdated, row.id, showToast])

  const { mercuryNoteText, externalMemoText } = readRowNoteTexts(row, orgBody)
  const draftEmpty = orgDraft.trim() === ''
  const bankTrimPipe = (dragSortBankDescription ?? '').trim()
  const combinedDraftNotePipe = mercuryTxCombinedNoteInlineText(row, orgDraft)

  return (
    <div style={notesInnerWrapStyle} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {notePanelVariant === 'dragSortPipe' ? (
          <MercuryTxNotesPipeLineBox bankTrim={bankTrimPipe} combinedNoteText={combinedDraftNotePipe} />
        ) : null}
        {mercuryNoteText !== '' ? (
          <div>
            <div style={labelStyle}>Mercury note (from sync, read-only)</div>
            <div style={readOnlyBox}>{mercuryNoteText}</div>
          </div>
        ) : null}
        {externalMemoText !== '' ? (
          <div>
            <div style={labelStyle}>External memo (from sync, read-only)</div>
            <div style={readOnlyBox}>{externalMemoText}</div>
          </div>
        ) : null}
        <div>
          <textarea
            ref={orgTextareaRef}
            value={orgDraft}
            onChange={(e) => setOrgDraft(e.target.value)}
            maxLength={MERCURY_ORG_NOTE_MAX}
            rows={1}
            disabled={orgSaving}
            aria-label="Transaction note for this Mercury row"
            placeholder="Transaction note…"
            style={{
              width: '100%',
              minWidth: 0,
              boxSizing: 'border-box',
              padding: '8px 10px',
              fontSize: '0.8125rem',
              lineHeight: 1.35,
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              resize: 'none',
              maxHeight: '12rem',
              overflowWrap: 'break-word',
              fontFamily: 'inherit',
            }}
          />
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 8,
              justifyContent: 'flex-end',
            }}
          >
            <button
              type="button"
              disabled={orgSaving}
              onClick={(e) => {
                e.stopPropagation()
                void saveOrg()
              }}
              style={{
                padding: '5px 12px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                borderRadius: 4,
                border: '1px solid #1d4ed8',
                background: '#2563eb',
                color: '#fff',
                cursor: orgSaving ? 'not-allowed' : 'pointer',
              }}
            >
              Save
            </button>
            <button
              type="button"
              disabled={orgSaving}
              aria-label={draftEmpty ? 'Close transaction note editor' : 'Clear transaction note'}
              onClick={(e) => {
                e.stopPropagation()
                if (draftEmpty) {
                  onCloseRequest?.()
                } else {
                  void clearOrg()
                }
              }}
              style={{
                padding: '5px 12px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                borderRadius: 4,
                border: '1px solid var(--border-strong)',
                background: 'var(--surface)',
                color: 'var(--text-700)',
                cursor: orgSaving ? 'not-allowed' : 'pointer',
              }}
            >
              {draftEmpty ? 'Close' : 'Clear'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const MercuryTxNotesPanelBody = MercuryTxNotesEditorPanel
