# Media storage (S3 + CloudFront + IAM)

One CloudFormation template, `media-storage.yaml`, creates everything the Media Portal needs on AWS.

| Piece | What it does |
|---|---|
| S3 bucket | **Private.** Block Public Access on, encrypted, TLS-only. Never deleted with the stack. |
| CloudFront | The only public door. Reads only `web/`, `thumb/`, `poster/`, `video/`. |
| IAM managed policy | What the Next.js app may do: sign uploads, read back, delete. Nothing else. |
| Budget (optional) | Emails you before video traffic surprises you. |

```
events/{eventId}/original/{mediaId}.jpg    PRIVATE  (raw image uploads)
events/{eventId}/video/{mediaId}.mp4       public via CloudFront
events/{eventId}/web|thumb|poster/...webp  public via CloudFront
```

## 1. Deploy

Use **ap-south-1 (Mumbai)**, closest to your users. Needs AWS CLI v2 with admin-ish rights.

```bash
aws cloudformation deploy \
  --region ap-south-1 \
  --stack-name sbg-media \
  --template-file infra/media-storage.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
      BucketName=aws-sbg-media-prod \
      SiteOrigins="https://main.<your-app-id>.amplifyapp.com,http://localhost:3000" \
      AlertEmail=you@example.com
```

- If the bucket name is taken (names are global), change `BucketName`.
- `SiteOrigins`: no trailing slash. Add your custom domain later by re-running the command.
- CloudFront takes 5-10 minutes the first time.

Read the outputs:

```bash
aws cloudformation describe-stacks --region ap-south-1 --stack-name sbg-media \
  --query "Stacks[0].Outputs" --output table
```

## 2. Give the app permission (no access keys)

The template made a managed policy (output `AppPolicyArn`). Attach it to the IAM role your Amplify app **compute** runs with.

1. Amplify console → your app → **Hosting → Compute / SSR settings** (name varies by console version) → note the **IAM compute role**. If none is set, create a role trusted by `amplify.amazonaws.com` and select it there.
2. Either redeploy the stack with `AppRoleName=<role name>`, or attach by hand:
   ```bash
   aws iam attach-role-policy --role-name <role name> --policy-arn <AppPolicyArn>
   ```

Never create a long-lived access key for this. A leaked key is the usual way S3 buckets get abused.

## 3. Set environment variables in Amplify

Amplify → **Hosting → Environment variables** (names starting with `AWS_` are reserved, which is why we use `S3_*`):

| Variable | Value |
|---|---|
| `S3_BUCKET` | output `BucketName` |
| `S3_REGION` | `ap-south-1` |
| `MEDIA_CDN_URL` | output `MediaCdnUrl` (no trailing slash) |

Then redeploy the app. Mirror the same three in `.env.local` for local work.

**Why this works:** Amplify makes console variables available at *build* time only. `amplify.yml` copies the ones the server needs into `.env.production` during the build. It lists variable name prefixes, and `S3_` and `MEDIA_CDN_URL` are in that list. If you rename a variable, update the `grep` line in `amplify.yml` too, or the running site will not see it.

## 4. Verify (do not skip)

Upload two small test objects with your own admin credentials, then test through the CDN:

```bash
B=aws-sbg-media-prod; CDN=https://dxxxxxxxxxxxxx.cloudfront.net
E=00000000-0000-4000-8000-000000000000; M=11111111-1111-4111-8111-111111111111
echo hi > t.txt
aws s3 cp t.txt s3://$B/events/$E/web/$M.webp      --content-type image/webp
aws s3 cp t.txt s3://$B/events/$E/original/$M.jpg  --content-type image/jpeg

curl -sI $CDN/events/$E/web/$M.webp      | head -1   # expect 200
curl -sI $CDN/events/$E/original/$M.jpg  | head -1   # expect 403  <- the important one
curl -sI https://$B.s3.ap-south-1.amazonaws.com/events/$E/web/$M.webp | head -1   # expect 403 (bucket is private)

aws s3 rm s3://$B/events/$E --recursive    # clean up
```

Pass condition: **200 / 403 / 403**. If `original/` returns 200, stop and fix before any member uploads.

Note: behind OAC, a *missing* object also returns 403, not 404. That is normal.

## Cost (rough, small student-group scale)

- S3: about $0.025 per GB-month. 50 GB of event media is roughly $1.30/month.
- CloudFront: first 1 TB/month of transfer out is in the always-free tier. Video is what can grow; the budget alert covers it.
- Presigned uploads go browser → S3 directly, so they do not use Amplify bandwidth or Lambda time.

## Teardown

The bucket has `DeletionPolicy: Retain`, so deleting the stack keeps your photos. To remove everything: empty and delete the bucket manually, then delete the stack. Do that on purpose, not by accident.
