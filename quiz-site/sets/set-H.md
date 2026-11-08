---
title: Set H · Mock exam 4
minutes: 60
description: Pearson-style mock. 40 questions across M1–M5, heavier on hooks, auth, platforms and judgment calls. 10 **core** items repeat.
---
# SET H (mock exam 4)

Items tagged #core re-test the ten MUST-REMEMBER facts shared by Sets E–H. Unless an item says "Choose TWO", pick ONE answer.

## M1 Foundations

**H1.** A 50-turn agent never trims its history. At turn 47 the request's input is larger than the context window. What happens, and whose job was it to prevent it? #core
- A. The API summarizes older turns automatically; nobody needs to act
- B. The model returns partial output; the user must start a new chat
- C. The API drops the oldest turns; the platform team should raise the limit
- D. The request is rejected before generation; the application should have trimmed or summarized history

**H2.** *(Choose TWO.)* Which statements about sampling are TRUE? #core
- A. Identical inputs don't guarantee identical outputs, even at temperature 0
- B. Streaming makes output deterministic
- C. The newest models return 400 for non-default `temperature`, `top_p` or `top_k`
- D. Larger models are deterministic
- E. Temperature only affects response length

**H3.** A chat UI shows a blank screen for 12 seconds before the full answer appears at once. Which change addresses the user's complaint?
- A. Stream the response over server-sent events so text appears as it's generated
- B. Switch to the Batches API
- C. Use `AsyncAnthropic`
- D. Lower the temperature

**H4.** A demanding multi-step planning task needs the highest accuracy, and cost is secondary. Which combination does the course describe for this case?
- A. A smaller model with reasoning off
- B. A capable model with higher effort
- C. A capable model with reasoning off
- D. Any model with `budget_tokens` set high

**H5.** Where is extended thinking MOST likely to be wasted spend?
- A. Planning a dependent, multi-step migration
- B. Multi-hop logic across several documents
- C. Labeling short tickets into three categories
- D. An agent planning across several dependent tool calls

**H6.** Haiku gets the output structure wrong zero-shot; Sonnet gets it right. Volume is high and cost matters. What should the team try FIRST?
- A. Use Sonnet for everything
- B. Enable thinking on Haiku at maximum effort
- C. Raise Haiku's temperature
- D. Add two or three correct examples to Haiku's prompt and check it against the eval

## M2 Prompting, Agents & Tool Use

**H7.** Right after a tool call, the next request fails with `invalid_request_error: tool_result block references unknown tool_use_id`. What should you check FIRST? #core
- A. The tool's description, for overlap with other tools
- B. The `required` array in the input schema
- C. The tool_use / tool_result pairing: ids and turn order
- D. The model tier

**H8.** A thinking-plus-tools loop is running into context pressure. Which response is correct? #core
- A. Prune used tool results and compact, and keep returning every thinking block unchanged
- B. Strip older thinking blocks, because only the latest one is checked
- C. Replace thinking blocks with redacted placeholders
- D. Switch to `budget_tokens` to shrink the blocks

**H9.** A network blip cuts a stream midway through an assistant turn. Which recovery is correct? #core
- A. Keep the partial turn and ask the model to "continue"
- B. Discard the partial assistant turn and retry the request from the last complete turn
- C. Append the partial turn with `is_error: true`
- D. Restart the whole conversation from turn 1

**H10.** Which pairing of symptom → first check matches the course's debug table? #core
- A. Wrong tool picked every time → context window; wrong tool after turn N → descriptions
- B. Both cases → raise `max_tokens`
- C. Both cases → switch to a larger model
- D. Wrong tool picked every time → overlapping descriptions (add when-NOT); wrong tool only after turn N → context window filling (prune and compact)

**H11.** In an agent loop, a malformed argument to `issue_refund` would crash the function or trigger the wrong action. Which mechanism fits BEST?
- A. JSON outputs on the final answer
- B. Strict tool use: `"strict": true` on the tool, with arguments validated against `input_schema`
- C. A system-prompt line: "always send valid arguments"
- D. Prefilling the assistant turn

