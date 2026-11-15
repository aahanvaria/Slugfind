# SlugFind

UCSC lost-and-found hackathon prototype. React + Vite frontend, FastAPI + SQLite backend, Gemini-assisted item attribute extraction, heuristic match ranking, and manual-review claim requests.

## Run locally

Prerequisites: Node.js compatible with the included Vite version, and Python 3.11+.

### Backend

Copy `Backend/.env.example` to `Backend/.env` and replace the placeholders with your own Gemini key, a Gemini model your key can access, and a long random admin secret. Never commit `.env`.

Windows PowerShell:

```powershell
cd Backend
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

macOS/Linux:

```bash
cd Backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

FastAPI docs: http://127.0.0.1:8000/docs

### Frontend

Open a **second terminal**:

```bash
cd Frontend
npm ci
npm run dev
```

Open the Local URL shown by Vite. The frontend uses `http://127.0.0.1:8000` by default. Copy `Frontend/.env.example` to `Frontend/.env` and change `VITE_API_URL` if necessary; restart Vite after editing it. Never put the Gemini key or admin secret into `VITE_` variables.

## Example flow

1. Submit a lost report and a found report using the React app.
2. Open Matches and select a report to see ranked potential matches.
3. Submit a claim request with **synthetic** contact details for testing. Save its reference number.
4. Use `GET /api/admin/claims` and `PATCH /api/admin/claims/{claim_id}` under `/docs` with the private `x-admin-key` header to manually review a claim.

The match score is a **heuristic similarity ranking, not a probability of ownership**. Reviewing a claim does not establish ownership or notify the claimant. No automatic return, campus-staff integration, or email delivery is implemented.

## Data and safety

The SQLite database (`Backend/slugfind.db`) and `Backend/uploads/` are created locally at runtime and intentionally not shipped. This repository should not contain `.env`, real claimant data, personal photographs, `.venv`, `node_modules`, or production secrets. For public hosting, add proper user/admin authentication, spam/rate-limit protection, privacy controls, and a secure handoff process.
