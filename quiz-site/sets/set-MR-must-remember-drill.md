---
title: Must-Remember Drill
minutes: 30
shuffle: always
description: 35 rapid-recall items built from every **MUST REMEMBER** block in the study notes. Question and option order are re-shuffled on every attempt, so retake it daily until you score 100%.
---
# SET MR (must-remember drill)

Short recall questions. Questions and options are shuffled on every attempt. Items tagged #core are the ten facts that also repeat in mock Sets E–H.

## M1 Foundations

**MR1.** A request's input is already larger than the context window. What happens? #core
- A. The oldest turns are silently dropped
- B. A validation error before generation begins
- C. Partial output with `model_context_window_exceeded`
- D. The window expands automatically

**MR2.** The input fits, but generation reaches the context-window ceiling. What happens? #core
- A. A 400 error
- B. The oldest turns are dropped and generation continues
- C. The output so far is returned with `stop_reason: model_context_window_exceeded`, and no error is raised
- D. The request is retried automatically

**MR3.** What does `temperature=0` guarantee (on a model that accepts it)? #core
- A. More repeatable output, but NOT guaranteed identical output
- B. Byte-identical output on every call
- C. Shorter output
- D. Higher accuracy

**MR4.** What happens when you send a non-default `temperature`, `top_p` or `top_k` to one of the newest models? #core
- A. It's silently ignored
- B. It's clamped to the default
- C. It works only when streaming
- D. It returns a 400; steer through the prompt instead

**MR5.** What happens to `budget_tokens` on the newest model generations?
- A. It's required for thinking
- B. It's deprecated and returns a 400; use adaptive thinking tuned with effort
- C. It caps output tokens
- D. It sets the cache TTL

**MR6.** By default, what do the newest models do with thinking content in the response?
- A. They omit it; request summarized display to see it
- B. They return it in full
- C. They return it encrypted only
- D. They return it as a separate message

**MR7.** How are thinking tokens billed?
- A. Free
- B. As input tokens
- C. The same as output tokens
- D. At the cache-read rate

**MR8.** Which statement about few-shot examples is TRUE?
- A. They retrain the model after enough calls
- B. They lower the cost per call
- C. Only temperature changes the output shape, not examples
- D. They aren't training data; they're sent, and billed, on every call

**MR9.** How do you make non-blocking calls with the TypeScript SDK?
- A. `await` the standard Promise-based `Anthropic` client
- B. Import `AsyncAnthropic`
- C. Use the Batches API
- D. Use raw REST only

**MR10.** What are the Message Batches API limits per batch?
- A. 1,000 requests or 10 MB, completing within 1 h
- B. Up to 100,000 requests or 256 MB, completing within 24 h
- C. Unlimited, completing within 7 days
- D. 10,000 requests, completing in real time

**MR11.** How do you match batch results to their inputs?
- A. By result order
- B. By timestamp
- C. By `custom_id`, because results arrive in arbitrary order
- D. By `tool_use_id`

**MR12.** About how many tokens does a 1000 × 1000 pixel image cost?
- A. 1,000
- B. 784
- C. 4,000
- D. 1,296 (⌈1000/28⌉ × ⌈1000/28⌉ = 36 × 36)

## M2 Prompting, Agents & Tool Use

**MR13.** Where must a `tool_result` go? #core
- A. In the immediately following user turn, with the same id as its `tool_use`, alongside the results for every other `tool_use` from that turn
- B. In the next assistant turn
- C. Anywhere later in the conversation
- D. In the system prompt

**MR14.** When is it first safe to parse a streamed `tool_use` block's input? #core
- A. On `content_block_start`
- B. After `content_block_stop` for that block's index
- C. On the first `input_json_delta`
- D. On `message_start`

**MR15.** When should a streamed assistant turn be appended to history? #core
- A. As soon as the first delta arrives
- B. When the read loop exits
- C. Only after `message_stop`; on interruption, discard the partial turn and retry from the last complete turn
- D. After `content_block_start`

**MR16.** With thinking plus tools, what must happen to thinking blocks? #core
- A. Summarize them to save context
- B. Drop the redacted ones
- C. Keep only the latest one
- D. Return every one unchanged (redacted ones too), because each carries a verified signature

