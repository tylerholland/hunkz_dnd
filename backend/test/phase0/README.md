# Phase 0 test suite (red until built)

Tests for [phase 0 of the multi-campaign plan](../../../design/architecture/multi-campaign-plan.md),
written before the code. Run them with:

```
npm run test:phase0
```

They're kept out of `npm test` on purpose: most fail until their step is
built. When a step's file passes, move it next to the code it tests (and its
helpers to a shared test folder) so the main suite guards it from then on.

| File | Step | Builds |
|---|---|---|
| `00-fake-dynamo`, `00-golden` | — | pass today: the DynamoDB fake, and today's `/session-state` responses still matching `golden/` |
| `0.1-store-contract` | 0.1, 0.3 | `backend/src/lib/store.js`: `createMemoryStore`, `createDynamoStore`, `setStore` |
| `0.2-broadcast` | 0.2 | `backend/src/lib/broadcast.js`: `createBroadcaster`, `connectionRecord` |
| `0.3-keys`, `0.3-table` | 0.3 | `backend/src/lib/keys.js`; `GameTable` and the connections index in `template.yaml` |
| `0.4-migration` | 0.4 | `backend/src/lib/migration/campaignMigration.js`: `planMigration` |
| `0.4-session-state` | 0.1–0.4 | `getSessionState` through the store returns exactly the golden responses |
| `0.5-routes`, `test/phase0/apiPaths.spec.js` | 0.5 | `/c/{campaignId}` and `/libraries/{libraryId}` route twins, `lib/campaign.js`, `src/lib/apiPaths.js` |
| `0.6-uploads` | 0.6 | `backend/src/lib/uploads.js`: `uploadKey`; bucket policy |
| `0.7-cleanup` | 0.7 | nothing new: the old table access, Scans, archive ring and unscoped routes are gone; docs updated |

## Rules the tests assume

- **Injected database.** The store and broadcaster take `{ db, commands }`
  (the Document client and its command classes), so tests can pass the fake
  in `helpers/fakeDynamo.cjs`. The AWS SDK isn't installed locally (Lambda
  provides it), so require it lazily, only in the default instances.
- **The fake's limits are the store's limits.**
  - Commands: Get, Put, Delete, BatchGet ≤ 100 keys, BatchWrite ≤ 25,
    Query, TransactWrite. No UpdateCommand and no FilterExpression.
  - Conditions: `attribute_not_exists` / `attribute_exists` / `x = :v`,
    joined with AND/OR.
  - Items ≤ 400 KB.
  - See the header of `fakeDynamo.cjs`.
- **Table shape.** The game table is `PK`/`SK` with index `GSI1` (`GSI1PK`/`GSI1SK`). The
  connections table has an index `campaign` on `campaignId`.
- **Versions** follow ADR-030. A stale `expectedVersion` throws
  `VersionConflictError`; `0` means "must not exist yet".
- **Golden files.** If `getSessionState`'s output changes *before*
  phase 0 starts, `00-golden` fails. Recapture with
  `node backend/test/phase0/helpers/captureGolden.cjs` and review the diff.
