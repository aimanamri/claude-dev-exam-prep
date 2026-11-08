---
title: Set J · Good / Better / Best 2
minutes: 60
description: Second hard judgment set. Several options work; choose the **BEST** one for the constraints given. Each answer ranks every option as Best / Better / Good / Weak.
---
# SET J (good / better / best 2)

As in Set I, most options would partly work. Rank them against the stem's constraints: who is waiting, what it costs, how risky or reversible it is, what compliance requires, and what the course names as the default. The most elaborate option isn't automatically the best.

## M1 Foundations

**J1.** A Python web app serves hundreds of concurrent users who watch long answers being generated. Which access pattern is BEST?
- A. The synchronous client in a large thread pool, streaming each response
- B. `AsyncAnthropic`, non-streaming
- C. `AsyncAnthropic` with streaming for the user-facing responses
- D. The Message Batches API, polling every few seconds

**J2.** For a high-volume triage feature, the eval bar is 95%. Haiku scores 96%, Sonnet 98% and Opus 98.5%. Volume is very high, and mistakes are cheap to correct. Which choice is BEST?
- A. Sonnet, the course's default starting tier
- B. Haiku, pinned, with the eval kept as the gate for any future change
- C. Opus, for the highest score
- D. Haiku with adaptive thinking at maximum effort, to widen the margin

**J3.** Some requests in a long-running assistant fail because their input exceeds the context window. What is the BEST fix?
- A. Count tokens with `count_tokens` before sending, and trim or summarize history when it passes a threshold
- B. Catch the validation error, then trim and retry
- C. Move to a 1M-context model
- D. Let the API drop old turns when the window is full

## M2 Prompting, Agents & Tool Use

**J4.** A developer has re-prompted three times, adding more instructions each time, and the output is still wrong. What should they do NEXT?
- A. Add another paragraph clarifying the edge cases
- B. Rewrite the prompt from scratch, more concisely
- C. Add few-shot examples right away
- D. Stop adding text, diagnose the failure type (shape, drift, invented structure, or edge case), add the one matching technique, and measure it with the eval

**J5.** In an agent loop, a `create_refund` call with a malformed amount would trigger a real refund. Which design is BEST?
- A. Strict tool use alone
- B. Strict tool use on `create_refund` plus a HITL approval before it executes
- C. JSON outputs on the final answer, parsing the refund arguments yourself
- D. Forcing `tool_choice` to `create_refund` whenever a refund is mentioned

**J6.** An extractor works, except that on emails with no date it invents one. Which fix is BEST?
- A. Add a constraint or example covering the no-date variant (allow `null`, e.g. with `anyOf`), and add the variant to the eval as a graded case
- B. Add one example showing a no-date email
- C. Reject outputs whose date doesn't appear in the email, in post-processing
- D. Mark `date` as required in the schema

**J7.** An agent needs three independent lookups per request, and responses are slow. Which approach is BEST?
- A. Set `disable_parallel_tool_use` so the calls happen one at a time
- B. Return each result in its own user message as soon as it's ready
- C. Let Claude issue the calls in parallel, execute them one by one in your code, and return all results in one user turn
- D. Let Claude issue the calls in parallel, execute them concurrently in your code, and return all results in one user turn

**J8.** In the middle of a coding task, Claude must scan 200 log files to find which service started failing first. What is the BEST context strategy?
- A. Scan in the main session, then prune the log outputs afterwards
- B. Scan in the main session, then compact with an explicit summarizer prompt
- C. Hand the scan to a subagent that returns only a summary
- D. Scan in the main session without any context management

**J9.** A RAG feature answers from memory. `retrieve()` returns `[{"content": ...}]`, but `build_prompt()` expects a string. What is the BEST fix?
- A. Join the chunks' `content` into a string, and add an integration test that drives `retrieve()` → `build_prompt()` with real retrieved data
- B. Join the chunks' `content` into a string
- C. Add "use only the provided context" to the prompt
- D. Switch to a more capable model

**J10.** A first-party API pipeline sends the same 4000 × 3000 photos inline as base64 on every turn and is over its token budget. What is BEST?
- A. Resize the photos only
- B. Add a resize step and upload once with the Files API, referencing the `file_id` on each turn
- C. Use the Files API only
- D. Switch to signed URLs that expire after 5 minutes

**J11.** An API agent should use a 30-page company playbook, but only on turns where it's relevant. What is BEST?
- A. Put the whole playbook in the system prompt with a cache breakpoint
- B. Add a retrieval tool that searches the playbook
- C. Paste the playbook into every user message
- D. Package it as a Skill: name and description load at startup, and the body loads only when the description matches

