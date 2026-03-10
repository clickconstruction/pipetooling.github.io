import { createContext, useContext, useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

type UpdatePromptContextValue = {
  needRefresh: boolean
  updateSW: (() => void) | null
  dismiss: () => void
}

const UpdatePromptContext = createContext<UpdatePromptContextValue | null>(null)

export function UpdatePromptProvider({ children }: { children: React.ReactNode }) {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [updateSW, setUpdateSW] = useState<(() => void) | null>(null)

  useEffect(() => {
    const CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

    const updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh: () => setNeedRefresh(true),
      onRegisteredSW(swUrl, registration) {
        registration &&
          setInterval(async () => {
            if (registration.installing || !navigator) return
            if ('connection' in navigator && !navigator.onLine) return
            try {
              const resp = await fetch(swUrl, {
                cache: 'no-store',
                headers: { cache: 'no-store', 'cache-control': 'no-cache' },
              })
              if (resp?.status === 200) await registration.update()
            } catch {
              /* offline/server errors - ignore */
            }
          }, CHECK_INTERVAL_MS)
      },
    })
    setUpdateSW(() => updateServiceWorker)
  }, [])

  const dismiss = () => setNeedRefresh(false)

  return (
    <UpdatePromptContext.Provider value={{ needRefresh, updateSW, dismiss }}>
      {children}
    </UpdatePromptContext.Provider>
  )
}

export function useUpdatePrompt(): UpdatePromptContextValue | null {
  return useContext(UpdatePromptContext)
}
