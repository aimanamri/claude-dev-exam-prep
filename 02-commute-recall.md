# Commute Recall Cards: Claude Developer Exam

<!-- nav:start -->
> ⬅️ [[claude-dev-exam-prep/01-full-study-notes|Full study notes]] · 🏠 [[claude-dev-exam-prep/Developer Exam Prep|Developer index]] · [[Claude Certifications|Home]] · [[claude-dev-exam-prep/03-practice-exams|Practice exams]] ➡️
<!-- nav:end -->


Short and phone-friendly. Read one block per stop.

---

## The 1 idea behind every module
**Dev hides it, prod reveals it.** The fix is always a decision you make *before* shipping: a constraint, a gate, a pin, a boundary.

---

## M2: Prompting, Agents, Tools

**Prompt failed? Name it, then add ONE thing**
- Wrong shape → **output constraint**
- Drifts over turns → **system prompt**
- Invented structure → **few-shot**
- Breaks on an edge case → **constraint for that variant**
- 3 failed re-prompts → **stop adding words, diagnose**
- Long prompt → long output → slow

**Structured outputs: two switches**
- **Answer shape** → `output_config` › `format` › `{"type": "json_schema", "schema": {...}}`
- **Tool args** → tool `{"name", "description", "strict": True, "input_schema": {...}}`
- Answer → parse the **text** block · tool args → **`block.input`**

**What goes inside a schema (both cases)**
```
"type": "object",
"properties": { "field": {"type": ..., "description": ...} },
"required": [...],
"additionalProperties": False
```
- `type` = object · array · string · integer · number · boolean · null
- `enum` = allowed values (a keyword, **not** a type)
- `minimum` / `maximum` / `minLength` → **not enforced**; validate in code
- `properties` sit **inside** `schema`, not next to it
- `strict` sits **beside `name`**, not inside `input_schema`
- Required only what's essential (everything required → fabricated values)

**Gotchas**
- First call slow (grammar compile, cached 24 h); keep schemas stable
- Check `stop_reason` first: **refusal / max_tokens**
- ✗ prefill · ✗ citations · ✗ forced `tool_choice` (400 on current models)

**Extended thinking**
- ON for: multi-step reasoning, planning. OFF for: classify, extract, format
- Tune **effort**; `budget_tokens` → **400** on new models
- Thinking tokens cost the same as output tokens
- **Return thinking blocks UNCHANGED** (signature). Redacted ones too. Never strip them.

**Tool loop**
- Claude picks; **YOUR code runs the tool**
- Every `tool_use` → `tool_result` with the **same id** in the **very next user turn**
- tool_result goes in the **user** role
- Keep text + tool_use together in history
- Description = **when to use + when NOT to use**
- Everything marked required → Claude fabricates values
- Dependent calls → separate turns; `disable_parallel_tool_use`
- Can't separate two tools → merge them with a `type` param

**Streaming: order of events**
`message_start → content_block_start → content_block_delta → content_block_stop → message_delta (stop_reason) → message_stop`
- Parse tool JSON only after **content_block_stop**
- Save the turn only after **message_stop**
- Dropped stream → **discard and retry**
- Error on a retry? Suspect a half-saved stream first

**Context**
- Tool outputs in prod run **3–5×** dev size → full by turn 8
- Tool picks get worse after N turns → **context first**, not schema
- Prune (rewind) / Compact (summarize) / Clear (new task) / Subagent (isolated)
- Summarizer must keep **files, decisions, errors + fixes**
- `cache_control: ephemeral`, **max 4 breakpoints**
- `count_tokens` = measure without inference
- Too big → validation error. Hits ceiling mid-generation → `model_context_window_exceeded`. **Never silent truncation.**

**Models**
- Start **Sonnet** → up to Opus / down to Haiku **only on eval evidence**
- Fable > Opus > Sonnet > Haiku

**Agents**
- Can enumerate the steps? → **workflow**. Only know the goal? → **agent**
- Call → workflow → agent (simplest first)
- 3 paths: raw loop / **Agent SDK** (your process) / **Managed Agents** (Anthropic runs it)
- Managed Agents = stored server-side → **no ZDR, no HIPAA BAA**
- **HITL before an irreversible action.** Ask: "Worst outcome with no human?"
- Define **exit conditions**
- Over-tooling > under-tooling. Start minimal.
- EU residency → **Bedrock/Vertex, region pinned** (direct API has no EU residency)
- Claude Enterprise on AWS Marketplace ≠ FedRAMP