**J12.** An API agent connects three MCP servers exposing 60 tools in total, but uses only 8. Context cost is high. What is BEST?
- A. Keep everything connected and cache the tool definitions
- B. Set `defer_loading: true` on all 60 tools
- C. Connect only the servers you need, hide unused tools with `enabled: false`, and defer-load the rarely used ones
- D. Tell Claude in the system prompt to ignore unused tools

## M3 Claude Code, MCP & Integration

**J13.** Claude Code will help modernize a legacy payments service. What is the BEST setup?
- A. Plan mode to enforce the explore/execute boundary, a named approver for each phase, a PostToolUse audit log, and deny rules on deployment config
- B. Plan mode plus a PostToolUse audit log
- C. The `default` mode, approving each action as it comes
- D. `bypassPermissions` on a feature branch, reviewed at merge

**J14.** A headless CI job lets Claude Code fix lint errors. Nobody is there to answer prompts. What is BEST?
- A. `acceptEdits`
- B. `bypassPermissions` on the shared CI runner
- C. `dontAsk` with allow rules for edits and the lint command
- D. `dontAsk` with allow rules for edits and the lint command, deny rules on sensitive paths, running in an ephemeral container

**J15.** The team wants Claude Code to never write credentials into config files. Which approach is BEST?
- A. A CLAUDE.md rule
- B. A CLAUDE.md convention plus a PreToolUse hook that blocks writes containing credential patterns
- C. A PostToolUse hook that warns after a credential is written
- D. A PreToolUse hook only, removing the rule from CLAUDE.md

**J16.** A `/release-notes` workflow should run only when someone explicitly types it. What is BEST?
- A. A CLAUDE.md line: "only write release notes when asked"
- B. A skill with a very narrow description
- C. A skill with `disable-model-invocation: true` in its frontmatter
- D. A file in `.claude/commands/`

**J17.** An OAuth MCP integration works in staging but fails at sign-in in production. What is the BEST fix?
- A. Register the production redirect URI, confirm whether the customer requires a separate OAuth app per environment, and add both to the deploy checklist
- B. Register the production redirect URI
- C. Reuse the staging OAuth app in production
- D. Replace OAuth with an API key written in `.mcp.json`

**J18.** A Jenkins job reads an API key from a file in the workspace and now gets 401s. What is BEST?
- A. Move the existing key into an environment variable
- B. Rotate the key and keep it in the file, with tighter file permissions
- C. Switch the job to OAuth browser sign-in
- D. Rotate the key, move it out of the file into a CI-injected secret env var, and reference the variable in the MCP config

**J19.** *(Choose TWO.)* A 600-line CLAUDE.md is being ignored in places. Which TWO moves are BEST?
- A. Prefix every rule with "IMPORTANT"
- B. Split it into three files in subfolders, with no frontmatter
- C. Move path-specific guidance into rules files scoped with `paths:` frontmatter
- D. Regenerate it with `/init` and commit without review
- E. Move the one rule you can't afford to have ignored into a PreToolUse hook

## M4 Production Engineering, Evals & Security

**J20.** Unit tests and a functional test pass, but users report wrong answers. What testing investment is BEST?
- A. More unit tests on each function
- B. A larger end-to-end suite
- C. Integration tests on component handoffs using real data, plus tracing to show which step fails
- D. Integration tests on component handoffs only

**J21.** A CRM tool sometimes times out. Which handling is BEST?
- A. Return `[]` so the loop continues
- B. Return a `tool_result` with `is_error: true` and a clear message, and retry inside the tool only for transient causes, with a cap
- C. Return a `tool_result` with `is_error: true` and a clear message
- D. Raise an exception and end the conversation with a generic error

**J22.** A feature generates SQL from questions. Which grader is BEST for per-commit evals?
- A. Exact string match against reference SQL
- B. An LLM judge
- C. A parse check that the SQL is syntactically valid
- D. Execute the SQL against a test database and compare the result set with the expected one

**J23.** An agent's identity has admin rights on the CRM, but the agent only reads contacts and updates one field. What is BEST?
- A. A least-privilege identity (read plus that one field), the secret in a secret manager, the agent's auth config locked, and every privileged action logged
- B. A least-privilege identity only
- C. Keep admin rights and add a PreToolUse hook that blocks delete calls
- D. Keep admin rights and add "never delete records" to the system prompt

