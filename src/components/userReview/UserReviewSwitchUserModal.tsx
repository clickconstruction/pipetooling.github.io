import { useCallback, type CSSProperties, type KeyboardEvent } from 'react'
import {
  SearchableSelect,
  type SearchableSelectSelectableOption,
} from '../SearchableSelect'

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.05rem',
  fontWeight: 600,
  color: 'var(--text-strong)',
}

const helperTextStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.8125rem',
  color: 'var(--text-muted)',
}

const errorTextStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.8125rem',
  color: 'var(--text-red-700)',
}

const closeButtonStyle: CSSProperties = {
  padding: '0.4rem 0.85rem',
  fontSize: '0.875rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  background: 'var(--surface)',
  cursor: 'pointer',
  color: 'var(--text-700)',
}

export type UserReviewSwitchUserModalProps = {
  open: boolean
  onClose: () => void
  /**
   * Currently-viewed subject in the parent User Review modal. Used only
   * for display copy (the picker itself already omits this id, since
   * `buildSwitchUserOptions` strips it).
   */
  currentDisplayName: string
  options: SearchableSelectSelectableOption[]
  loading: boolean
  error: string | null
  onPick: (next: { userId: string; displayName: string }) => void
}

/**
 * Switch-user picker rendered above the User Review modal. Lets a staff
 * viewer (`dev` / `master_technician` / `assistant` / `superintendent`)
 * jump to another recently-active user without closing the parent
 * modal. Re-uses `SearchableSelect` for the actual list (substring
 * filter, keyboard nav, portal panel) — the modal is otherwise purely
 * presentational.
 *
 * Chrome mirrors `UserDaySummaryModal`: backdrop dismiss, Escape close,
 * footer Close button. Z-indexes are bumped one tier above the parent:
 *
 * - parent overlay: 1200
 * - this dialog:    1310
 * - dropdown panel: 1320 (via `portalZIndex` on the `SearchableSelect`)
 */
export function UserReviewSwitchUserModal({
  open,
  onClose,
  currentDisplayName,
  options,
  loading,
  error,
  onPick,
}: UserReviewSwitchUserModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    },
    [onClose],
  )

  const handleChange = useCallback(
    (value: string) => {
      if (!value) return
      const picked = options.find((o) => o.value === value)
      if (!picked) return
      onPick({ userId: picked.value, displayName: picked.label })
    },
    [onPick, options],
  )

  if (!open) return null

  const trimmedCurrent = currentDisplayName.trim()
  const showEmptyState = !loading && !error && options.length === 0

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1310,
        padding: '1rem',
        boxSizing: 'border-box',
      }}
      role="presentation"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-review-switch-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 420,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.18)',
          overflow: 'visible',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="user-review-switch-title" style={titleStyle}>
          Switch user
        </h2>

        {trimmedCurrent ? (
          <p style={helperTextStyle}>
            Currently viewing <strong>{trimmedCurrent}</strong>. Pick someone
            else to re-open this modal for them.
          </p>
        ) : null}

        {loading ? <p style={helperTextStyle}>Loading…</p> : null}
        {error ? <p style={errorTextStyle}>{error}</p> : null}
        {showEmptyState ? (
          <p style={helperTextStyle}>No other users with recent activity.</p>
        ) : null}

        {options.length > 0 ? (
          <div>
            <SearchableSelect
              value=""
              onChange={handleChange}
              options={options}
              placeholder="Pick a user…"
              searchable
              searchReplacesTrigger
              portalZIndex={1320}
              listAriaLabel="Switch user"
            />
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={closeButtonStyle}
            aria-label="Close"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
