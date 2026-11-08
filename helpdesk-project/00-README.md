# Project Walkthrough: Claude-Powered IT Helpdesk Assistant

<!-- nav:start -->
> ⬅️ [[claude-dev-exam-prep/03-practice-exams|Practice exams]] · 🏠 [[claude-dev-exam-prep/Developer Exam Prep|Developer index]] · [[Claude Certifications|Home]] · [[claude-dev-exam-prep/helpdesk-project/01-requirements-and-design|Helpdesk: requirements]] ➡️
<!-- nav:end -->


An end-to-end build that applies every module of the Claude Certified Developer path to one realistic project: an **IT helpdesk assistant** that handles the four most common inquiry types:

| Inquiry family | Typical tickets |
|---|---|
| **Active Directory (AD) accounts** | Account locked out, account disabled, "am I in the right group?" |
| **Passwords** | Forgot password, password expired, MFA reset request |
| **Microsoft 365 / Office** | Outlook keeps asking for a password, Teams won't sign in, OneDrive not syncing, Excel crashes |
| **Network / firewall** | VPN won't connect, Wi-Fi drops, "site is blocked", request to open a firewall port |

The walkthrough grows the system in stages, from one prompt to a governed multi-tool agent, so you can see **which design decision each module is teaching and why**.

---

## File index (read in order)

| File | Stage | Course modules exercised |
|---|---|---|
| [01-requirements-and-design.md](01-requirements-and-design.md) | Business, ops, functional and infrastructure requirements; design doc; workflow vs agent | M1, M4 (design doc), M5 (requirements, lifecycle, platform) |
| [02-stage1-basic-prompt.md](02-stage1-basic-prompt.md) | One call: triage, structured output, FAQ answers, streaming | M1, M2 (prompting, structured outputs, thinking) |
| [03-stage2-tool-use-agent.md](03-stage2-tool-use-agent.md) | Multi-tool agent: KB search, AD status/unlock/reset, service status, ticket escalation, ops email | M2 (tools, loop, HITL, streaming), M4 (failure handling) |
| [04-mcp-integration.md](04-mcp-integration.md) | AD and ITSM as MCP servers; Claude Code for the ops team; API MCP connector | M2 (MCP), M3 (MCP, scopes, permissions, plugins) |
| [05-security-and-governance.md](05-security-and-governance.md) | Threat model, identity, least privilege, injection, hooks, audit, secrets, compliance | M3, M4 (security), M5 (trust boundaries) |
| [06-memory-design.md](06-memory-design.md) | Memory scope per conversation type, ticket store, summarizer, skills vs CLAUDE.md | M2 (context, memory, skills), M3 |
| [07-evaluation-and-testing.md](07-evaluation-and-testing.md) | Eval set, graders, judge calibration, adversarial cases, unit/functional/integration/E2E tests, tracing | M4 (evals, testing, failure) |
| [08-rpa-and-automation.md](08-rpa-and-automation.md) | RPA bridge (UiPath / Power Automate), mailbox triage, nightly batch, Claude Code headless runbooks | M1/M2 (batch, async), M3 |
| [09-deployment-cost-operations.md](09-deployment-cost-operations.md) | Platform, version pinning, routing, caching, cost model, monitoring, rollout gate, packaging | M4 (cost, model selection), M5 (deploy, versioning, packaging) |

---

## Target architecture

```
            ┌───────────── Channels ─────────────┐
 Employee → │ Teams bot / web portal (SSO)       │──┐
 Mailbox  → │ Power Automate / UiPath (RPA)      │──┤   identity = SSO token, never the model
 Ops team → │ Claude Code + MCP (terminal)       │  │
            └────────────────────────────────────┘  │
                                                    ▼
                         ┌────────────── helpdesk service (your network) ─────────────┐
                         │  triage (Stage 1: single call, structured output)          │
                         │  agent loop (Stage 2: tool use, max 8 turns, HITL)         │
                         │  POLICY GATE  ← deterministic, runs before every tool      │
                         │  AUDIT LOG    ← append-only, every tool call + decision    │
                         │  memory store (ticket-scoped, external DB)                 │
                         └───────┬──────────────┬──────────────┬──────────────┬───────┘
                                 ▼              ▼              ▼              ▼
                          AD (LDAPS)     Microsoft Graph   ITSM (ServiceNow)  SMS / email
                          svc account    service health    tickets, KB        temp password
                          scoped to OU   (read only)       escalation         goes OUT-OF-BAND
                                                    │
                                                    ▼
                                        Claude API (claude-opus-5-5)
```

**The single most important design rule in this project:** *the model decides **what** to do; deterministic code decides **whether it's allowed**.* Identity comes from the SSO session, password resets need an MFA step-up done by code, privileged accounts are blocked by code, and the temporary password never passes through the model.

---

## Code conventions used across files

- **Language:** Python 3.10+ with the official `anthropic` SDK (`pip install anthropic`). Each code block starts with a path comment such as `# helpdesk/agent.py`; together they form one package.
- **Model:** `claude-opus-5-5` (the current default; the ID alone pins the snapshot). Model routing to cheaper tiers is an **eval-gated decision** covered in file 09, not a default.
- **API facts for current models that the code relies on** (these updated the course material):
  - Thinking is always on for Opus 5.5. Control depth with `output_config={"effort": ...}`. The default effort is `medium`, so the code sets it explicitly. `budget_tokens` returns 400.
  - **Don't send `temperature`, `top_p` or `top_k`.** As of 2026-10-21 they return 400 on every model.
  - **Forced tool use** (`tool_choice` `any`/`tool`) returns 400 on Opus 5.5. Use `auto` with prompt steering and `strict: true`.
  - **No assistant prefill.** Use structured outputs (`output_config.format`) instead.
  - **Refusal fallbacks are enabled by default:** `client.beta.messages.create(..., betas=["server-side-fallback-2026-07-01"], fallbacks="default")`. This works on the Claude API and Claude Platform on AWS. On Bedrock, Vertex or Foundry, use the SDK middleware instead. The Batches API rejects it.
- **External dependencies** (installed only where used): `ldap3` (AD), `requests`, `msal` (Graph), `mcp` (MCP servers), `fastapi` and `uvicorn` (RPA bridge), `pydantic`, `pytest`.
- **How the code was checked (2026-11-03, `anthropic` SDK 2.3.0):** all 53 Python blocks were extracted into one package. Every block compiles, passes `pyflakes`, and every module imports. The SDK's signatures confirm the parameters used (`fallbacks`, `output_config`, `context_management`, `mcp_servers`, `cache_control`). The unit and integration tests in file 07 pass: **12 passed, 1 skipped**. The skipped one is the live end-to-end test, which needs an API key. The code has **not** run against a live model, AD, ServiceNow, Graph, MFA or SMS service; those need your endpoints, service accounts and approvals.

---
<!-- nav:start -->
> ⬅️ [[claude-dev-exam-prep/03-practice-exams|Practice exams]] · 🏠 [[claude-dev-exam-prep/Developer Exam Prep|Developer index]] · [[Claude Certifications|Home]] · [[claude-dev-exam-prep/helpdesk-project/01-requirements-and-design|Helpdesk: requirements]] ➡️
<!-- nav:end -->
