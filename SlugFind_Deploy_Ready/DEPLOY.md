# SlugFind public demo deployment (Render)

1. Upload this source-only project to a **new GitHub repository**, preserving `Backend/` and `Frontend/` directories. Never upload `.env` or actual claimant records.
2. At Render.com, create **New > Web Service**, connect the repository, use Root Directory `Backend`, Python runtime, Build `pip install -r requirements.txt`, Start `uvicorn main:app --host 0.0.0.0 --port $PORT`. Add `GEMINI_API_KEY`, `GEMINI_MODEL` (valid model from your local setup), `SLUGFIND_ADMIN_KEY` (long random secret) as Render Environment variables. Do not enter secrets in the repo.
3. For **durable data**, select a paid Render instance and attach a persistent disk mounted at `/var/data`. Add backend environment variables `SLUGFIND_DB_PATH=/var/data/slugfind.db` and `SLUGFIND_UPLOAD_DIR=/var/data/uploads`. Free Render web services have ephemeral local SQLite and uploads; they can reset when idle/restarted. If using Free just for a temporary demo, leave these two variables unset and explain the limitation. Do not expect persistence.
4. Copy the public backend URL, e.g. `https://your-backend.onrender.com`; verify `/health` is `ok`.
5. Create **New > Static Site** connected to same repository: Root Directory `Frontend`, Build `npm ci && npm run build`, Publish `dist`. Add frontend environment variable `VITE_API_URL=https://your-backend.onrender.com` (no trailing slash). Start deploy.
6. Copy the public frontend URL, e.g. `https://your-frontend.onrender.com`. In BACKEND web-service settings, add `FRONTEND_ORIGIN=https://your-frontend.onrender.com` and redeploy/restart. The browser will otherwise block cross-origin requests.
7. Open the public frontend in an incognito window; test items, image upload, matches and claim submission. Check the backend `/api/items` and `/docs` as needed. Submit **the frontend URL** to Devpost's Try It Out field.

Security: do not make your admin key public. Admin endpoints are protected only by a shared secret, and public item report and claim endpoints do not have authentication/rate limiting. For public demo use synthetic reports; avoid exposing real claimant details. Consider disabling public demo after judging.

Important: Render Free backend services spin down after inactivity. Their local SQLite DB and uploaded images are ephemeral (may be lost after spin-down/redeploy). For a lasting judge demo, use a paid persistent disk or migrate to a persistent database and object storage. The claims reference number and existing test data on your own laptop are not automatically present on a fresh deployment.
