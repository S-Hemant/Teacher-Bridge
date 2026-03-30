# Teacher–Student Bridge

Full-stack app: NestJS API (`api/`), React + Vite UI (`web/`), PostgreSQL, Redis (BullMQ), MinIO (S3-compatible uploads).

## Prerequisites

- Node 20+
- Docker (for Postgres, Redis, MinIO) — optional if you run services yourself

## Local setup

1. Start infrastructure:

   ```bash
   docker compose up -d
   ```

2. API env: copy [`.env.example`](.env.example) to `api/.env` and adjust if needed.

3. Database:

   ```bash
   cd api
   set NODE_TLS_REJECT_UNAUTHORIZED=0   # only if Prisma engine download fails behind TLS inspection
   npx prisma migrate deploy
   npx prisma db seed
   ```

4. Run API (port 3000):

   ```bash
   cd api
   npm run start:dev
   ```

5. Web (port 5173, proxies `/api` → API):

   ```bash
   cd web
   npm run dev
   ```

Open `http://localhost:5173`. Swagger: `http://localhost:3000/api/docs`.

Demo accounts (after seed): `teacher@demo.local` / `TeacherDemo123!`, `student@demo.local` / `StudentDemo123!`.

## Voice pipeline

- Student: **Voice match** — record audio, upload to presigned URL, worker runs STT (OpenAI Whisper when `OPENAI_API_KEY` is set; otherwise a demo transcript), heuristic NLP, teacher matching.
- Requires Redis for BullMQ and MinIO/S3 for audio objects.
- When processing finishes, the API emits **`voiceQuery.completed`** on Socket.IO namespace **`/ws`** (authenticated with the same JWT as REST). The web app listens and refreshes results.

## Google OAuth

1. Create OAuth credentials in Google Cloud Console (Web application).
2. Authorized redirect URI must match **`GOOGLE_CALLBACK_URL`** (e.g. `http://localhost:3000/api/v1/auth/google/callback`).
3. Set **`GOOGLE_CLIENT_ID`**, **`GOOGLE_CLIENT_SECRET`**, **`FRONTEND_OAUTH_REDIRECT`** (e.g. `http://localhost:5173/auth/callback`).
4. Login page links **Google (student)** / **Google (teacher)** → `/api/v1/auth/google?role=...` → Google → callback exchanges code for JWTs → redirect to SPA with tokens in the URL **hash** (fragment).

## Production notes

- Set strong `JWT_SECRET` / `JWT_REFRESH_SECRET`, HTTPS, and restrict `CORS_ORIGIN`.
- Run API container with env; run `prisma migrate deploy` before start.
- Build web with `VITE_API_URL` pointing at your public API base (e.g. `https://api.example.com/api/v1`).
