-- Cloudflare D1 Database Schema for Cliper

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media_files (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_key TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT,
    size_bytes INTEGER,
    duration REAL,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transcripts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    media_id TEXT NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
    raw_text TEXT,
    words_json TEXT NOT NULL, -- JSON array of {word, start, end}
    language TEXT DEFAULT 'id',
    model TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS render_jobs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    plan_json TEXT NOT NULL, -- JSON RenderPlan: {clipId, cuts, layout, cropX, captions}
    status TEXT NOT NULL CHECK(status IN ('queued', 'processing', 'done', 'failed')) DEFAULT 'queued',
    output_key TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_media_project ON media_files(project_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_project ON transcripts(project_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_media ON transcripts(media_id);
CREATE INDEX IF NOT EXISTS idx_render_jobs_status ON render_jobs(status);
