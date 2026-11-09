# AI agents and workspaces (JAWAFA ONE AI)

## Data model (Firestore, per company)

```
/companies/{cid}/agents/{agentId}
{ "name": "مساعد المبيعات",
  "systemInstruction": "أنت مساعد خبير في تحليل فواتير الإيجارات وتلخيصها للمستأجرين.",
  "model": "gemini-3.7-flash",
  "temperature": 0.2,
  "by": "<uid>", "at": <ms> }

/companies/{cid}/workspaces/{workspaceId}
{ "name": "شاشة عقود الإيجار", "activeAgentId": "agent_abc123", "by": "<uid>", "at": <ms> }
```

Rules (`firestore.rules`, tests AGT-01 and WS-01):

- **agents**:
  - Members read.
  - Only owner, chairman and general manager create, edit or delete agents.
  - Fields are exactly the ones above:
    - `name`: 1 to 80 characters.
    - `systemInstruction`: 1 to 4000 characters.
    - `model`: must match `gemini-[0-9a-z.-]{1,40}`. The rules check the shape of the name only; whether a model exists is decided by the AI service at run time.
    - `temperature`: a number from 0 to 2.
    - `by`: must be the writer's uid.
- **workspaces**:
  - Members read. Writers (owner, chairman, GM, procurement, branch manager, accountant) create and edit.
  - `activeAgentId` is optional. When set, it must name an existing agent of the same company.

## Running an agent

- The **AI agents** screen in `/one/` runs a workspace's active agent with Firebase AI Logic (`firebase-ai.js` 11.10.0 from gstatic, Gemini Developer API backend).
- **What is sent:** only the agent settings (model, system instruction, temperature) and the text the member types. No company dataset, financial record or Jawafa database is sent.
- **What is kept:** neither the prompt nor the answer is stored. The audit log records `agent.run` with the agent, model and workspace names.
- **Labelling:** answers are labelled as AI output and are not treated as LIVE data.

## Enabling runs (owner, one time)

Runs stay **off** until App Check protects the site. Without App Check, anyone could use this public page to spend the project's Gemini quota (the project is on the Blaze plan).

1. **Turn on Firebase AI Logic:** Firebase console → AI Logic → Get started, and choose the Gemini Developer API.
2. **Create a reCAPTCHA Enterprise key:** Google Cloud console → Security → reCAPTCHA. Create a key of type *Website* for the domain `amer-ai-store.github.io`.
3. **Register the web app for App Check:** Firebase console → App Check → Apps → web app "Amer Live Dashboard" → reCAPTCHA Enterprise. Enter the key from step 2.
4. **Enforce App Check:** in App Check → APIs, choose *Enforce* for Firebase AI Logic.
5. **Set the site key:** put the site key in `dashboard/one/ai-config.js` (`window.JAWAFA_ONE_APPCHECK_SITE_KEY = "…"`) through a pull request. The site key is a public identifier and ships in the page.

## Tested

| Test | What it covers | Result |
|---|---|---|
| CORE-09 | Validation, request contents, run gating | unit |
| AGT-01, WS-01 | Rules | Firestore emulator |
| E2E-36..40 | Agent and workspace creation; run disabled without App Check; stubbed model run sends only agent settings + typed text; auditor read-only | Auth + Firestore emulators, Chromium |

## Not tested

A real Gemini call, App Check, and whether the model `gemini-3.7-flash` exists. The sandbox cannot reach Google services, and the model in E2E is a stub.
