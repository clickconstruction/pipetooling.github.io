/**
 * A customer's Drive folder on the customer profile (v2.6288, the tree under the customer: root › customer › job). The
 * folder sweep makes the customer's folder with the customer's first job and writes it on `customers.google_drive_link`
 * (`_shared/jobFolders.ts`); the profile's band offers the door when the link is a Drive folder and says what makes it
 * when there is none. Pure, so the band's words are held by `customerFolderWords.test.ts`.
 */
import { driveFolderIdFromUrl } from '../jobs/jobDriveFolders'

export type CustomerFolderDoor = { kind: 'open'; url: string } | { kind: 'none'; words: string }

/** What makes the folder, said where the door would be. */
export const CUSTOMER_FOLDER_LATER_WORDS = 'The Drive folder is made with the customer’s first job.'

/** The band's door: the folder's link as a Drive folder, else the words. A link that is not a Drive folder reads as none. */
export function customerFolderDoor(link: string | null | undefined): CustomerFolderDoor {
  const id = driveFolderIdFromUrl(link)
  return id ? { kind: 'open', url: `https://drive.google.com/drive/folders/${id}` } : { kind: 'none', words: CUSTOMER_FOLDER_LATER_WORDS }
}