**H12.** A developer uses the SDK helper `client.messages.parse(..., output_format=Ticket)` with a Pydantic model. Where is the validated object?
- A. `response.parsed_output`
- B. `response.content[0].input`
- C. `response.stop_reason`
- D. `response.usage`

**H13.** *(Choose TWO.)* Which statements about tool use are TRUE?
- A. Claude executes tools on Anthropic's servers and returns the result
- B. Your code executes the tool and returns a `tool_result`
- C. If Claude returns text plus `tool_use` in one turn, append the whole content array to history
- D. `tool_result` blocks are sent in the assistant role
- E. Systematic wrong-tool calls are fixed by raising temperature

**H14.** A developer finished debugging the auth module and now starts an unrelated billing feature in the same Claude Code session. The old context keeps biasing suggestions. Which strategy fits?
- A. Compaction, to keep a summary of the auth work
- B. Rewind to an earlier message
- C. Clear the context (`/clear`), persisting anything that matters (e.g. in CLAUDE.md) first
- D. Hand the billing work to a subagent

**H15.** Which beta headers are required to use Skills through the Messages API?
- A. `mcp-client-2025-11-20` only
- B. `managed-agents-2026-04-01`
- C. `skills-2025-10-02` only
- D. `code-execution-2025-08-25` and `skills-2025-10-02`

**H16.** A custom subagent in `.claude/agents/reviewer.md` never uses the team's `code-review` skill, although the main session does. What is the fix?
- A. List the skill explicitly in the subagent's configuration (frontmatter); subagents don't inherit skills
- B. Copy the skill text into CLAUDE.md
- C. Switch the subagent to `bypassPermissions`
- D. Rename the skill to match the subagent

**H17.** The same 40-page PDF manual is referenced in every turn of many sessions on the first-party API. Which input method fits?
- A. Inline base64 on every request
- B. Upload it once with the Files API and reference the `file_id` (a beta feature, not available on Bedrock or Vertex)
- C. A signed URL that expires in 5 minutes
- D. Paste the text into the system prompt with no caching

**H18.** Batch results come back and the pipeline writes them to the wrong input rows. What is the cause?
- A. The batch exceeded 24 hours
- B. Batches are deterministic, so the model changed
- C. Batch results arrive in arbitrary order; match them to inputs by `custom_id`
- D. The batch exceeded 256 MB

## M3 Claude Code, MCP & Integration

**H19.** A teammate's `.claude/settings.local.json` allows `Edit(.env*)`. The committed `.claude/settings.json` denies `Edit(.env*)`. Claude tries to edit `.env.local`. What happens? #core
- A. The edit runs, because local settings are more specific
- B. The edit runs, but it's logged
- C. Claude asks the teammate
- D. The edit is blocked; a deny rule always beats an allow rule

**H20.** Which pairing of hook event → use is correct? #core
- A. `PostToolUse` → block a dangerous Bash command before it runs
- B. `PreToolUse` → block a call by exiting with code 2 (reason on stderr); `PostToolUse` → audit logging
- C. `Stop` → block a tool call midway through a turn
- D. `SessionStart` → block every write for the session

**H21.** A team wants a Slack alert whenever Claude Code needs permission or has been idle for 60 seconds. Which hook event fits?
- A. `PreToolUse`
- B. `SessionEnd`
- C. `Notification`
- D. `UserPromptSubmit`

**H22.** A team wants to validate that required env vars and services are available whenever a session starts or resumes. Which hook event fits?
- A. `SessionStart`
- B. `PostToolUse`
- C. `Stop`
- D. `Notification`

**H23.** A developer used `bypassPermissions` with a broad cleanup pattern, and Claude deleted `/deploy/config/prod/`. What does the course recommend?
- A. Keep bypass mode but add a CLAUDE.md warning
- B. Switch to `dontAsk` for interactive work
- C. Keep bypass mode and add a PostToolUse hook
- D. Set deny rules on sensitive directories before changing modes, and use classifier-gated `auto` instead of a full bypass; keep `bypassPermissions` for isolated, disposable containers

