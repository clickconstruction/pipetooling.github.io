/**
 * The three rating dimensions shared by candidate reviews (Team → Screen /
 * Interview) and team-member reviews (Team → Review): defs, comment-column
 * mapping, and the RatingSliders control. Moved verbatim from
 * TeamProspectsTab.tsx in v2.948 when Team → Review started reusing them.
 */

/** The three candidate rating dimensions (Edit modal sliders + card bars). */
export const RATING_DEFS = [
  { key: 'rating_ability', short: 'Ability', label: 'Evidence of Exceptional Ability (Talent / Problem-Solving)', color: 'var(--text-blue-500)' },
  { key: 'rating_drive', short: 'Drive', label: 'Drive / Work Ethic / Intrinsic Motivation', color: '#f59e0b' },
  { key: 'rating_integrity', short: 'Integrity', label: 'Trustworthiness / Goodness of Heart / Integrity', color: '#16a34a' },
] as const
export type RatingKey = (typeof RATING_DEFS)[number]['key']

export type RatingValues = Record<RatingKey, number | null>

/** Review-table comment column for each rating dimension (v2.946). */
export const COMMENT_KEY_BY_RATING = {
  rating_ability: 'comment_ability',
  rating_drive: 'comment_drive',
  rating_integrity: 'comment_integrity',
} as const

/** 0-100 sliders per dimension, with an unrated state and a clear affordance (Edit candidate + My review modals). */
export function RatingSliders({
  values,
  onChange,
  comments,
  onCommentChange,
}: {
  values: RatingValues
  onChange: (key: RatingKey, value: number | null) => void
  /** When provided (My review modal), each slider gets its own comment box (v2.946). */
  comments?: Record<RatingKey, string>
  onCommentChange?: (key: RatingKey, value: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.75rem' }}>
      {RATING_DEFS.map((def) => {
        const value = values[def.key]
        return (
          <div key={def.key}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.875rem', flex: 1 }}>{def.label}</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: value == null ? 'var(--text-faint)' : 'var(--text-strong)' }}>
                {value == null ? 'unrated' : value}
              </span>
              {value != null && (
                <button
                  type="button"
                  onClick={() => onChange(def.key, null)}
                  title="Clear rating (back to unrated)"
                  style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                >
                  clear
                </button>
              )}
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={value ?? 50}
              onChange={(e) => onChange(def.key, Number(e.target.value))}
              aria-label={`${def.label}: ${value == null ? 'unrated' : value} out of 100`}
              style={{ width: '100%', accentColor: def.color, opacity: value == null ? 0.45 : 1 }}
            />
            {comments && onCommentChange && (
              <input
                type="text"
                value={comments[def.key]}
                onChange={(e) => onCommentChange(def.key, e.target.value)}
                placeholder={`Why this ${def.short} score? (optional)`}
                aria-label={`${def.short} comment`}
                style={{ width: '100%', boxSizing: 'border-box', marginTop: '0.25rem', padding: '0.35rem 0.5rem', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-base)', border: '1px solid var(--border)', borderRadius: 4 }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
