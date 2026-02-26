# IBK COB File Vault

Web application to upload and manage IBK COB files stored in Supabase.

## Features

- Upload PDF, DOCX, XLSX, ZIP files (up to 50 MB)
- Drag-and-drop or click-to-browse upload
- Auto-prune: keeps only the latest 20 files
- Download files via signed URLs
- Delete files manually
- Dark-themed modern UI

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Open **SQL Editor** and run the contents of `supabase_setup.sql`
3. Copy your **Project URL** and **service_role key** from Settings > API

### 2. Environment

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
PORT=3000
```

### 3. Local Development

```bash
npm install
npm start
```

Open `http://localhost:3000` in your browser.

### 4. Deploy to Vercel

1. Push code to GitHub
2. Import the repo in [vercel.com](https://vercel.com)
3. Add environment variables in Vercel dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
4. Deploy!

> **Note**: Vercel free tier has a 4.5 MB request body limit. For files larger than that, upgrade to Vercel Pro or use Supabase client-side upload.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload` | Upload a file (multipart form) |
| GET | `/api/files` | List recent files |
| GET | `/api/download?id=xxx` | Get signed download URL |
| DELETE | `/api/files?id=xxx` | Delete a file |
