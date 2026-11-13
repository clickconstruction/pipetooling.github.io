/**
 * What a site's materials screen (punch list #330) remembers on the device: how the list was last
 * read, by part or by place. One key in `localStorage`, nothing in the database.
 */
export type SiteView = 'part' | 'place'

const VIEW_KEY = 'pt.siteMaterials.view'

/** The reading the device last picked; by part until a pick is made. */
export function readSiteView(): SiteView {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'place' ? 'place' : 'part'
  } catch {
    return 'part'
  }
}

export function writeSiteView(view: SiteView): void {
  try {
    window.localStorage.setItem(VIEW_KEY, view)
  } catch {
    /* the screen works without the memory */
  }
}
