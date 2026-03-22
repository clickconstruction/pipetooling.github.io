import { useState, useEffect } from 'react'

export function useIsNarrowScreen(): boolean {
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  )
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)')
    const handler = () => setIsNarrow(mql.matches)
    handler()
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return isNarrow
}
