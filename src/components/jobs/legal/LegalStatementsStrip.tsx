import type { CSSProperties } from 'react'
import { calendarYmdInAppTzFromIso } from '../../../utils/dateUtils'
import type { LegalEntryRow } from '../../../lib/legal/legalMatters'
import { incidentSpanWords, isStatementEntry, statementByWords, statementChipWords, statementKindWords, statementMetaOf, statementStateWords } from '../../../lib/legal/affidavitPaper'
import { EmptyState } from '../../EmptyState'
import { btn, MUTED, pill } from './legalDeskShared'

/**
 * Sworn statements on the Evidence tab (punch list #220, v2.6210): the strip above *Documents for the firm* where
 * the office swears a statement and finds the ones in flight — a draft to open and print, a signed one with its scan.
 * The scan itself lands in the documents list below as a row of its own; this strip is the statement's door, so a
 * draft never pretends to be a document. The Timeline's Said lane draws the same rows on their days.
 */
export type StatementsStripActs = {
  /** Open the window on a new statement. */
  swear: () => void
  /** Open the window on this statement. */
  open: (entryId: string) => void
  /** Open the window on its print sheet (v2.6211). */
  print?: (entryId: string) => void
  /** Open the signed copy (PR 5), when filed. */
  openDocument?: (documentId: string) => Promise<void>
}

type Row = Pick<LegalEntryRow, 'id' | 'kind' | 'body' | 'occurred_on' | 'meta' | 'voided_at' | 'void_reason'>

const row: CSSProperties = { display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: 10, alignItems: 'center', padding: '6px 0', borderTop: '1px dotted var(--border)', fontSize: '0.8rem' }

export default function LegalStatementsStrip({ entries, todayYmd, canEdit, acts }: { entries: ReadonlyArray<Row>; todayYmd: string; canEdit: boolean; acts: StatementsStripActs | null }) {
  const statements = entries.filter((e) => isStatementEntry(e) && !e.voided_at).map((e) => ({ e, meta: statementMetaOf(e.meta) })).sort((a, b) => b.e.occurred_on.localeCompare(a.e.occurred_on))
  const drafts = statements.filter((s) => s.meta.state !== 'signed').length
  const signed = statements.length - drafts
  return (
    <div data-legal-statements style={{ margin: '0 0 14px', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, display: 'grid', gap: 4 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ fontSize: '0.86rem' }}>Sworn statements</b>
        {statements.length ? <span style={{ ...MUTED, fontSize: '0.78rem' }}>{[drafts ? `${drafts} draft${drafts === 1 ? '' : 's'}` : '', signed ? `${signed} signed` : ''].filter(Boolean).join(' · ')}</span> : null}
        {/* With nothing sworn the empty words carry the one press, so the door is not drawn twice. */}
        {canEdit && acts && statements.length ? <button type="button" data-legal-swear-door onClick={acts.swear} style={{ ...btn, marginLeft: 'auto' }}>Swear a statement…</button> : null}
      </div>
      {statements.length === 0 ? (
        <EmptyState compact main="Nothing sworn on this account yet." {...(canEdit && acts ? { next: { label: 'Swear a statement…', onPress: acts.swear }, tail: 'drafts one: who swears it, the day it is about, how it is signed.' } : null)} />
      ) : statements.map(({ e, meta }) => {
        const { state, words } = statementStateWords(meta, { todayYmd, voided: false, voidReason: '', dayOfIso: calendarYmdInAppTzFromIso })
        const tone = state === 'happened' ? 'ok' : state === 'stale' ? 'warn' : 'neutral'
        return (
          <div key={e.id} data-legal-statement={e.id} data-legal-statement-state={meta.state} style={row}>
            <span>{pill(statementChipWords(meta, calendarYmdInAppTzFromIso), tone)}</span>
            <span style={{ display: 'grid', minWidth: 0 }}>
              <span style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', minWidth: 0 }}>
                <b style={{ overflowWrap: 'anywhere' }}>{meta.title || 'Statement'}</b>
                <span style={{ ...MUTED, fontSize: '0.74rem' }}>{statementKindWords(meta)} · {statementByWords(meta.affiant)} · about {incidentSpanWords(e.occurred_on, meta.incidentTo)}</span>
              </span>
              <span data-legal-statement-words style={{ fontSize: '0.74rem', color: state === 'stale' ? 'var(--text-amber-700)' : state === 'happened' ? 'var(--text-green-700)' : 'var(--text-muted)' }}>{words}</span>
            </span>
            <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {acts ? <button type="button" onClick={() => acts.open(e.id)} style={btn}>{meta.state === 'signed' ? 'Open' : 'Open the draft'}</button> : null}
              {acts?.print ? <button type="button" data-legal-statement-print onClick={() => acts.print!(e.id)} style={btn} title="The paper as it prints">Print</button> : null}
              {acts?.openDocument && meta.documentId ? <button type="button" onClick={() => void acts.openDocument!(meta.documentId!)} style={btn} title="Opens the signed scan in a new browser tab">Open the signed copy</button> : null}
            </span>
          </div>
        )
      })}
    </div>
  )
}
