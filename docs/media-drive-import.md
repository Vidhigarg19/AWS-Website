# Media Portal: Google Drive link import

Members can paste a Google Drive folder (or file) link on an event's portal page.
Nothing is copied: the site shows the files straight from Drive.

## One-time setup
1. Google Cloud Console: create a project, enable **Google Drive API**.
2. Create an **API key** and restrict it to the Drive API only.
3. Set `GOOGLE_DRIVE_API_KEY` in Amplify environment variables (server-side; never `NEXT_PUBLIC_`).
4. Apply `supabase/migrations/20261024000001_media_drive_items.sql`.

## Using it
- Share the Drive folder as **Anyone with the link, Viewer**.
- Paste the link, click **Import**. Re-importing the same folder only adds new files.
- Up to 200 files per import; subfolders and non-photo/video files are skipped.
- **Remove all Drive files** (under the import box) unlinks every Drive item on that event in one go.
  Admins remove all of them; media members only the ones they imported. It only removes them from the
  site: nothing in Google Drive changes, and the folder can be imported again later.

## Trade-offs (by design)
- If a file is deleted or unshared in Drive, it disappears from the site.
- Drive serves thumbnails and the video player; large public traffic can hit Google's rate limits.
- iPhone HEIC photos and MOV videos display fine this way (Drive converts them).
- Hide, caption and delete work exactly as for uploaded files. Deleting never touches Drive.

## Security notes
- The pasted link is never fetched. Only the id is extracted and sent to the fixed
  `www.googleapis.com` host; hosts other than `drive.google.com`/`docs.google.com` are rejected.
- Ids are validated against `[A-Za-z0-9_-]{10,128}` before reaching a URL, DB column or iframe.
- The API key is never sent to a browser; public URLs are built from the file id alone.
