/**
 * A Settings card's fold (punch list #261): closed by default, open when the card is the
 * target of the address the page landed on, of an anchor announced later (a search pick, a
 * door pressed while the tab is mounted) or of a `forceOpen` the parent reads from the address
 * (`?focus=issuer.…`). A card that holds a child anchor (`#who-counts-as-what` inside the rate
 * card) opens for it too, through the kernel's map.
 */
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { jobsBillingCardIsTarget, type JobsBillingCard } from '../lib/settings/jobsBillingGroups'
import { currentSettingsHashId, onSettingsTarget } from '../lib/settingsTarget'

export function useSettingsCardOpen(card: JobsBillingCard, forceOpen = false): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [open, setOpen] = useState<boolean>(() => !card.fold || forceOpen || jobsBillingCardIsTarget(card, currentSettingsHashId()))
  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])
  useEffect(() => {
    if (!card.fold) return
    return onSettingsTarget((id) => {
      if (jobsBillingCardIsTarget(card, id)) setOpen(true)
    })
  }, [card])
  return [open, setOpen]
}
