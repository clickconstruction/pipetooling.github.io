import { useCallback, useEffect, useState } from 'react'
import type { MailSavedNeed } from '../lib/myMail/savedForYou'

/**
 * The owner is told (v2.7068): the viewer's own notices that someone else saved their mail onto a job, for the Needs
 * you card. Read when the card mounts and when the window comes back into focus, as While you were off is.
 */
export function useMailSavedForYou(enabled: boolean, userId: string | undefined): { need: MailSavedNeed | null } {
  const [need, setNeed] = useState<MailSavedNeed | null>(null)
  const load = useCallback(async () => {
    if (!enabled || !userId) {
      setNeed(null)
      return
    }
    try {
      const { loadMailSaved } = await import('../lib/myMail/savedForYouIo')
      setNeed(await loadMailSaved(userId, new Date().toISOString()))
    } catch {
      setNeed(null)
    }
  }, [enabled, userId])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])
  return { need }
}