**MR17.** Tool selection degrades only after N turns. What should you suspect first? #core
- A. The context window filling up; prune tool outputs and compact
- B. The tool descriptions
- C. `max_tokens`
- D. Temperature

**MR18.** What is the maximum number of prompt-cache breakpoints?
- A. 1
- B. 4
- C. 8
- D. Unlimited

**MR19.** What is the default prompt-cache TTL?
- A. 24 h
- B. 1 h by default
- C. 5 minutes, refreshed on each read (`ttl: "1h"` is opt-in)
- D. No expiry

**MR20.** What do prompt-cache writes and reads cost?
- A. Both cost 1×
- B. Writes 0.1×, reads 1.25×
- C. Writes 2×, reads 2×
- D. Writes 1.25× (5-min TTL) or 2× (1-h TTL); reads 0.1× base input

**MR21.** What is the correct nesting to enable JSON outputs?
- A. `output_config` → `format` → `type: "json_schema"` + `schema`
- B. `format` → `output_config` → `json_schema`
- C. `tools` → `json_schema`
- D. `system` → `schema`

**MR22.** What value must `additionalProperties` have in a JSON-outputs or strict-tool schema?
- A. `true` on the root object only
- B. `false`, on every object
- C. Omitted
- D. `"strict"`

**MR23.** Which beta header does the API MCP connector (`mcp_toolset`) need?
- A. `skills-2025-10-02`
- B. `managed-agents-2026-04-01`
- C. `mcp-client-2025-11-20`
- D. `code-execution-2025-08-25`

**MR24.** Which statement about Claude Managed Agents is TRUE?
- A. They run the loop in your process
- B. They're eligible for ZDR and HIPAA BAA
- C. They need no beta header
- D. They use the `managed-agents-2026-04-01` header and store sessions server-side, so they're not ZDR or HIPAA-BAA eligible

**MR25.** What controls whether the Agent SDK loads CLAUDE.md and skills?
- A. `settingSources` (TS) / `setting_sources` (Python), set explicitly
- B. The `skills-2025-10-02` header
- C. Always loaded by default
- D. `disable-model-invocation`

**MR26.** What is the course's progression for choosing an architecture?
- A. Agent → workflow → single call
- B. Single API call → workflow → agent, moving up only when the simpler pattern fails
- C. Always start with multi-agent
- D. Workflow only

## M3 Claude Code, MCP & Integration

**MR27.** What is the precedence for permission rules, and which control is the most durable? #core
- A. allow > ask > deny; user settings
- B. ask > deny > allow; project settings
- C. deny > ask > allow; an enterprise managed deny holds even under `bypassPermissions`
- D. The last rule written wins

**MR28.** How does a hook block a tool call? #core
- A. A `PostToolUse` hook that exits 1
- B. A `Stop` hook that exits 2
- C. A CLAUDE.md rule
- D. A `PreToolUse` hook that exits with code 2 and writes the reason to stderr

**MR29.** Which built-in subagents skip CLAUDE.md and git status?
- A. Explore and Plan (general-purpose loads both)
- B. General-purpose only
- C. All subagents
- D. None

**MR30.** How should a shared team MCP server be configured?
- A. stdio, local scope
- B. HTTP transport, project scope (`.mcp.json` at the repo root), with secrets referenced as `${ENV_VAR}`
- C. HTTP, with the key written inline in `.mcp.json`
- D. SSE, at user scope

**MR31.** An API key was committed, then replaced with `${VAR}` in a later commit. What must happen?
- A. Nothing
- B. Make the repository private
- C. Rotate the key, because it's still in repository history
- D. Add a README note

## M4 Production Engineering, Evals & Security

**MR32.** Which status codes are retriable? #core
- A. 400, 401, 403, 404
- B. 200 refusals
- C. Every status code
- D. 429, 529, 500, 502, 503, 504

**MR33.** What is a refusal, and how should it be handled? #core
- A. HTTP 200 with `stop_reason: "refusal"`; fail fast, raise and log, and don't retry
- B. HTTP 403; retry with backoff
- C. HTTP 529; retry
- D. HTTP 400; retry once

