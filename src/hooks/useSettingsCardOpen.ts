/**
 * A Settings card's fold (punch list #261): closed by default, open when the card is the
 * target of the address the page landed on, of an anchor announced later (a search pick, a
 * door pressed while the tab is mounted) or of a `forceOpen` the parent reads from the address
 * (`?focus=issuer.…`). A card that holds a child anchor (`#who-counts-as-what` inside the rate
 * card) opens for it too, and a card that moved tabs opens for the anchor it had before.
 */
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { settingsCardIsTarget, type SettingsFoldCardSpec } from '../lib/settings/settingsFoldCards'
import { currentSettingsHashId, onSettingsTarget } from '../lib/settingsTarget'

export function useSettingsCardOpen(card: SettingsFoldCardSpec, forceOpen = false): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [open, setOpen] = useState<boolean>(() => forceOpen || settingsCardIsTarget(card, currentSettingsHashId()))
  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])
  useEffect(() => {
    return onSettingsTarget((id) => {
      if (settingsCardIsTarget(card, id)) setOpen(true)
    })
  }, [card])
  return [open, setOpen]
}
