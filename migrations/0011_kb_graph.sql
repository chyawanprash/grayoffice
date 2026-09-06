-- Knowledge-base "memories": entities and relations pulled out of each ingested
-- document by the AI. The Memories page renders these as a connection graph.
CREATE TABLE kb_entities (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL,
  doc_id     TEXT NOT NULL,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'other',   -- person | org | account | location | date | amount | other
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_kb_entities_org ON kb_entities (org_id);
CREATE INDEX idx_kb_entities_doc ON kb_entities (doc_id);

CREATE TABLE kb_relations (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL,
  doc_id      TEXT NOT NULL,
  source_name TEXT NOT NULL,
  target_name TEXT NOT NULL,
  label       TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_kb_relations_org ON kb_relations (org_id);
CREATE INDEX idx_kb_relations_doc ON kb_relations (doc_id);
