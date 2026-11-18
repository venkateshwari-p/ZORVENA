# ZORVENA AgriAI backend (Gemini free tier)

This Cloudflare Worker securely connects the ZORVENA AgriAI page to the Google Gemini Developer API.

## 1. Create a free Gemini API key

1. Open https://aistudio.google.com/app/apikey
2. Sign in with your Google account.
3. Create an API key for a project.
4. Copy it privately. Never paste it into chat, GitHub, or website code.

Google offers free usage for selected models, subject to changing quotas and rate limits. Check https://ai.google.dev/gemini-api/docs/pricing and https://ai.google.dev/gemini-api/docs/rate-limits. Free-tier data may be used by Google to improve its products; do not send private or sensitive farmer information.

The default model here is `gemini-2.5-flash-lite`. Model access and quotas depend on your AI Studio project.

## 2. Deploy through Cloudflare dashboard

1. Sign in at https://dash.cloudflare.com/ and open **Workers & Pages**.
2. Create a Worker named `zorvena-agriai`.
3. Open its editor and replace the starter code with the complete contents of `src/index.js` from this repository.
4. Deploy the Worker.
5. Open **Settings → Variables and Secrets**.
6. Add a **Secret** named `GEMINI_API_KEY` and paste your Gemini API key as its value.
7. Add or confirm these text variables:
   - `ALLOWED_ORIGIN` = `https://venkateshwari-p.github.io`
   - `GEMINI_MODEL` = `gemini-2.5-flash-lite`
8. Save and deploy again.
9. Copy the Worker URL ending in `.workers.dev`. Keep your API key private.

## 3. Connect the website

The AgriAI page needs the Worker URL in its `WORKER_URL` setting. Once the Worker is deployed, update that setting to your exact `.workers.dev` URL.

## Security and limitations

- Never put the API key in `agriai.html`, browser JavaScript, GitHub, or a public repository.
- CORS restricts browser origins but is not authentication and does not stop all automated abuse. Before public launch, add effective rate limiting and/or Cloudflare Turnstile and monitor quotas.
- The Gemini free tier has rate limits and can change. Do not enable paid billing if you want to keep the project at zero cost.
- Free-tier prompts may be used to improve Google's products. Avoid personal, confidential, or sensitive farmer data.
- AgriAI provides general educational information, not a definitive crop diagnosis or a replacement for local agricultural extension advice.

## API contract

POST JSON to the Worker URL:

```json
{ "message": "How can I improve soil health?", "language": "en" }
```

Use `"ta"` for Tamil. A successful response is:

```json
{ "answer": "..." }
```
