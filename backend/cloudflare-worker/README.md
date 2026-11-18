# ZORVENA AgriAI backend

This Cloudflare Worker provides the server-side connection between the ZORVENA AgriAI page and the OpenAI Responses API.

## Important security notes

- Never put an OpenAI API key in `agriai.html`, browser JavaScript, GitHub, or a public repository.
- Store it as a Cloudflare Worker **Secret** named `OPENAI_API_KEY`.
- This starter restricts browser requests to the ZORVENA GitHub Pages origin and limits question length. CORS is not authentication and does not prevent all automated abuse.
- Before making the assistant publicly available, add Cloudflare Turnstile and/or effective rate limiting and usage limits. Monitor API usage and set billing alerts.
- The assistant gives general educational information. It is not a diagnostic tool and must not replace local agricultural extension advice.

## Deploy through the Cloudflare dashboard

1. Sign in to Cloudflare and open **Workers & Pages**.
2. Create a Worker named `zorvena-agriai`.
3. Open the Worker editor and replace its starter code with the full contents of `src/index.js`.
4. Deploy the Worker.
5. Open **Settings → Variables and Secrets**.
6. Add a secret:
   - Type: **Secret**
   - Name: `OPENAI_API_KEY`
   - Value: your OpenAI API key
7. Add these text variables if they are not already configured:
   - `ALLOWED_ORIGIN` = `https://venkateshwari-p.github.io`
   - `OPENAI_MODEL` = `gpt-6.2-astra`
8. Save and deploy again.
9. Copy the Worker URL (it normally ends in `.workers.dev`). Do not send your API key to anyone.

## Local / CLI deployment

Install Node.js, then from this directory run:

```powershell
npm install -g wrangler
wrangler login
wrangler secret put OPENAI_API_KEY
wrangler deploy
```

The `wrangler.toml` file contains the non-secret configuration. Never commit a real key or a `.dev.vars` file.

## API contract

POST JSON to the Worker URL:

```json
{ "message": "How can I improve soil health?", "language": "en" }
```

Use `"ta"` for Tamil. A successful response is:

```json
{ "answer": "..." }
```

The public AgriAI page will be connected after the Worker is deployed and its URL is known.
