import { LeaveQuestion } from '../bids/SubmittalLeaveGuard'
import type { ProspectKind } from '../../lib/prospects/prospectKinds'
import type { Prospect } from '../../lib/prospects/prospectRow'
import type { StripRead } from '../../lib/prospects/stripState'
import { renderKindFields } from './ProspectKindFields'
import { ProspectPersonForm } from './ProspectPersonForm'
import type { EditProspectWindowState } from './useEditProspectWindow'

/**
 * Edit Prospect: the person and company blocks, the kind's boxes, Delete, and the warmth presses when it edits
 * the deck's card. Its JSX moved out of `src/pages/Prospects.tsx` unchanged; `useEditProspectWindow`, which the
 * page calls, holds what it edits and its writes. The page mounts it while it is open on a prospect.
 */
export function EditProspectWindow({
  win,
  kind,
  currentProspect,
  saving,
  benchTrades,
}: {
  win: EditProspectWindowState
  /** The lane the page is on, for the kind's boxes when the prospect names none. */
  kind: ProspectKind
  currentProspect: Prospect | null
  saving: boolean
  benchTrades: StripRead<{ trade: string; dependable: number }[]>
}) {
  const {
    editingProspect,
    editSource,
    setEditSource,
    editTrades,
    setEditTrades,
    editMaxMiles,
    setEditMaxMiles,
    editRole,
    setEditRole,
    editPerson,
    setEditPerson,
    editCompany,
    setEditCompany,
    editGuard,
    closeEditProspect,
    handleDeleteProspect,
    saveEdit,
    handleWarmthDelta,
    handleWarmthReset,
  } = win

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 750,
        paddingTop: 'var(--app-top-chrome, 0px)',
      }}
      onClick={editGuard.requestClose}
    >
      <div role="dialog" aria-modal="true"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.5rem',
          maxWidth: 480,
          width: '90%',
          // A sub's or a lead's boxes make the window taller than a laptop screen (v2.5574): it scrolls inside.
          maxHeight: 'min(90vh, 100%)',
          overflowY: 'auto',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Edit Prospect</h3>
          <button
            type="button"
            className="prospectsEditModalDeleteBtn"
            onClick={handleDeleteProspect}
            disabled={saving}
            title="Delete prospect"
            style={{
              padding: '0.375rem',
              background: 'none',
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              color: 'var(--text-faint)',
              opacity: saving ? 0.5 : 1,
            }}
            aria-label="Delete prospect"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <ProspectPersonForm person={editPerson} onPerson={setEditPerson} company={editCompany} onCompany={setEditCompany} kind={(editingProspect ?? currentProspect)?.kind ?? kind} onSource={setEditSource} />
          {renderKindFields((editingProspect ?? currentProspect)?.kind ?? kind, {
            source: editSource, setSource: setEditSource,
            trades: editTrades, setTrades: setEditTrades,
            maxMiles: editMaxMiles, setMaxMiles: setEditMaxMiles,
            role: editRole, setRole: setEditRole,
            tradeChoices: (benchTrades ?? []).map((b) => b.trade),
          })}
          {(!editingProspect || editingProspect.id === currentProspect?.id) && currentProspect && (
            <div>
              <span style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                Warmth <span style={{ color: 'var(--text-muted)' }}>— goes up by one every Answered</span>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 600 }}>🔥 {currentProspect.warmth_count ?? 0}</span>
                <button type="button" onClick={() => handleWarmthDelta(-1)} disabled={saving} style={{ padding: '0.25rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: saving ? 'not-allowed' : 'pointer', color: 'inherit' }}>−1</button>
                <button type="button" onClick={() => handleWarmthDelta(1)} disabled={saving} style={{ padding: '0.25rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: saving ? 'not-allowed' : 'pointer', color: 'inherit' }}>+1</button>
                <button type="button" onClick={handleWarmthReset} disabled={saving} style={{ padding: '0.25rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', color: 'inherit' }}>Reset</button>
              </div>
            </div>
          )}
        </div>
        {editGuard.asking && <LeaveQuestion what="The changes to this prospect are not saved." onLeave={closeEditProspect} onKeep={editGuard.keep} />}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            type="button"
            onClick={saveEdit}
            disabled={saving}
            style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={editGuard.requestClose}
            style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
