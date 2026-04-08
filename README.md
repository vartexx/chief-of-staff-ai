# Chief of Staff AI

Hackathon-ready multi-agent system for the Google problem statement.

## What it includes

- A primary orchestrator that plans and delegates high-stakes workflows
- Task, schedule, and knowledge sub-agents behind an MCP-style tool gateway
- Persistent SQLite storage for tasks, calendar events, notes, workflow runs, and tool-call audit logs
- API endpoints for the agent, dashboard, tasks, calendar, notes, and tool calls
- A judge-friendly frontend that shows the mission, plan, transcript, and database-backed results

## Run it

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000)

## Connect Google Calendar

1. Create an OAuth 2.0 client in Google Cloud.
2. Enable the Google Calendar API.
3. Add `http://localhost:3000/api/auth/google/callback` as an authorized redirect URI.
4. Copy [.env.example](C:\Users\Harsh\OneDrive\Desktop\Google Hackathon prototype\.env.example) to `.env` and fill in your Google credentials.
5. Restart the app and click `Connect Calendar` in the UI.

## Deploy to Cloud Run

This repo includes a [Dockerfile](C:\Users\Harsh\OneDrive\Desktop\Google Hackathon prototype\Dockerfile) for Cloud Run deployment.

Required runtime environment variables:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://YOUR-CLOUD-RUN-URL/api/auth/google/callback
```
