# Backend and data

Read for handlers, validation, auth, projections, persistence, or infrastructure.

- Handlers: `backend/src/handlers/`; infrastructure/routes/IAM: `backend/template.yaml`. Reuse `backend/src/lib/db.js`, `response.js`, and `auth.js` instead of duplicating clients or response/auth logic.
- Preserve each endpoint's trust contract. Owner/DM verification protects profile/admin operations; session updates and player own-token movement intentionally permit unauthenticated requests under ADR-005. Do not add blanket authentication to all writes.
- Public reads must strip passwords and private information. `characterProjection.js`, `partyProjection.js`, and `initiativeProjection.js` centralize visibility/response shaping shared by one-shot and consolidated reads. Update the common helper when changing projected fields.
- Character and sentinel items share a DynamoDB table keyed by `slug`. `specialItems.js` is the source of sentinel constants/filtering; `specialRecords.js` owns sentinel normalization. Add new sentinels to filtering, and default/normalize new fields for existing records.
- Validate incoming bodies in handlers. Preserve unrelated fields when changing map records or nested arrays; inspect current conditional/update semantics before introducing another read-modify-write operation.
- `session.js` controls allowed session fields; adding a field can require coordinated defaults, validation, write behavior, and projections. New attributes also need backward-compatible handling, even though DynamoDB does not require a schema migration.
- Session writes notify through `broadcast.js`; notification failures must not fail the write. Grant only required SAM permissions to new handlers. S3 upload registration and deletion have separate failure paths; preserve their handling.
- `app-meta` is stamped by deployment, not ordinary gameplay handlers. WebSocket connections have a separate table with TTL.

Search [data model](../data-model.md), [backend reference](../backend-reference.md), or [ADRs](../decisions.md) for the affected record/decision. Treat inventories as orientation; verify exact contracts in current source and nearby tests.