**J24.** Traffic is mostly short lookups with occasional hard, multi-step requests. What is BEST?
- A. Opus for everything
- B. Sonnet for everything
- C. A default model plus an Opus override on a cheap signal (task type or length), with both paths gated by the eval
- D. An Opus call that picks the model for every request

**J25.** A user-facing "instant answer" feature takes 6 seconds before anything appears. What is BEST?
- A. Switch to a smaller model without running the eval
- B. Stream the response, then right-size the model through the eval and cache the stable prefix
- C. Stream the response
- D. Move the feature to the Batches API

**J26.** Expensive requests keep timing out, and the code retries them with backoff. What is BEST?
- A. Retry immediately in a tight loop
- B. Raise the client timeout
- C. Keep retrying with backoff and jitter
- D. Fix the request itself (shrink or split the context, gate it with `count_tokens`), keeping bounded retries for genuinely transient failures

## M5 Accelerators & IP Contribution

**J27.** A stakeholder's requirement reads: "The assistant must be fast and accurate." What is BEST?
- A. Rewrite it into checkable functional requirements, plus infrastructure requirements (latency measured where users are, scale, residency, identity), recorded with the regulation behind each
- B. Add a latency target only
- C. Pick the fastest model and proceed
- D. Accept it as written and move to design

**J28.** A regulated customer must keep data in-region, and only one cloud they use is already certified for that. The team wants a thorough platform comparison. What is BEST?
- A. A full latency and cost comparison from the team's laptops
- B. A full comparison across every platform, including compliance
- C. Let the compliance constraint decide (the certified cloud in-region), skip the full comparison, and record the rationale
- D. The platform the team knows best

**J29.** A Claude Code task fetches customer web pages, and its output feeds a call that can use an MCP server with write access to the CRM. What is BEST at these seams?
- A. Treat the fetched content as data at the next seam
- B. Treat the fetched content as data, scope the MCP server to least privilege, and log its access
- C. Add a system-prompt rule telling the model to be careful
- D. Give the MCP server full access, since the Claude Code task is internal

**J30.** *(Choose TWO.)* Which practices turn a regression into a rollback rather than a hotfix?
- A. Pin the full model ID and retain the prior pinned version
- B. Follow the model alias so fixes arrive automatically
- C. Hotfix the parser whenever the output shape changes
- D. Version prompts and tool schemas with the code, keeping the prior version
- E. Log outputs only, with no versioning

---

# ANSWER KEY & REASONING

## Set J answers

**J1 – C.** Users are waiting (stream) and the server is concurrent (async).
- **Best – C:** non-blocking concurrency plus perceived latency for watchers.
- **Better – A:** streams, but threads block, which scales worse than async.
- **Good – B:** concurrency is fine, but users stare at a blank screen until each answer completes.
- **Weak – D:** batches can take up to 24 h; nobody can wait for that.

**J2 – B.** Move down to Haiku when the eval shows the quality drop is acceptable, here at very high volume with cheap mistakes.
- **Best – B:** meets the bar at the lowest cost, pinned and gated.
- **Better – A:** Sonnet is the default *starting* point, but the eval already shows it isn't needed.
- **Good – C:** the best score, at the highest cost; the cost of a mistake doesn't justify it.
- **Weak – D:** thinking is wasted on triage and adds cost.

**J3 – A.** Managing history is the application's job; gate requests before they fail.
- **Best – A:** prevents the error without running inference to count.
- **Better – B:** recovers, but pays for failed calls and adds latency.
- **Good – C:** delays the problem; it still happens as sessions grow.
- **Weak – D:** the API never drops turns; oversized input is rejected.

**J4 – D.** After three failed re-prompts, stop adding text and diagnose.
- **Best – D:** the course's method: one missing technique, measured by the eval.
- **Better – C:** examples may be the right technique, but you're guessing without a diagnosis.
- **Good – B:** a shorter prompt is good engineering, but it still doesn't target the failure.
- **Weak – A:** "longer instead of better", the warning sign itself.

**J5 – B.** Validate the arguments, and gate the irreversible action.
- **Best – B:** strict tool use prevents malformed input; HITL catches a well-formed but wrong refund.
- **Better – A:** guarantees valid arguments, but a valid wrong amount still executes.
- **Good – C:** gives you JSON, but tool arguments aren't validated before execution.
- **Weak – D:** forced `tool_choice` returns 400 on current models.

