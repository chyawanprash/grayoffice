-- Keep the original uploaded PDF in R2 (was deleted after processing) so it can
-- be downloaded later. `r2_key` is the object key in DOCS_BUCKET.
ALTER TABLE doc_extracts ADD COLUMN r2_key TEXT;
ALTER TABLE kb_documents ADD COLUMN r2_key TEXT;
