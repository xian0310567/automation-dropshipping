# Vercel Deployment

이 프로젝트는 Vercel Git Integration으로 배포한다. GitHub 저장소가 Vercel 프로젝트에 연결되면 `master`에 push될 때마다 Production 배포가 생성되고, 다른 브랜치 push는 Preview 배포가 된다.

## 프로젝트 설정

- Framework Preset: `Next.js`
- Production Branch: `master`
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm build`
- Cron: `GET /api/cron/dispatch`, schedule `0 * * * *`

위 설정 중 빌드와 크론은 `vercel.json`에 version-controlled 설정으로 고정한다. 계정, 팀, 도메인, 환경 변수, GitHub 연결은 Vercel Dashboard 또는 Vercel CLI에서 관리한다.

## Git 연결 절차

1. Vercel Dashboard에서 `xian0310567/automation-dropshipping` GitHub 저장소를 import한다.
2. Production Branch가 `master`인지 확인한다.
3. 환경 변수를 Production과 Preview에 추가한다.
4. `master`에 push해서 첫 Production 배포를 확인한다.

로컬 CLI가 필요하면 다음 순서로 연결한다.

```bash
pnpm dlx vercel@latest login
pnpm dlx vercel@latest link
pnpm dlx vercel@latest env ls production
```

## 필수 Production 환경 변수

서버 시작 시 production preflight가 아래 값을 검사한다.

- `DATABASE_URL`
- `DATABASE_DIRECT_URL`
- `CRON_SECRET`
- `BLOB_READ_WRITE_TOKEN`
- `PII_ENCRYPTION_KEY`
- `AUTH_PROVIDER_MODE=clerk`
- `AUTH_ALLOW_DEV_SESSION_IN_PRODUCTION=false`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

알림을 켜는 경우 `NOTIFICATION_PROVIDER` 값에 따라 추가 변수가 필요하다.

- `telegram`: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- `discord`: `DISCORD_WEBHOOK_URL`

`COUPANG_VENDOR_ID`, `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY`는 레거시 단일 셀러 작업용이다. SaaS 연결은 tenant-scoped `integration_accounts` 데이터로 저장한다.

## 배포 전 확인

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

Vercel 배포가 실패하면 Vercel Deployment Logs에서 Install, Build, Runtime 단계 중 어디서 실패했는지 먼저 확인한다.