**Memory**
- Daily returning user → **external DB**
- One-shot job → **stateless**
- One long session → **in-context**
- Too long for the window → **summarized**
- Decide at **design time**

**Skills**
- Only name + description load up front; body loads on a match
- API Skills: `code-execution-2025-08-25` + `skills-2025-10-02`
- Subagents **don't** inherit skills or history, **do** inherit permissions

**Multimodal / Batch**
- Image tokens = **⌈w/28⌉ × ⌈h/28⌉** → 1000² ≈ **1,296**
- One-off → base64 · stable public → URL · reused → **Files API** (beta, not on Bedrock/Vertex)
- PDF = `"type": "document"` (title is optional)
- Batches: **100k requests or 256 MB**, ≤**24 h**, cheaper, match results by **custom_id**
- Sync calls in a loop ≠ batching

---

## M3: Claude Code & MCP

**Permission modes (safest → riskiest)**
- `plan`: read only, no edits until the plan is approved
- `default`: asks on every edit or command
- `acceptEdits`: edits + rm/mv/cp/mkdir/sed **inside the working dir**; other shell still prompts
- `auto`: a classifier checks each action (research preview)
- `dontAsk`: allow-list only, **auto-deny the rest** → **CI**
- `bypassPermissions`: no checks, no protected-path guard → **disposable VM only**

**Settings**
- `~/.claude/settings.json` (user) · `.claude/settings.json` (team) · `.claude/settings.local.json` (personal, gitignored) · `managed-settings.json` (enterprise, locked)
- **Deny beats allow, always.** Enterprise deny still holds under bypass.
- deny > ask > allow

**Context mechanisms**
- **CLAUDE.md**: every session; bloat dilutes it. `/init` makes a starter.
- **Rules** `.claude/rules/*.md` + `paths:` frontmatter → loads only for matching files (no paths = always loads)
- **Hook**: deterministic. **PreToolUse can block (exit 2, reason on stderr).** PostToolUse can't block (formatter, audit).
- Other hooks: UserPromptSubmit, Stop, Notification (permission / 60 s idle), SessionStart, SessionEnd
- **Subagent**: clean context. **Explore/Plan skip CLAUDE.md**; general-purpose loads it.

**Packaging**
- Skill in `.claude/skills/`; description = trigger
- Explicit-only skill → `disable-model-invocation: true`
- `.claude/commands/` = legacy
- Plugin = skills + hooks + subagents + MCP servers
- Plugin `payments` + cmd `run-tests` → `/payments:run-tests`
- `/plugin marketplace add owner/repo`
- Enterprise: allowlist + `extraKnownMarketplaces`
- Paths: `$CLAUDE_PROJECT_DIR`, `${CLAUDE_PLUGIN_ROOT}`. ✗ No `/Users/...`, ✗ no `~/`
- Document env vars; test on a clean machine
- SDK skill does nothing → **settingSources**

**MCP**
- Exposes tools · resources (data the client pulls) · prompts (templates)
- stdio = local · **HTTP = remote/shared** · SSE = legacy
- Scopes: Local (`~/.claude.json`) · User · **Project (`.mcp.json`)** · Enterprise
- Team server → **HTTP + project**
- Secret → `"Bearer ${TOKEN}"`. Committed key = **rotate** (it stays in git history)
- One tool only: `mcp__github__create_issue`
- `enabled` = can the model see it · permission rule = may it run
- Claude Code defers MCP tool definitions by default (up-front if they fit in ~10% of the window)
- GitHub = PAT header · Linear = OAuth

**Caching**
- Order: tools → system → messages
- 5 min default · `ttl: 1h` opt-in · min ~**1,024** tokens
- One changed char = cache miss

**Enterprise auth**
- User identity → **OAuth** (401 → browser)
- Service → **API key in env** (CI injects it)
- Local → filesystem perms + deny rules
- Audit → **PostToolUse hook**. Lock config → **managed settings**
- OAuth OK in staging, fails in prod → **register the prod redirect URI**

---

## M4: Evals, Failure, Cost, Security

**Design doc (before code)**: success criteria · failure handling · cost/latency budget · trust boundary

