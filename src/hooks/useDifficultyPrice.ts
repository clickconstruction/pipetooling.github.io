import { useEffect, useState } from 'react'
import { DIFFICULTY_PRICE_CHANGED_EVENT, dropDifficultyPrice, loadPublishedDifficultyPrice, type DifficultyPriceVersion } from '../lib/bids/difficultyPriceIo'

/**
 * The published price list (punch list #357, PR 4), for who may rate, the Paying rule and the lines. Null until read,
 * and null when none is published or the read fails: every surface then falls back to version 1's numbers for its
 * words and prices nothing. It reads again when a version is published.
 */
export function useDifficultyPrice(enabled = true): DifficultyPriceVersion | null {
  const [price, setPrice] = useState<DifficultyPriceVersion | null>(null)
  useEffect(() => {
    if (!enabled) {
      setPrice(null)
      return
    }
    let live = true
    const read = () => {
      loadPublishedDifficultyPrice()
        .then((p) => {
          if (live) setPrice(p)
        })
        .catch(() => {
          if (live) setPrice(null)
        })
    }
    const onChanged = () => {
      dropDifficultyPrice()
      read()
    }
    read()
    window.addEventListener(DIFFICULTY_PRICE_CHANGED_EVENT, onChanged)
    return () => {
      live = false
      window.removeEventListener(DIFFICULTY_PRICE_CHANGED_EVENT, onChanged)
    }
  }, [enabled])
  return price
}
