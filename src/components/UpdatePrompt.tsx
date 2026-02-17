import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

export function UpdatePrompt() {
  const [show, setShow] = useState(false)
  const [updateSW, setUpdateSW] = useState<(() => void) | null>(null)

  useEffect(() => {
    const updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh: () => setShow(true),
    })
    setUpdateSW(() => updateServiceWorker)
  }, [])

  const handleReload = () => {
    if (updateSW) {
      setShow(false)
      updateSW()
    }
  }

  if (!show) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: '#f97316',
        color: 'white',
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        zIndex: 10000,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <span>New version available</span>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={() => setShow(false)}
          style={{
            padding: '0.35rem 0.75rem',
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
