# IntelMapper TODO

## Database & Schema
- [x] searches table (id, query, type, status, createdAt)
- [x] entities table (id, name, type, data JSON, updatedAt)
- [x] relationships table (sourceId, targetId, type, data JSON)
- [x] subscriptions table (id, entityId, entityName, notifyOn, createdAt)
- [x] cached_responses table (id, source, key, data JSON, expiresAt)

## Backend API (tRPC Routers)
- [x] search.initiate — kick off parallel OSINT data collection
- [x] search.status — poll progress of running search
- [x] search.history — list past searches
- [x] entity.getProfile — return compiled dossier for entity
- [x] entity.getGraph — return relationship graph nodes/edges
- [x] entity.getFilings — return SEC filing history
- [x] entity.export — export profile/graph as JSON or CSV
- [x] subscriptions.create — subscribe to entity changes
- [x] subscriptions.list — list active subscriptions
- [x] subscriptions.delete — remove subscription
- [x] intel.analyze — LLM analysis of collected data

## OSINT Integrations (Backend)
- [x] SEC EDGAR API (data.sec.gov) — company filings, officers
- [x] OpenCorporates API — company registry data
- [x] FEC API — campaign finance records
- [x] WHOIS / RDAP — domain registration data
- [x] DNS / Certificate Transparency — domain intelligence
- [x] Wikipedia / Wikidata — public entity data
- [x] OpenSanctions — sanctions and PEP data
- [x] BGPView — IP/ASN infrastructure
- [x] Crtsh — certificate transparency
- [x] ProPublica Nonprofit Explorer API
- [x] USASpending.gov API — federal contracts/grants
- [x] Google Knowledge Graph API

## Frontend Pages & Components
- [x] Home page — dark landing with 4-quadrant search cards (Deep Research, Build a Profile, Investigate a Domain, Monitor & Alerts)
- [x] Search results page — real-time streaming progress + results panel
- [x] Entity profile page — dossier with tabs (Overview, Filings, Relationships, Domains, Financials, Contributions)
- [x] Graph visualization page — D3.js force-directed relationship graph
- [x] Subscriptions/Monitor page — manage entity alerts
- [x] Export modal — JSON/CSV download
- [x] Search history page

## UI/UX
- [x] Dark theme (near-black background, cyan/blue accents)
- [x] Animated search progress with source-by-source status
- [x] Responsive layout
- [x] Graph node click → open profile panel
- [x] Drill-down navigation between entities

## Tests
- [x] 18 vitest tests covering all routers (search, entity, subscriptions, intel, auth)
- [x] All tests passing

## Bug Fixes (Round 2 — Surgical)
- [x] Add unique constraint on search_progress(searchId, source) to enable proper upserts
- [x] Fix upsertSearchProgress to use onDuplicateKeyUpdate (remove broken fallback INSERT)
- [x] Fix getSearchProgress to return rows ordered by id
- [x] Fix search.status router to deduplicate by source and expose allSources metadata
- [x] Fix SearchResults.tsx to merge allSources with progress so all 114 sources show from start
- [x] Fix SearchResults.tsx to use source as key (not id) and show label field
- [x] Fix completedCount to count failed as done (not stuck as running)
- [x] Verified: 114/114 sources complete, 0 running, 0 failed on Goldman Sachs search
