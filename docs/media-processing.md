# Media Portal: how uploaded photos are processed (Step 7)

## What happens to a photo
1. The browser uploads the original to the **private** `events/<event>/original/` area of S3.
2. The browser calls `/api/media/uploads/complete`. The server checks the real file (size, type, first bytes), then:
3. reads the original, makes a **web** version (WebP, max 1920 px) and a **thumb** (WebP, max 480 px),
   writes both to the public `web/` and `thumb/` areas, and marks the item `ready`.

The whole thing happens inside that one request (a few photos in parallel, 3 at a time).
If the server dies halfway, the item stays `processing`; the uploader's **Retry**, or any later
call to `complete` for it, finishes the job. Writing the files always happens *before* the item can go public.

## Privacy
Public files carry **no metadata**: GPS location, phone model, timestamps and copyright are dropped
(the photo is rotated first, so it still looks right). The private original keeps its metadata but is never served.

## iPhone photos (HEIC)
The server cannot decode HEIC (HEVC patents). The **browser** converts it to JPEG before upload
(`components/features/media/convert-heic.ts`, library `heic-to`, loaded only when a HEIC file is chosen).
Converted one at a time to limit memory. If conversion fails, the file is rejected with a clear message.
`heic-to` is LGPL-3.0; it is used unmodified as a separate dynamically-loaded module.

## Videos
Served exactly as uploaded (MP4 / WebM). No transcoding, no MOV support: members upload edited MP4s, or use the Drive link import.

## Safety limits
- Input larger than 80 megapixels is refused before decoding (decompression-bomb guard).
- A file that passes the type check but cannot be decoded is marked `failed` and its original deleted.
- Animated images use their first frame only.

## Deploy checklist
1. **Update the CloudFormation stack** (`infra/media-storage.yaml`): the app role now also needs
   `s3:PutObject` on `events/*/web/*` and `events/*/thumb/*`. Without it, every photo stays stuck in `processing`.
2. Deploy the app. `sharp` is already a dependency; Amplify's Next.js runtime includes it.
3. Existing items stuck in `processing` from before this step are finished the next time their uploader hits Retry.