**H24.** How do the GitHub and Linear MCP servers authenticate, according to the course?
- A. Both use OAuth
- B. GitHub: remote HTTP with a Personal Access Token sent as a Bearer header from an env var; Linear: OAuth browser sign-in with the token stored automatically
- C. Both use stdio with no auth
- D. GitHub uses OAuth; Linear uses an inline key

**H25.** After rotating a key that had been committed in `.mcp.json`, which two-layer prevention does the course recommend?
- A. Make the repository private, and rewrite git history
- B. A README warning, plus code review
- C. A CLAUDE.md convention (intent) plus a PreToolUse hook that blocks inline credentials in `.mcp.json` edits (enforcement)
- D. A longer key, plus a shorter TTL

**H26.** A CI pipeline needs Claude Code to reach an internal API under a service identity (no human user). Which auth pattern fits?
- A. An API key in an env var, injected as a secret by the pipeline runner
- B. OAuth browser sign-in during the CI run
- C. A key in a file committed next to the pipeline config
- D. stdio with no auth

**H27.** *(Choose TWO.)* A regulated customer's security team reviews a Claude Code rollout. Which questions does the course say they will ask?
- A. Where is data processed (residency: regional endpoint and platform)?
- B. How is access logged (e.g. a PostToolUse audit hook)?
- C. Does CLAUDE.md tell the model not to exfiltrate data?
- D. Which code editor do the developers use?
- E. How many characters per token does the model use?

## M4 Production Engineering, Evals & Security

