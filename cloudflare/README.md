# Cloudflare API (GameHubMasterMaster)

## 1) Configurar D1

```bash
cd cloudflare
npm install
npx wrangler d1 create gamehubmastermaster
```

Atualize `database_id` no `wrangler.toml`.

Aplicar schema:

```bash
npx wrangler d1 execute gamehubmastermaster --local --file=./schema.sql
npx wrangler d1 execute gamehubmastermaster --remote --file=./schema.sql
```

## 2) Configurar variaveis

No `wrangler.toml`:

- `SUPABASE_PROJECT_URL`
- `SUPABASE_JWT_ISS`
- `SUPABASE_JWT_AUD`

## 3) Rodar worker local

```bash
npm run dev
```

## 4) Frontend

Defina no `.env` do app:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8787
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

## Endpoints

- `POST /bootstrap`
- `GET /modules`
- `PUT /modules`
- `GET /realtime/ws` (WebSocket)
