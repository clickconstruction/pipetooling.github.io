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
    const updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh: () => setNeedRefresh(true),
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