**Graders**
- One right answer → **exact match**
- JSON/code → **code check**
- Open-ended → **LLM judge**: reasoning before score, **calibrate vs human labels**
- Judge always says ~6? → ask for strengths/weaknesses/reasoning first
- Change **one** thing at a time. Read **per-case** results.
- Coverage > perfection
- Validation checks shape, not truth (two-dates bug)

**Tests**
- Unit · Functional (one call) · **Integration (the seam: most silent bugs live here)** · E2E
- Trace = which step broke

**Errors**
- Retry: **429, 529, 500, 502, 503, 504**
- Don't retry: **400, 401, 403, 404**
- Unsure → terminal
- Honor **retry-after** → else exponential backoff + jitter + cap
- ✗ `sleep(0)` loops ✗ stacking your retries on the SDK's
- Tool failed → `is_error: true` (never empty)
- **Refusal = HTTP 200** + `stop_reason: refusal` → fail fast

**Cost**
- Log **tokens, latency, errors** on every call
- Cache write **1.25×** (5 m) / **2×** (1 h), read **0.1×**
- Batch (~50% off) + cache **stack** for scheduled jobs
- Multi-agent ≈ **15× tokens**; only for **parallel, independent** work, never coupled coding
- Big lead model, small workers
- **Set the reliability floor first**, then cut cost

**Security**
- Model sees **one token stream**: no built-in trusted zone
- Injection arrives via **content**, not the user
- Fetched content = **DATA**
- The real boundary = **what the agent may DO**
- Least privilege; secrets in env or a vault; protect the auth config
- Hook = control. Prompt = wish.
- OS sandbox = last line (filesystem + network)
- Confirm ZDR per model and platform

---

## M5: Accelerators & Deployment

**Package for reuse**
- Parameters + defaults · assumptions doc · bundled **eval** · bundled **audit** info
- Package while it's fresh
- Hardcoded repo path → `def build(repo_path)`

**Contribute**
- Focused pattern → **Cookbook**. Tool/fix → **its own repo**. Full app → strip it down first
- Needs: does one thing · example · **test** · assumptions
- **Rights/licence check comes before code review**
- Can't clear rights → escalate

**Requirements**
- Functional = checkable behavior
- Infra = **latency, scale, residency, identity**
- Lifecycle: Req → Design → Build → Test → Deploy → Operate → Iterate
- Region decision = **requirements** · platform choice = **design** · pin + eval gate = **deploy** · metrics = **operate**

**Platforms**
- No constraint, wants the newest features → **1st-party API**
- AWS + data inside AWS → **Bedrock** (`/anthropic/v1/messages`, `anthropic.` prefix)
- AWS + Anthropic IDs/lifecycle → **Claude Platform on AWS** (inference outside the AWS boundary)
- GCP → **Vertex**
- EU-only residency → **Bedrock/Vertex regional**
- Foundry: Azure-hosted (Opus 4.8, Sonnet 5, Haiku 4.5) vs Anthropic-hosted

**Versioning**
- **Pin the full model ID**, not an alias
- Claude 4.6+: ID alone pins; older models need the date suffix
- Keep the previous version → rollback
- Eval gate before promoting (canary)

**Compare platforms**
- Latency from the **customer's region**
- Compliance = pass/fail → decide early
- Cost = **total** (egress, fees, integration), not token price

**Trust boundaries**
- Mark **every seam**
- Fetched → `treat_as_data`
- MCP server → `least_privilege_read_only`
- As safe as the **most privileged seam**
- Can't secure it → human owner

---

## Numbers flash list
28 px patch · 1,296 tokens (1000²) · 100k requests / 256 MB · 24 h batch · 24 h grammar cache · 5 m / 1 h cache TTL · 4 breakpoints · 1,024 min cache tokens · 1.25× / 2× / 0.1× · 15× multi-agent · ~10% MCP up-front · 3–5× prod tool output · 200k / 1M context · exit code 2 · 60 s idle notification · 3 failed re-prompts → diagnose

## Header flash list
`mcp-client-2025-11-20` · `code-execution-2025-08-25` · `skills-2025-10-02` · `managed-agents-2026-04-01`

---
<!-- nav:start -->
> ⬅️ [[claude-dev-exam-prep/01-full-study-notes|Full study notes]] · 🏠 [[claude-dev-exam-prep/Developer Exam Prep|Developer index]] · [[Claude Certifications|Home]] · [[claude-dev-exam-prep/03-practice-exams|Practice exams]] ➡️
<!-- nav:end -->