**MR34.** What is the token cost of orchestrator-worker, and when does it fit?
- A. About 2× a chat; use it for any task
- B. About 15× a chat; only for tasks that split into independent parallel parts
- C. The same as a chat
- D. About 15× a chat; best for tightly coupled coding work

## M5 Accelerators & IP Contribution

**MR35.** What is the course's model-versioning rule? #core
- A. Use aliases so fixes arrive automatically
- B. Pin the major version only
- C. Pin the full model ID (from Claude 4.6 the ID pins a snapshot; earlier models need the date suffix), keep the prior version, and promote through the eval
- D. Re-pin weekly

---

# ANSWER KEY & REASONING

## Set MR answers

**MR1 – B.** Oversized input fails validation before generation. Never silent truncation.

**MR2 – C.** Fits but hits the ceiling → partial output plus `model_context_window_exceeded`, with no error. The app must trim or summarize.

**MR3 – A.** Sampling is probabilistic; temperature 0 concentrates probability but never guarantees identical output.

**MR4 – D.** The newest models reject non-default sampling parameters with a 400.

**MR5 – B.** `budget_tokens` is deprecated (400 on the newest). Use `thinking={"type": "adaptive"}` and tune depth with effort.

**MR6 – A.** Thinking content is omitted by default on the newest models; request summarized display.

**MR7 – C.** Thinking tokens cost the same as output tokens.

**MR8 – D.** Examples live in the prompt only; nothing is retrained or carried over.

**MR9 – A.** TypeScript has no `AsyncAnthropic`; the standard client is Promise-based.

**MR10 – B.** 100,000 requests or 256 MB, whichever comes first; completes within 24 h (often sooner) at a lower per-token cost.

**MR11 – C.** Results come back in arbitrary order; match them with `custom_id`.

**MR12 – D.** Images are cut into 28 × 28-pixel patches: 36 × 36 = 1,296 tokens.

**MR13 – A.** The pairing invariant. A missing, mismatched or late result → `invalid_request_error`.

**MR14 – B.** `content_block_stop` is the first moment tool_use JSON can be parsed.

**MR15 – C.** A stream ending isn't the same as a message completing.

**MR16 – D.** The carry-back rule. Stripping thinking blocks to save context is the most common slip.

**MR17 – A.** Accumulated tool output crowds out the system prompt and instructions. Wrong tool *every* time → descriptions.

**MR18 – B.** Up to 4 breakpoints; `cache_control: {"type": "ephemeral"}` on the last block you want cached.

**MR19 – C.** 5-minute default TTL, refreshed on each read; `ttl: "1h"` for longer gaps. Minimum cacheable length is ~1,024 tokens.

**MR20 – D.** Caching only pays off when reads outnumber writes.

**MR21 – A.** `properties`, `required` and `additionalProperties` sit inside `schema`.

**MR22 – B.** `additionalProperties: false` on every object; no other value is supported.

**MR23 – C.** `mcp-client-2025-11-20`. The connector reaches remote HTTP servers only.

**MR24 – D.** Managed Agents: Anthropic runs the loop and sandbox; skills attach to the agent resource definition.

**MR25 – A.** Classic failure: a skill works in Claude Code but does nothing in the SDK because `settingSources` was never set.

**MR26 – B.** Ask whether the problem needs an agent at all; move up only when the simpler pattern fails.

**MR27 – C.** A deny always beats an allow, in any mode. Enterprise managed settings can't be overridden.

**MR28 – D.** Only `PreToolUse` can block. `PostToolUse` is for formatters, tests and audit logs.

**MR29 – A.** If project rules must apply, use general-purpose or a custom subagent.

**MR30 – B.** Shared team server → HTTP + project scope; never commit keys.

**MR31 – C.** Overwriting the file doesn't remove the key from history; treat it as compromised and rotate it.

**MR32 – D.** Retriable: 429, 529, 5xx. Terminal: 400, 401, 403, 404. When unsure, treat as terminal.

**MR33 – A.** A status-code classifier won't catch a refusal; check `stop_reason`.

**MR34 – B.** Token usage explains most of the performance variance. Not for tightly coupled work like coding (D).

**MR35 – C.** Aliases move; a pinned prior version turns a regression into a rollback.
