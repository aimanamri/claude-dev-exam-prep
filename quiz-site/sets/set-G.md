---
title: Set G · Mock exam 3
minutes: 60
description: Pearson-style mock. 40 questions across M1–M5, with more NOT/FALSE and debug-priority stems. 10 **core** items repeat.
---
# SET G (mock exam 3)

Items tagged #core re-test the ten MUST-REMEMBER facts shared by Sets E–H. Unless an item says "Choose TWO", pick ONE answer.

## M1 Foundations

**G1.** Which statement about the context window is FALSE? #core
- A. It's the total tokens for one request, including the model's output
- B. Input already larger than the window is rejected before generation begins
- C. When the window fills, the API silently drops the oldest turns so the session can continue
- D. If generation hits the ceiling, current models return the output so far with `stop_reason: model_context_window_exceeded`

**G2.** A classifier worked yesterday. Today a teammate added `top_k=40` "to reduce randomness", and every call to one of the newest models returns 400. What should you check FIRST? #core
- A. The new sampling parameter: the newest models reject non-default `top_k`/`top_p`/`temperature`, so remove it and steer through the prompt
- B. Whether the API key expired overnight
- C. Whether `top_k=1` would be accepted
- D. Whether the region changed

**G3.** A team is building a new production classifier and has no eval yet. Which model should they start with?
- A. Fable, the most capable tier
- B. Haiku, the cheapest tier
- C. Sonnet, then move up or down only when an eval shows they should
- D. Opus, to be safe

**G4.** A TypeScript service needs non-blocking concurrent calls to Claude. A teammate searches the SDK for `AsyncAnthropic` and can't find it. What is the explanation?
- A. Async support requires the Batches API in TypeScript
- B. They must call the REST API directly
- C. They need a separate async package
- D. TypeScript has no separate async class; the standard `Anthropic` client is Promise-based, so you `await` it

**G5.** A team moves to a newer model generation and reuses the characters-per-token ratio they measured on the old one to budget context. Which statement is TRUE?
- A. Characters per token is fixed across all Claude models
- B. Characters per token depends on the tokenizer and can differ between generations; count real inputs with `count_tokens` against the target model (it runs no inference)
- C. Token counts only matter for output
- D. `count_tokens` runs a full inference, so it costs the same as a call

**G6.** *(Choose TWO.)* Which statements about few-shot examples are TRUE?
- A. They aren't training data; nothing carries over to future calls unless you send them again
- B. Each example costs tokens on every call
- C. Multi-shot lowers the cost per call
- D. After about ten sends, the examples permanently change the model
- E. Only temperature can change the output shape, not examples

## M2 Prompting, Agents & Tool Use

