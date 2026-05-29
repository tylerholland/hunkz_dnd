# Story 25 — World Guide

**Status**: Iceboxed
**Source**: User direction — exploratory

---

## Context

The DM runs a non-standard Greyhawk / World of Flaeness setting and has provided players with an extensive guidebook covering kingdoms, rulers, economies, factions, and political history. Players can't realistically internalize it all, and mid-session lookups ("who rules this kingdom again?", "what's the relationship between these two factions?") currently mean breaking the flow to dig through a large document. An in-app world guide would let players pull context without leaving the table.

The guide is already well-structured with a clear table of contents, so a two-phase approach makes more sense than jumping straight to an AI layer.

---

## Goal

Give players (and the DM) an in-app reference for the campaign world — first as a browsable document, then optionally with a question-answering agent layered on top.

---

## User stories

1. **As a player**, I want to browse the world guide in the app so I can look up kingdoms, rulers, and factions during a session without opening a separate document.

2. **As a player**, I want a table of contents I can navigate so I can jump directly to a relevant section rather than scrolling through the whole guide.

3. **As a player** (phase 2), I want to ask a plain-language question about the world and get a concise answer drawn from the guide, so I can get context quickly without having to skim.

4. **As the DM**, I want to control which content is visible to players, so sensitive plot information stays hidden until it's revealed.

---

## Phased approach

### Phase 1 — Browsable markdown guide (manual, no AI)

Convert the PDF guidebook to a set of structured Markdown files. The DM uploads or provides them; the app serves them as a navigable reference.

- Parse the guide's existing TOC structure into a sidebar/index component.
- Render selected sections as formatted markdown in a reading pane.
- Content stored in S3 (or bundled at build time if the guide is stable).
- No AI, no vector store, no external API calls — just a document viewer.
- New route `/guide` or accessible as a tab on the DM dashboard and character sheet.

**Effort**: ~1 day. Mostly a markdown renderer + sidebar nav component.

### Phase 2 — Q&A agent layer (RAG, additive)

Add a question input to the guide view. Player types a question; a Lambda retrieves the most relevant chunks via vector similarity and passes them to Claude for a grounded answer.

Architecture (from architect feasibility brief):
- One-time ingestion script: chunk markdown files into ~500-token segments, generate embeddings via Voyage AI (`voyage-3-lite`), store as a JSON blob on S3.
- New Lambda `POST /world/query`: loads embeddings blob (cached in module scope after first cold start), cosine-ranks in-memory, passes top 5-8 chunks + question to Claude Haiku, returns answer + source headings.
- Frontend: chat-style transcript stored in `sessionStorage` (ephemeral, no server persistence needed).

**Effort**: ~0.5–1 additional day after Phase 1. Phase 1 markdown structure makes Phase 2 chunking straightforward.

**Cost**: ~$0.50/month at ~240 queries/month (Claude Haiku + Voyage embeddings).

---

## Data model

**Phase 1**: Markdown files in S3 (or `public/` at build time) + a TOC manifest JSON describing section titles and file paths.

**Phase 2**: Embeddings blob in S3 (`world-guide-embeddings.json`). New Lambda `worldQuery`. No DynamoDB changes.

---

## Out of scope (both phases)

- DM ability to edit guide content in-app. The guide is authored externally and imported.
- Per-player access controls beyond a simple DM-visible / player-visible flag.
- Real-time streaming responses (Phase 2). Single-shot Lambda response is sufficient.
- Multi-guide support. One campaign world, one guide.

---

## Architect feasibility notes

_Captured from exploratory discussion — not a full architect review._

- **Phase 1** is a standard static content viewer. No infrastructure complexity.
- **Phase 2** does not need Bedrock Knowledge Bases or OpenSearch. At guidebook scale (~few thousand chunks), cosine similarity over an in-memory S3-loaded blob is fast enough (~10ms) and costs nothing to run.
- Bedrock KB would cost ~$70/month idle just for the OpenSearch backing store. Skip it.
- Chunking quality matters more than any infrastructure choice. The guide's existing section structure makes this easy — headings become metadata for hybrid retrieval.
- Only new external dependency: Voyage AI for embeddings. Can swap to AWS Bedrock Titan embeddings if AWS-native is required.
- Pin the Phase 2 system prompt to "answer only from provided context; say 'not in the guide' otherwise" — most important prompt-engineering step to prevent hallucination.
