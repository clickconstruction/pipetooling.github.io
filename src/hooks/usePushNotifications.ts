import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export type PushPermissionState = 'default' | 'granted' | 'denied'

export function usePushNotifications(userId: string | undefined) {
  const [permission, setPermission] = useState<PushPermissionState>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

  const checkPermission = useCallback(() => {
    if (!('Notification' in window)) return
    setPermission(Notification.permission as PushPermissionState)
  }, [])

  const checkSubscription = useCallback(async () => {
    if (!userId || !('serviceWorker' in navigator) || !('PushManager' in window)) return
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setIsSubscribed(!!sub)
    } catch {
      setIsSubscribed(false)
    }
  }, [userId])

  useEffect(() => {
    checkPermission()
  }, [checkPermission])

  useEffect(() => {
    if (userId) {
      void checkSubscription()
    } else {
      setIsSubscribed(false)
    }
  }, [userId, checkSubscription])

  const enable = useCallback(async () => {
    if (!userId || !vapidPublicKey) {
      setError('Push notifications are not configured. Set VITE_VAPID_PUBLIC_KEY.')
      return
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setError('Push notifications are not supported in this browser.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      let perm = Notification.permission
      if (perm === 'default') {
        perm = await Notification.requestPermission()
      }
      setPermission(perm as PushPermissionState)

      if (perm !== 'granted') {
        setError(perm === 'denied' ? 'Notification permission was denied.' : 'Permission not granted.')
        setLoading(false)
        return
      }

      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })
      }

      const json = sub.toJSON()
      const { endpoint } = json
      const keys = json.keys
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        setError('Failed to get subscription keys.')
        setLoading(false)
        return
      }

      const { error: insertError } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: userId,
          endpoint,
          p256dh_key: keys.p256dh,
          auth_key: keys.auth,
          user_agent: navigator.userAgent,
        },
        { onConflict: 'user_id,endpoint' }
      )

      if (insertError) throw insertError
      setIsSubscribed(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable push notifications.')
      setIsSubscribed(false)
    } finally {
      setLoading(false)
    }
  }, [userId, vapidPublicKey])

  const disable = useCallback(async () => {
    if (!userId) return

    setLoading(true)
    setError(null)

    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
      }

      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', userId)

      if (subs && subs.length > 0) {
        await supabase.from('push_subscriptions').delete().eq('user_id', userId)
      }

      setIsSubscribed(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable push notifications.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  return {
    permission,
    isSubscribed,
    loading,
    error,
    supported: !!(typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window),
    vapidConfigured: !!vapidPublicKey,
    enable,
    disable,
    checkPermission,
    checkSubscription,
  }
}
