import { useUpdatePrompt } from '../contexts/UpdatePromptContext'

export function UpdatePrompt() {
  const ctx = useUpdatePrompt()
  if (!ctx?.needRefresh) return null

  const handleReload = () => {
    if (ctx.updateSW) {
      ctx.dismiss()
      ctx.updateSW()
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: '#f97316',
        color: 'white',
        padding: 'max(0.75rem, env(safe-area-inset-top, 0px)) 1rem 0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        flexWrap: 'wrap',
        zIndex: 10000,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <span>New version available</span>
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        <button
          onClick={() => ctx.dismiss()}
          style={{
            padding: '0.35rem 0.75rem',
            minHeight: 44,
            background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.5)',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          Later
        </button>
        <button
          onClick={handleReload}
          style={{
            padding: '0.35rem 0.75rem',
            minHeight: 44,
            background: 'white',
            border: 'none',
            borderRadius: '6px',
            color: '#f97316',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </div>
    </div>
  )
}