**J6 – A.** "Fine on tested inputs, breaks on an edge case" → a constraint or example for that variant, and an eval that guards it.
- **Best – A:** fixes the behavior and keeps the variant tested.
- **Better – B:** probably fixes it, but nothing stops it regressing later.
- **Good – C:** catches the invention, but treats the symptom and loses those records.
- **Weak – D:** making the field required forces Claude to fabricate, which is the very bug.

**J7 – D.** Independent subtasks → parallel calls; latency is won in your execution code.
- **Best – D:** parallel requests run concurrently, and all results go back together in one user turn.
- **Better – C:** correct structure, but serial execution throws away the latency gain.
- **Good – A:** correct, but slowest; that setting is meant for dependent calls.
- **Weak – B:** separate user messages break the pairing invariant.

**J8 – C.** A self-contained, exploration-heavy subtask → subagent handoff.
- **Best – C:** an isolated context; only the conclusion comes back.
- **Better – B:** works, but the logs flood the main context first, and the summary may lose details.
- **Good – A:** pruning helps afterwards, but the context still filled up during the scan.
- **Weak – D:** 200 files of output will crowd out the task.

**J9 – A.** It's a seam bug: fix the handoff and add the test that would have caught it.
- **Best – A:** aligns the format contract and guards it with an integration test on real data.
- **Better – B:** fixes it now, but it can silently break again.
- **Good – C:** the model still receives malformed context.
- **Weak – D:** a bigger model doesn't fix malformed input.

**J10 – B.** Two problems: oversized images (resize) and resending the same asset (Files API).
- **Best – B:** fewer tokens per image, uploaded once (first-party API, so the Files API beta is available).
- **Better – A:** fixes the budget, but still resends the payload every turn.
- **Good – C:** stops resending, but every image is still downscaled or token-heavy.
- **Weak – D:** short-expiry signed URLs break in multi-turn use.

**J11 – D.** Load knowledge only when it's relevant.
- **Best – D:** Skills load name and description at startup and the body only on a match.
- **Better – B:** loads on demand too, but adds a tool round-trip and retrieval quality risk.
- **Good – A:** works, and caching makes it cheaper, but the playbook occupies context on every turn.
- **Weak – C:** full cost on every call, with no caching benefit.

**J12 – C.** Connected servers add definitions even when unused; scope what the model sees.
- **Best – C:** removes the unneeded tools and defers the rare ones.
- **Better – B:** lowers upfront cost, but 52 unused tools stay in scope.
- **Good – A:** cheaper per call, but the tools still take up window space and add routing noise.
- **Weak – D:** a prompt instruction doesn't remove anything from context.

**J13 – A.** Before modernizing, answer three questions: blast radius, how changes are audited, and who approves each phase.
- **Best – A:** answers all three and protects deployment config.
- **Better – B:** enforced boundary and auditing, but no phase owner or deploy-path deny.
- **Good – C:** safe, but slow, and there's no audit trail.
- **Weak – D:** bypass belongs only in disposable sandboxes.

**J14 – D.** In locked-down CI, `dontAsk` auto-denies everything not pre-approved.
- **Best – D:** pre-approved actions only, sensitive paths denied, and a disposable environment.
- **Better – C:** the right mode, but missing defense in depth.
- **Good – A:** fine for edits, but other shell commands would wait for a prompt that never comes.
- **Weak – B:** bypass on a *shared* runner is the scenario the course warns about.

**J15 – B.** Convention plus enforcement: the course's two-layer prevention.
- **Best – B:** CLAUDE.md states the intent; the PreToolUse hook enforces it deterministically.
- **Better – D:** enforcement holds, but Claude loses the context for why writes get blocked.
- **Good – A:** a convention only, so it's probabilistic.
- **Weak – C:** PostToolUse can't block; the secret has already been written.

**J16 – C.** Skills are the recommended format; the frontmatter flag makes them explicit-only.
- **Best – C:** deterministic, explicit-only invocation.
- **Better – D:** works, but `.claude/commands/` is legacy.
- **Good – B:** reduces accidental triggering, but can still match automatically.
- **Weak – A:** a convention, and CLAUDE.md doesn't define commands.

**J17 – A.** Redirect URIs are per host, and some customers need a separate app per environment.
- **Best – A:** fixes it now and prevents it next time.
- **Better – B:** fixes this deploy, but the lesson isn't captured and per-environment needs are unchecked.
- **Good – C:** might work, but mixes environments in one app, which customers often disallow.
- **Weak – D:** OAuth exists for user identity, and an inline key gets committed.