**H28.** *(Choose TWO.)* Which errors are terminal (don't retry)? #core
- A. 401
- B. 503
- C. 403
- D. 429
- E. 529

**H29.** An inventory tool throws an exception, and the code returns `[]` as the `tool_result`. Claude tells the customer the item is out of stock. What is the fix?
- A. Retry the tool forever
- B. Return a fabricated in-stock result
- C. Leave out the `tool_result`
- D. Return a `tool_result` with `is_error: true` and a message describing the failure

**H30.** Which success criterion for a meeting-summary feature is specific enough to grade?
- A. "The summary is good"
- B. "Lists all three action items with their owners"
- C. "Is concise"
- D. "Sounds professional"

**H31.** Running a 1,000-case LLM-judge eval on every commit doubled the team's CI bill. What does the course recommend?
- A. Run code-graded checks on every commit and the judge on a slower scheduled pass
- B. Drop the judge entirely
- C. Cut the eval to 10 cases
- D. Run the judge only on Fridays, with no code checks

**H32.** The team agreed a 4-second latency ceiling and 3 retries. To cut cost, someone proposes switching to Haiku and dropping retries. What is the course's rule?
- A. Cost comes first; the floor can move
- B. Drop retries only on weekends
- C. Set the reliability floor first, then tune cost above it; every cut must stay within the floor, which the pinned eval baseline makes enforceable
- D. Retries never affect reliability

**H33.** Which statement about model cost is TRUE?
- A. A higher tier is always more expensive per request
- B. Haiku is always the right choice at volume
- C. Model cost doesn't depend on output length
- D. A higher tier can be cheaper and faster per request if it finishes in fewer tokens, and the cost of a mistake belongs in the calculation

**H34.** Which is NOT one of the four controls in the course's minimal secure configuration for a fetch-and-write agent?
- A. A PreToolUse hook that denies writes outside `/workspace/output`
- B. Deny rules on `/etc`, `/secrets` and `~/.aws`
- C. A system prompt telling the model to be careful with fetched content
- D. An audit log of every privileged action

**H35.** Today an attacker plants an instruction inside a support ticket. Next week it triggers when an agent summarizes the ticket queue. Which statement is TRUE?
- A. It's a jailbreak, so input validation alone is enough
- B. It's indirect prompt injection; the reliable boundary is what the agent is allowed to do
- C. It can't happen, because the ticket was written by a customer, not the user
- D. Wrapping tickets in XML tags fully prevents it

## M5 Accelerators & IP Contribution

**H36.** A Bedrock deployment calls `model="opus"`. Which change matches the course's fix? #core
- A. Pin the full Bedrock model ID (for example `us.anthropic.claude-opus-4-8`), retain the previous pinned version, and gate promotion on the eval against the baseline
- B. Keep the alias and add a parser try/except
- C. Use the newest alias on a separate endpoint
- D. Pin the major version only (`opus-4`)

**H37.** A security reviewer asks why the team chose Bedrock over the first-party API. What should the team be able to show?
- A. A latency chart from a developer laptop
- B. The team's familiarity with AWS
- C. A requirements record: behaviors, constraints, and the regulation behind each
- D. The model's benchmark scores

**H38.** A customer with an EU-residency requirement uses Microsoft Foundry, and the model they want is listed as "Hosted on Anthropic". What should the team conclude?
- A. Foundry always keeps inference in the customer's Azure region
- B. Anthropic-hosted Foundry models don't meet EU regional residency, so confirm residency per model
- C. Residency is irrelevant in Foundry
- D. Switch to the first-party global endpoint

**H39.** An MCP server needs write access to a payment system, and there's no way to scope it below full write. What should happen?
- A. Ship it, and monitor closely
- B. Add a system-prompt rule limiting payments
- C. Grant full access temporarily and fix it later
- D. Escalate to a human owner; don't ship around a seam that can't be secured

**H40.** Per-token prices are broadly similar across platforms. What actually moves total cost?
- A. Egress, platform fees and integration effort; measure total cost per call
- B. Nothing; total cost is identical everywhere
- C. Only the model tier
- D. Only the region name

---

# ANSWER KEY & REASONING

## Set H answers

**H1 – D.** Oversized input → validation error before generation. The API never compacts or drops turns on its own (A, C); keeping a long session alive is the application's job.

**H2 – A, C.** Sampling makes outputs non-deterministic (temperature 0 is more repeatable, not guaranteed), and the newest models reject non-default sampling parameters. Streaming and model size don't change determinism.

**H3 – A.** Streaming improves perceived latency: output appears immediately over SSE. Batches (B) can take up to 24 h; async (C) is about server concurrency.

**H4 – B.** The course's combination table: capable model + higher effort for the most demanding tasks. `budget_tokens` (D) is deprecated (400 on the newest models).

**H5 – C.** Reasoning pays off on hard, multi-step problems and is wasted on lookups and classification, where a constrained prompt is cheaper and just as accurate.

**H6 – D.** Examples can let a cheaper model match a stronger one; choose model and examples together, guided by the eval. A skips the cheaper option; B adds thinking cost without targeting structure.

**H7 – C.** API validation error right after a tool call → check pairing and ids before touching the schema. It's structural; descriptions (A) and `required` (B) are for routing and argument problems.

**H8 – A.** Never strip, edit or redact thinking blocks; their signatures are verified. Context pressure is solved with context engineering (pruning, compaction, subagents).

**H9 – B.** On interruption, discard the partial assistant turn and retry from the last complete turn. Committing a partial turn causes validation errors on the retry.

**H10 – D.** The cross-module debug table: "wrong tool every time" → overlapping descriptions; "wrong tool after turn N" → context window, not the schema or `max_tokens`.

**H11 – B.** Strict tool use validates arguments against `input_schema` before your code runs. JSON outputs (A) constrain the final answer, not tool arguments.

**H12 – A.** `messages.parse` with a Pydantic `output_format` returns a validated instance in `.parsed_output`. `content[0].input` is how you read tool-use arguments.

**H13 – B, C.** Claude doesn't run tools; your code does. Dropping the text block when Claude returns text plus tool_use corrupts context. `tool_result` goes in the user role.

**H14 – C.** Clearing fits when the next task is unrelated and old context would bias it; you lose everything, so persist what matters first. Compaction (A) is for continuing the *same* task near the ceiling.

**H15 – D.** Skills on the Messages API need both `code-execution-2025-08-25` and `skills-2025-10-02`, and they run in the code-execution container.

**H16 – A.** Subagents don't inherit skills (or history); list skills in the subagent's configuration. Built-in agents have no preloaded skills.

**H17 – B.** Same asset reused across requests or turns → Files API (`file_id`). It's beta and not on Bedrock or Vertex. Inline base64 (A) resends the full payload every time.

**H18 – C.** Batch results come back in arbitrary order; `custom_id` is how you match them. Limits are 100,000 requests or 256 MB per batch, completing within 24 h.

**H19 – D.** A deny rule always beats an allow rule, whichever settings file each sits in.

**H20 – B.** `PreToolUse` is the only event that can block a tool call (exit 2, reason on stderr). `PostToolUse` is for formatters, tests and audit logs.

**H21 – C.** `Notification` fires when Claude needs permission or has been idle for 60 s; route it to an external channel.

**H22 – A.** `SessionStart` runs when a session starts or resumes: initialize state, validate env vars or services.

**H23 – D.** The course's "watch out" fix: put deny rules on sensitive paths *before* changing modes, and prefer `auto` (classifier-gated) to a full bypass. Bypass also skips the protected-path guard.

**H24 – B.** GitHub MCP: remote HTTP, PAT as a Bearer header via an env var. Linear MCP: OAuth sign-in, with the token stored automatically.

**H25 – C.** Convention plus enforcement: CLAUDE.md states the intent; a PreToolUse hook blocks inline credentials deterministically. The key stays in history, so rotation was still required.

**H26 – A.** Remote service identity → API key in an env var; in CI the runner injects it as a secret. OAuth (B) is for user identity on SaaS.

**H27 – A, B.** Regulated customers ask about residency, access logging (PostToolUse audit hook) and whether admins can lock the config (managed settings). A CLAUDE.md line (C) is a convention, not a control.

**H28 – A, C.** Terminal: 400, 401, 403, 404. Retriable: 429, 529, 500, 502, 503, 504.

**H29 – D.** Never return an empty result for a failure; Claude treats empty as valid data and answers confidently wrong. Use `is_error: true` with a message.

**H30 – B.** Success criteria must be specific enough to grade; they become the eval. The rubric bands: 1–3 misses required content, 4–7 partial, 8–10 complete and faithful.

**H31 – A.** Cost pattern: cheap code checks on every commit; the judge (1,000 cases = 1,000 extra API calls) on a slower scheduled pass.

**H32 – C.** Reliability floor first (latency ceiling, retries), then tune cost above it. The pinned eval baseline makes the floor enforceable.

**H33 – D.** Per-request cost depends on tokens used: a higher tier can finish in fewer tokens, and mistakes have a cost too.

**H34 – C.** The four controls: PreToolUse hook on write paths, deny rules on sensitive paths, secrets from env, audit log. "No prompt instruction is a security control."

**H35 – B.** Injection can be indirect (planted for later) or hidden. Delimiters are a soft boundary; the reliable boundary is the action side (least privilege, hooks).

**H36 – A.** The M5 cumulative fix: a pinned full Bedrock ID, `retain_previous_pinned_version`, and an eval check against the baseline before promoting.

**H37 – C.** A requirements record (behaviors, constraints and the regulation behind each) lets you defend the platform choice. Picking on familiarity (B) is the classic way to fail security review.

**H38 – B.** Foundry has "Hosted on Azure" models (inference on Azure) and "Hosted on Anthropic" models; Anthropic-hosted ones don't meet EU regional residency. Confirm residency per model.

**H39 – D.** The app is only as contained as its most privileged seam. When a seam can't be secured, escalate to a human owner; don't ship around it.

**H40 – A.** Per-token rates are broadly similar; total cost moves with egress, platform fees and integration effort. Measure total cost per call.