**G7.** Before running a `transfer_funds` tool, the app wants the user to confirm. After the assistant's `tool_use` turn, it sends a user message containing only the user's text reply, planning to send the `tool_result` a turn later. The API rejects the request. What is the fix? #core
- A. Send the clarification in the system prompt instead
- B. Answer the `tool_use` with a `tool_result` carrying the matching id in the immediately following user turn (for example, an error result saying the user declined or hasn't confirmed)
- C. Delete the assistant's `tool_use` turn from history
- D. Send the `tool_result` in the assistant role

**G8.** A code review of a thinking-plus-tools loop finds `history = [b for b in content if b["type"] != "thinking"]` before each request. What is the finding? #core
- A. Fine; it saves context
- B. Fine, as long as redacted blocks are kept
- C. A performance issue only
- D. A defect: thinking blocks must go back unchanged (their signature is verified), so the next request is rejected

**G9.** *(Choose TWO.)* Which rules for consuming a stream are correct? #core
- A. Parse a `tool_use` block's input only after `content_block_stop` for that index
- B. Append the assistant turn to history only after `message_stop`
- C. `content_block_start` carries the tool's full input
- D. A read loop that exits normally proves the message completed
- E. `message_delta` carries the tool input JSON

**G10.** Development fixtures return tool results of about 1,000 tokens; production results are 3–5× larger. From about turn 8 the agent picks the wrong tools. What is the BEST first fix? #core
- A. Rewrite every tool description with exclusion conditions
- B. Switch to Fable
- C. Prune tool outputs after use and compact proactively before the budget fills
- D. Raise `max_tokens`

**G11.** A sentiment classifier returns "Positive.", "POSITIVE" and "The sentiment is positive" for similar reviews. Which missing piece does the course point to?
- A. An output constraint: the exact label set and "return only the label" (or structured outputs)
- B. A longer system prompt about sentiment
- C. Extended thinking at high effort
- D. A larger model

**G12.** Which of the following is NOT a cost or caveat of structured outputs?
- A. The first request on a new schema is slower
- B. Input tokens rise because the API injects a format description
- C. They can't be combined with assistant prefill
- D. They guarantee success on every call, so `stop_reason` checks become unnecessary

**G13.** An agent must call `get_user`, then `get_orders(user_id)` using the id from the first result. Claude issues both calls at once, with a guessed `user_id`. What is the fix?
- A. Mark `user_id` as required
- B. Model dependent calls as separate turns (current models default to parallel calls for independent work; `disable_parallel_tool_use` forces one call per turn)
- C. Increase effort
- D. Merge the two tools into one with a `type` parameter

**G14.** A tool is described as `"description": "Gets data."`. What does the course's recommended rewrite include?
- A. A one-word name and no description, so the schema decides
- B. Marking every parameter required
- C. A specific name plus 3–4 sentences: what it does, when to use it, when NOT to use it, and what it returns
- D. Three paragraphs of background about the data source

**G15.** A developer puts `cache_control` on the first system block. The long reference document that comes after it in the system prompt is never cached. Why?
- A. A breakpoint caches everything up to and including the marked block; put it on the last block you want cached (processing order is tools → system → messages)
- B. Only tool definitions can be cached
- C. Caching needs a global switch
- D. The TTL expired

**G16.** A RAG assistant retrieves semantically similar documents but misses exact part numbers like `XK-2291-B`. Which RAG failure point is this, and what is the fix?
- A. Chunking; make chunks smaller
- B. Assembly; reorder the chunks
- C. Model choice; use Opus
- D. Embedding match; add lexical (exact) matching alongside semantic search

**G17.** About how many tokens does a 1,400 × 700 pixel image cost, assuming it's within the model's size limits?
- A. 980
- B. 1,250
- C. 2,500
- D. 1,296

**G18.** An agent can read invoices, draft emails, and pay vendors. Where is a human-in-the-loop checkpoint MOST needed?
- A. Before the payment tool executes
- B. Before reading invoices
- C. After each draft email is generated, before any tool runs
- D. Nowhere, if the eval passes

## M3 Claude Code, MCP & Integration

**G19.** A developer runs Claude Code in `bypassPermissions`. Enterprise managed settings contain `deny: ["Read(./secrets/**)"]`. Claude tries to read `secrets/db.txt`. What happens? #core
- A. The read succeeds, because bypass skips every check
- B. The read is denied; a managed deny holds even under bypass
- C. Claude asks the user
- D. The read succeeds, but it's logged

**G20.** A `PostToolUse` hook on `Write` exits with code 2 to stop writes to `/etc`, yet the files still get written. Why? #core
- A. Exit code 2 means "allow"
- B. The matcher should be `Edit`
- C. The hook needs `/hooks` approval first
- D. `PostToolUse` runs after the tool and can't block it; blocking needs a `PreToolUse` hook

**G21.** Using the course's worst-case-cost question, which change needs a human gate BEFORE execution?
- A. Reformatting files inside the working directory
- B. Editing the production deployment configuration
- C. Renaming a local variable
- D. Running the linter

**G22.** An AI code review reports (1) "missing null check at line 42" and (2) "this change will cause a race condition in the billing service under load". How should the developer treat these?
- A. Verify (1) on the cited lines, since it's provable from the diff; treat (2) as a hypothesis to test
- B. Accept both as verdicts
- C. Ignore both, because AI review is unreliable
- D. Treat (2) as proven and (1) as a guess

**G23.** A Python job built on `claude-agent-sdk` ignores the conventions in the repository's CLAUDE.md, which the Claude Code CLI follows fine. What is the fix?
- A. Move the conventions into the user prompt
- B. Rename CLAUDE.md to AGENTS.md
- C. Set `setting_sources` explicitly so the SDK loads filesystem settings (CLAUDE.md, skills)
- D. Add the skills beta header

**G24.** A developer has an experimental web scraper for one repository that isn't ready to share. Which MCP setup fits?
- A. HTTP transport at enterprise scope
- B. Project scope in a committed `.mcp.json`
- C. User scope, with the key written inline in the config
- D. stdio or HTTP at local scope, with secrets in env vars

**G25.** Settings allow `mcp__jira` (the whole server) and deny `mcp__jira__delete_issue`. Claude calls `delete_issue`. What happens?
- A. It's denied; a deny on one tool overrides an allow on the server
- B. It runs, because the server allow is broader
- C. It prompts the user
- D. It runs once and is then denied

**G26.** Through the API MCP connector, a team wants the model never to see a `drop_table` tool. In Claude Code, they also want to govern which visible tools may run. What should they use?
- A. Only permission rules
- B. `enabled: false` for that tool in the `mcp_toolset` config (controls what the model sees), plus permission rules in Claude Code (control what may run)
- C. Only `defer_loading: true`
- D. A CLAUDE.md note listing forbidden tools

**G27.** *(Choose TWO.)* Which are secret-handling practices the course teaches?
- A. Config holds a reference to the secret, never the value
- B. Rotate on a schedule, and immediately after a suspected exposure
- C. Bake the key into code so it can't leak through env vars
- D. Share one broad credential across all services
- E. Committing keys is fine if the repository is private

## M4 Production Engineering, Evals & Security

**G28.** A client runs on default settings, and the team wraps every call in its own 5-attempt retry loop. Under load, 429s get worse. What is the MOST likely reason? #core
- A. 429 is terminal and shouldn't be retried
- B. The loop should retry 400s too
- C. The SDK already retries transient errors with backoff, so stacking a second loop multiplies attempts against the same limit; pick one owner
- D. Streaming would avoid 429s

**G29.** An end-to-end test fails intermittently, and the team can't tell which step is responsible. What does the course recommend adding?
- A. A trace that records each step (prompt, tool calls, intermediate outputs, timing)
- B. More unit tests on the parser
- C. A larger model
- D. A longer timeout

**G30.** When should the eval dataset be written?
- A. After the feature ships, using production outputs
- B. After the first customer complaint
- C. Only when the model changes
- D. Before the feature is built, so it defines success rather than rationalizing whatever the output turns out to be

**G31.** A team has three hand-graded eval cases. What is the course's advice?
- A. Keep the three; perfection beats coverage
- B. Let Claude generate more cases from a labeled seed set and spot-check them; a large, slightly noisy set beats three hand-graded cases
- C. Replace them with an LLM judge
- D. Stop evaluating until there's production data

**G32.** Eval failures appear only on long input documents. Where should the team look first?
- A. The output-format instructions
- B. The retrieval step
- C. Context handling
- D. The grader

**G33.** Traffic mixes short FAQ lookups with occasional hard, multi-step refactor requests. Which model strategy does the course recommend?
- A. A default model (Sonnet or Haiku) plus an Opus override on a cheap signal such as task type or length
- B. Opus for everything
- C. Haiku for everything
- D. Pick a model at random per request to spread load

**G34.** An agent has write access to its own MCP config file, which holds its auth settings. What is the security concern?
- A. None, if the file is in the working directory
- B. Only a performance concern
- C. The file may become too large for context
- D. Anything that can modify the agent's auth config can act as that identity, so protect it like a secret (deny edits)

**G35.** A nightly job runs the same 8,000-token fixed system prompt over 30,000 records, and nobody needs results before morning. Which levers compound?
- A. Streaming plus a larger model
- B. The Message Batches API plus prompt caching on the fixed prefix
- C. The async client plus a smaller `max_tokens`
- D. Orchestrator-worker fan-out

## M5 Accelerators & IP Contribution

**G36.** Which sequence correctly promotes a new model snapshot into production? #core
- A. Switch the alias → watch the error rate → hotfix as needed
- B. Promote everywhere at once → keep logs for the postmortem
- C. Update the prompt and the model together in one release, then run the eval
- D. Pin the new full model ID on a canary share of traffic → run the eval against the pinned baseline → promote or roll back, keeping the prior pinned version

**G37.** When should a team package an accelerator from an engagement build?
- A. A year later, once it's proven stable
- B. Never; every engagement should start fresh
- C. While the build is fresh, separating the reusable core from engagement-specific code and exposing customer values as parameters with documented defaults
- D. Only after the customer asks for it

**G38.** A focused API wrapper is submitted to the tool's own repository, but the review stalls. Which item is MOST likely missing, according to what maintainers accept?
- A. A test that proves the behavior
- B. A logo
- C. A full multi-component demo application
- D. A marketing summary

**G39.** Which statement about Claude in Amazon Bedrock is TRUE?
- A. It uses ARN-versioned IDs through InvokeModel only
- B. It runs inference outside the customer's AWS boundary
- C. It shares the first-party API's retirement dates exactly
- D. It exposes the Messages API at `/anthropic/v1/messages`, uses full model IDs with the `anthropic.` prefix, and has its own partner retirement dates

**G40.** A team benchmarked latency from a laptop in Kuala Lumpur. The customer's users are in Frankfurt. What does the course say?
- A. Laptop numbers are fine if the payload is small
- B. Pick the platform with the lowest list price instead
- C. Re-measure from the customer's actual region with their actual payload
- D. Latency doesn't matter for platform choice

---

# ANSWER KEY & REASONING

## Set G answers

**G1 – C.** The API never silently drops turns. Oversized input → error before generation (B); ceiling hit mid-generation → partial output plus `model_context_window_exceeded` (D). Managing history is the app's job.

**G2 – A.** A 400 right after adding a sampling parameter → the model doesn't support non-default sampling. Remove it; steer with the prompt.

**G3 – C.** Default path: start with Sonnet; move up only when an eval shows it misses the bar, and down to Haiku only when an eval shows the drop is acceptable.

**G4 – D.** Python has `AsyncAnthropic`; TypeScript's standard client is already Promise-based. The Batches API (A) is for offline bulk work, not concurrency.

**G5 – B.** Chars per token is model-dependent and differs between generations. `count_tokens` takes the same body as a messages call and returns the count without inference.

**G6 – A, B.** Examples live only in the prompt and are billed on every call. They don't retrain anything (D), don't lower cost (C), and they do change output shape (E).

**G7 – B.** Every `tool_use` must be answered by a `tool_result` with the same id in the immediately following user turn. A HITL "declined / awaiting approval" outcome goes back as a tool_result (often with `is_error: true`).

**G8 – D.** That filter strips thinking blocks, so the signature check fails and the request is rejected. It's one of the four bugs in the M2 cumulative debug task.

**G9 – A, B.** Tool input arrives as partial JSON across deltas and is only parseable after `content_block_stop`. Commit the turn only after `message_stop`; a loop that exits isn't proof of completion (D).

**G10 – C.** Production tool outputs are often 3–5× larger, so the window fills by turn 8 instead of turn 50. Context pressure is fixed with pruning and compaction, not by schema edits or `max_tokens`.

**G11 – A.** Wrong shape (casing, prose instead of a label) = missing output constraint. Structured outputs move that control into the API.

**G12 – D.** A guaranteed schema isn't guaranteed success: `refusal` and `max_tokens` can still produce non-matching output, so always check `stop_reason`. A, B and C are real caveats.

**G13 – B.** When one call needs another's output, they must happen in separate turns. `required` (A) would make Claude fabricate the id.

**G14 – C.** The description is the most important part of the schema: what, when, when NOT, and what it returns, plus examples where format matters.

**G15 – A.** `cache_control` caches the prefix up to and including the marked block. Mark the last block you want cached (up to 4 breakpoints).

**G16 – D.** Semantic similarity can miss exact identifiers, so add lexical matching. The other RAG failure points are chunking and assembly.

**G17 – B.** ⌈1400/28⌉ × ⌈700/28⌉ = 50 × 25 = 1,250 tokens. 1,296 (D) is the 1000 × 1000 example.

**G18 – A.** Ask "what's the worst outcome if this step runs without a human check?" An irreversible payment is the destructive call, so gate it before execution.

**G19 – B.** Enterprise managed settings can't be overridden, and an enterprise deny is the most durable control; it holds even under `bypassPermissions`.

**G20 – D.** Only `PreToolUse` can block (exit 2, reason on stderr). `PostToolUse` fires after the write has already happened.

**G21 – B.** Hard-to-undo or sensitive changes (deployment config, destructive shell, writes outside the working dir) get a gate before execution. Low-stakes, reversible edits need none.

**G22 – A.** AI review produces findings to triage, not a verdict. Trust what's provable from the diff and verify it on the cited lines; claims about runtime behavior or other systems are hypotheses.

**G23 – C.** In the Agent SDK, whether CLAUDE.md and skills load is controlled by `settingSources` / `setting_sources`. Set it explicitly; don't rely on the default.

**G24 – D.** Personal experiment, not ready to share → local scope, stdio or HTTP, secrets in env vars. Never write keys inline (C).

**G25 – A.** The `mcp__server__tool` rule format lets you target one tool, and a deny on one tool overrides an allow on the whole server.

**G26 – B.** The connector's `enabled` flag controls what the model *sees* (context and scope); permission rules control whether a visible tool may *run* (governance). Use both.

**G27 – A, B.** Separation (reference, not value), storage (env var or secret store), rotation (scheduled and after exposure). You can't rotate a value baked into code (C).

**G28 – C.** The SDK already retries 429/5xx with backoff. Two layers multiply attempts and deepen the rate limit. 429 is retriable (A); 400 is terminal (B).

**G29 – A.** A trace records each step and tells you *which* step failed. E2E tests are the slowest and hardest to localize without one.

**G30 – D.** Write the eval before the feature; the success criteria in the design doc become the eval.

**G31 – B.** Coverage beats perfection: generate cases from a labeled seed and spot-check them.

**G32 – C.** Failure category → where to look: formatting → output instructions; factual errors on retrieved content → retrieval; only on long input → context handling.

**G33 – A.** Routing: a default model plus an override on a cheap signal. With uniform traffic you'd pin one model instead.

**G34 – D.** Least privilege extends to the agent's own auth config: anything that can modify it can act as that identity.

**G35 – B.** Batches give a lower per-token cost for non-urgent work, and caching cuts the cost of the repeated fixed prefix; they compound on scheduled jobs.

**G36 – D.** Promote through the eval: canary → compare with the pinned baseline → promote or roll back, keeping the prior pinned version. Change one thing at a time (C changes two).

**G37 – C.** Package while the build is fresh, because knowing what's customer-specific is the most expensive thing to reconstruct later.

**G38 – A.** Maintainers accept what they can verify: code that does one thing, a runnable example, a test that proves the behavior, and a short statement of assumptions.

**G39 – D.** Claude in Amazon Bedrock keeps data inside the AWS boundary, uses the Messages API at `/anthropic/v1/messages` and `anthropic.`-prefixed IDs. A describes the legacy integration; B describes Claude Platform on AWS.

**G40 – C.** Measure latency from the customer's actual region with their actual payload, not from your laptop. In-region cloud usually wins on round trip.