**J18 – D.** CP6's answer: rotate the rejected key and stop storing credentials in files.
- **Best – D:** a working credential, the right storage, and a referenced config.
- **Better – B:** works again, but keeps the file pattern.
- **Good – A:** the right storage, but the rejected key still returns 401.
- **Weak – C:** OAuth is for user identity, not a CI service identity.

**J19 – C, E.** Size and dilution are CLAUDE.md's main failure. Move path guidance into scoped rules files and the critical rule into a hook. A is emphasis, not structure. B: files without frontmatter still load everywhere. D: an unreviewed `/init` output is a starter, not a fix.

**J20 – C.** Most silent failures hide at integration seams, and traces localize them.
- **Best – C:** catches handoff bugs and shows which step failed.
- **Better – D:** catches handoff bugs, but debugging stays slow.
- **Good – B:** catches symptoms, but E2E is slowest and hardest to localize.
- **Weak – A:** unit tests already pass; the bug lives between the units.

**J21 – B.** Never return an empty result; report failure with `is_error`, and retry only what's transient.
- **Best – B:** recovers from blips and is honest about persistent failure.
- **Better – C:** correct and honest, but gives up on a timeout that a single retry would have fixed.
- **Good – D:** safe, but the agent loses the chance to react or tell the user something useful.
- **Weak – A:** Claude treats empty as real data and answers confidently wrong.

**J22 – D.** A code-graded check that tests behavior, not just shape.
- **Best – D:** checks correctness cheaply enough to run on every commit.
- **Better – C:** cheap, but validation checks shape, not correctness.
- **Good – B:** can judge intent, but it's noisy, costly and needs calibration.
- **Weak – A:** equivalent SQL can be written many ways.

**J23 – A.** Least privilege bounds the blast radius, and the auth config is itself a secret.
- **Best – A:** the whole identity picture: scope, storage, locked config, logging.
- **Better – B:** the biggest single improvement, but no audit trail or protection of the auth config.
- **Good – C:** a deterministic guard on one action, but the identity can still do everything else.
- **Weak – D:** no prompt instruction is a security control.

**J24 – C.** Route on a cheap signal, and let the eval gate each path.
- **Best – C:** quality where it's needed, cost savings elsewhere.
- **Better – B:** a sound default, but the hard requests will miss the bar.
- **Good – A:** quality everywhere, at the highest cost.
- **Weak – D:** an expensive model call on every request just to route.

**J25 – B.** Streaming fixes perceived latency; the eval and caching improve total latency and cost.
- **Best – B:** first token arrives fast, and the rest is tuned safely.
- **Better – C:** the user sees text quickly, but total time and cost stay unexamined.
- **Good – A:** may be faster, but it's an ungated quality risk.
- **Weak – D:** batches can take up to 24 h.

**J26 – D.** Repeated timeouts on expensive requests mean you should fix the request.
- **Best – D:** removes the cause, while keeping bounded retries for real blips.
- **Better – B:** can stop the timeouts, but the requests stay slow and costly.
- **Good – C:** correct retry hygiene, but it keeps paying for doomed requests.
- **Weak – A:** a tight loop deepens the problem.

**J27 – A.** A requirement must be checkable, and the four infrastructure questions usually decide the platform.
- **Best – A:** testable behaviors and a defensible record.
- **Better – B:** one measurable piece, but accuracy, scale, residency and identity stay undefined.
- **Good – C:** decides too early, on a vague goal.
- **Weak – D:** "fast and accurate" is not a requirement.

**J28 – C.** When compliance is pass-or-fail, skip the full comparison; the constraint decides.
- **Best – C:** the right answer, quickly, and defensible.
- **Better – B:** reaches the same answer, but spends effort on a decision that was already made.
- **Good – A:** laptop measurements are misleading, and it ignores the deciding constraint.
- **Weak – D:** choosing on familiarity fails at security review.

**J29 – B.** Mark every seam; the app is only as contained as its most privileged seam.
- **Best – B:** controls at both seams, with the privileged one scoped and logged.
- **Better – A:** right at the first seam, but leaves the write-capable MCP server over-privileged.
- **Good – C:** a soft measure only.
- **Weak – D:** a component trusted in isolation doesn't make the seam leaving it trustworthy.

**J30 – A, D.** Pinned models plus versioned prompts and schemas, each with the prior version kept, mean a regression is a rollback. B is the cause of the classic outage. C is the hotfix you're trying to avoid. E gives you visibility but nothing to roll back to.
