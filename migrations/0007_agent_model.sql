-- Per-organization choice of which LLM powers the finance assistant.
-- NULL = the deployment default (see agent.server.ts resolveModel).
ALTER TABLE organizations ADD COLUMN agent_model TEXT;
