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

## 2.1) Configurar R2 (assets de musica)

```bash
npx wrangler r2 bucket create gamehubmastermaster-music-assets
```

Binding ja definido no `wrangler.toml` como `MUSIC_ASSETS`.

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
- `GET /music/home`
- `GET /music/genres`
- `POST /music/genres`
- `POST /music/uploads/image`
- `POST /music/artists`
- `GET /music/artists/:id/albums`
- `POST /music/albums`
- `GET /music/albums/:id/tracks`
- `POST /music/tracks`
- `POST /music/tracks/:id/like`
- `DELETE /music/tracks/:id/like`
- `POST /music/albums/:id/like`
- `DELETE /music/albums/:id/like`
- `POST /music/tracks/:id/listen`
