/**
 * The office's three division bid folders in Drive (v2.4162), where a bid's plans go so the
 * robots can read them: a folder named for the project inside the division's folder. The bid
 * form's Find the folder looks here. The dev seat's apply_file_plans filed here until v2.6241 and
 * now files into the Shared Drive below (ROBOT_PLANS_SHARED_DRIVE). Plans are always a Drive link,
 * never an upload (the owner, 2026-09-29): the folders are the office's, shared with the intake
 * service account as View, and every folder made inside them is readable without a share step.
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

/**
 * Where the dev seat files a plan set (v2.6241): the "PipeTooling Jobs" Shared Drive the intake service account is
 * already a member of (docs/DRIVE_INTAKE_SETUP.md; since v2.6293 the drive in Click Plumbing's own Workspace, the
 * Douglas Mining one retired), in Bid plans › <Division> › <project>. The office's division
 * folders above sit in a My Drive, where a service account can make a folder but cannot own a file (no storage
 * quota; found live 2026-10-31 on ZZ bid b566), and the owner keeps them view-only. Bid plans sits at the drive's
 * root beside Jobs, so the job-folder sweeps never read it as a job. The bid form's Find still looks in the
 * division folders: a set the seat files needs no Find, because apply stamps the bid's plans link itself.
 */
export const ROBOT_PLANS_SHARED_DRIVE = { id: '0ANSfYqm0sENHUk9PVA', name: 'PipeTooling Jobs', folderName: 'Bid plans' } as const

/** The division's folder name inside Bid plans. */
export function robotPlansDivisionFolderName(key: DivisionKey): string {
  return key === 'hvac' ? 'HVAC' : key === 'electrical' ? 'Electrical' : 'Plumbing'
}

/** The path the seat files into, in words: "PipeTooling Jobs › Bid plans › Plumbing" (the project folder last when named). */
export function robotPlansPathWords(key: DivisionKey, projectFolder?: string): string {
  const parts: string[] = [ROBOT_PLANS_SHARED_DRIVE.name, ROBOT_PLANS_SHARED_DRIVE.folderName, robotPlansDivisionFolderName(key)]
  const project = (projectFolder ?? '').trim()
  if (project) parts.push(project)
  return parts.join(' › ')
}
