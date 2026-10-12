/** Messages, cut 4c: the clause windows' and Settings tab's controls, in the theme's tokens. */
export const clauseInputStyle = { width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit' } as const

export const clauseButtonStyle = { padding: '0.4rem 0.8rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer', font: 'inherit', fontSize: '0.85rem' } as const

export const clausePrimaryStyle = { ...clauseButtonStyle, background: '#2563eb', borderColor: '#2563eb', color: 'white', fontWeight: 600 } as const
