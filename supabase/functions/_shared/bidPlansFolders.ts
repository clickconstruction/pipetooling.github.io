/**
 * The office's three division bid folders in Drive (v2.4162), where a bid's plans go so the
 * robots can read them: a folder named for the project inside the division's folder. Shared
 * between the bid form (Find the folder looks here) and the dev seat's apply_file_plans (which
 * files the set here) so both name the same place. Plans are always a Drive link, never an
 * upload (the owner, 2026-09-29): the folders are the office's, shared with the intake
 * service account once, and every folder made inside them is readable without a share step.
 */

export type DivisionKey = 'plumbing' | 'electrical' | 'hvac'

export type DivisionBidFolder = { key: DivisionKey; label: string; folderId: string; url: string }

export function driveFolderUrl(id: string): string {
  return `https://drive.google.com/drive/folders/${id}`
}

/** The office's three bid folders, one per division (the links the bid form has carried since the Project Folder field). */
export const DIVISION_BID_FOLDERS: ReadonlyArray<DivisionBidFolder> = [
  { key: 'plumbing', label: 'plumbing', folderId: '1HRAnLDgQ-0__1o4umf59w6zpfW3rFvtB', url: driveFolderUrl('1HRAnLDgQ-0__1o4umf59w6zpfW3rFvtB') },
  { key: 'electrical', label: 'electrical', folderId: '10gkh2r2xtyy2vlT3p_HnqgJI28vNN1q2', url: driveFolderUrl('10gkh2r2xtyy2vlT3p_HnqgJI28vNN1q2') },
  { key: 'hvac', label: 'HVAC', folderId: '1PU1lRZOxSwm--bCQ1LcQ7eXYu5GTDKOL', url: driveFolderUrl('1PU1lRZOxSwm--bCQ1LcQ7eXYu5GTDKOL') },
]

/** The division folder a service type's bids live in; null until a service type is picked or when it is none of the three. The same words `dev_bid_write` uses. */
export function divisionBidFolderFor(serviceTypeName: string | null | undefined): DivisionBidFolder | null {
  const n = (serviceTypeName ?? '').trim().toLowerCase()
  if (!n) return null
  if (/plumb/.test(n)) return DIVISION_BID_FOLDERS[0]!
  if (/electric/.test(n)) return DIVISION_BID_FOLDERS[1]!
  if (/hvac|heat|air/.test(n)) return DIVISION_BID_FOLDERS[2]!
  return null
}

/** The folder by its key, as the RPC's dry run names the division. */
export function divisionBidFolderByKey(key: string | null | undefined): DivisionBidFolder | null {
  return DIVISION_BID_FOLDERS.find((d) => d.key === key) ?? null
}
