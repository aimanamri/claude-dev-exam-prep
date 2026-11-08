# Claude Certified Developer – Foundations: Full Study Notes

<!-- nav:start -->
> ⬅️ [[claude-dev-exam-prep/00-mso-foundations-notes|M1 Foundations notes]] · 🏠 [[claude-dev-exam-prep/Developer Exam Prep|Developer index]] · [[Claude Certifications|Home]] · [[claude-dev-exam-prep/02-commute-recall|Commute recall]] ➡️
<!-- nav:end -->


Source: the four Skilljar modules on the Developer path (course numbering M2–M5). These notes were extracted from the course pages on 2026-11-03.

| Course module | Title |
|---|---|
| **M2** | Production-Grade Prompting, Agents & Tool Use |
| **M3** | Claude Code, MCP & Integration |
| **M4** | Production Engineering, Evals & Security |
| **M5** | Accelerators & IP Contribution |

Each section uses the same layout:
- **MUST REMEMBER**: facts that exam questions are built on
- **SYNTAX**: exact names, fields, files, headers and code shapes
- **DEBUG PRIORITY**: what to check first when this area fails
- **TRADE-OFFS & FIXES**: the cost of each option, plus the fix for each failure

> The course repeats one idea everywhere: **development hides failures that production reveals.** Most exam scenarios read "it worked in dev, broke in prod; what was the missing decision?"

---

# MODULE M2: Production-Grade Prompting, Agents & Tool Use

## M2.1 Prompting craft (system prompts, XML, few-shot, output constraints)

**MUST REMEMBER**
- When a prompt fails, **diagnose the failure type first, then add the ONE missing technique**. Rewording or adding words is not a fix.
- Failure type → missing technique:

| What you observe | Missing piece |
|---|---|
| Wrong shape: prose instead of a label, inconsistent casing, invalid JSON | **Output constraint** |
| Scope or tone drifts across turns and gets worse deeper in the conversation | **System prompt** (or a more specific one) |
| Task understood, but Claude invents a structure | **Few-shot examples** (show the pattern; don't describe it) |
| Fine on tested inputs, breaks on an edge case | **A constraint or example covering that variant** |

- **System prompt** = the persistent behavioral contract (role, output format, rules that must not change).
- **XML tags** separate examples, data and instructions, so Claude doesn't read examples as part of the task.
- **Few-shot** = input/output pairs that show the exact format and casing.
- Warning sign: **the prompt grows longer with each pass instead of more precise.** After **3 failed re-prompts**, stop adding text and diagnose.
- **Long, verbose prompts produce long, verbose outputs.** The model calibrates its response length to the input. Result: latency rises with no gain in accuracy.
- Two separate failures in the "six-pass" story: **Pass 4 = diagnostic failure** (added description instead of a constraint). **Pass 5 = engineering failure** (verbosity caused a latency regression).

**SYNTAX: the classifier fix**
```
System: "You are a support classifier. Classify each ticket into exactly one of:
BILLING, TECHNICAL, ESCALATION. Return only the label. No other text."
<sample_input>My account shows two charges for April.</sample_input>
<ideal_output>BILLING</ideal_output>
<sample_input>The API keeps returning a 429 error.</sample_input>
<ideal_output>TECHNICAL</ideal_output>
User: <ticket>I was charged twice for the same month.</ticket>
```

**Structured outputs (move output control from the prompt into the API)**
- **Constrained decoding**: the API only allows tokens that keep the output valid against your JSON schema, so an invalid response can't be produced.
- **JSON outputs** constrain the final response: `output_config.format` with `type: json_schema` plus your schema.
- **Strict tool use** constrains the arguments Claude passes to your tool: set `strict: true` on the tool definition, and the inputs are validated against `input_schema`.
- Costs and caveats:
  1. **The first request on a new schema is slower** because the schema is compiled into a grammar. The grammar is **cached for 24 h from last use**, so a workload whose schemas change constantly pays the compile cost repeatedly.
  2. **Input tokens rise**: the API injects a system prompt that describes the format.
  3. **A guaranteed schema doesn't guarantee success.** Two exceptions remain: `stop_reason: "refusal"` and `stop_reason: "max_tokens"` (output truncated mid-structure). **Always check `stop_reason`.**
  4. **JSON outputs can't be combined with message prefilling.**

### M2.1a Structured output constraints with the API: what goes in the input (syntax deep-dive)

Both mechanisms use **JSON Schema** (https://json-schema.org/) to describe the shape you want. The difference is **which part of the response** the schema constrains:

| | **1. JSON outputs** | **2. Strict tool use** |
|---|---|---|
| Constrains | Claude's **final answer** (the text block) | The **arguments** Claude passes to **your tool** |
| Where the schema goes | `output_config` → `format` → `schema` | Tool definition → `input_schema`, plus `"strict": True` |
| Turn it on with | `"type": "json_schema"` inside `format` | `"strict": True` at the **top level of the tool** (next to `name`) |
| You read the result from | The `text` block → `json.loads(...)` (or `.parsed_output` with `messages.parse`) | The `tool_use` block → `block.input` (already a dict) |
| Use when | The model's reply *is* the payload (triage label, extracted fields, an email draft) | Agent loops where a malformed argument would crash a function or trigger a wrong action |
| Exam phrase | "eliminates parse-and-retry code for payload extraction" | "validates arguments against input schemas before code execution" |

#### 1. JSON outputs: anatomy of the input

```python
response = client.messages.create(
    model="claude-opus-5-5",
    max_tokens=2048,
    messages=[{"role": "user", "content": "<ticket>I was charged twice in April</ticket>"}],
    output_config={                          # ← the container (also holds "effort")
        "format": {                          # ← "what shape must the answer have?"
            "type": "json_schema",           # ← switches on constrained decoding
            "schema": {                      # ← a normal JSON Schema object starts HERE
                "type": "object",
                "properties": {              # ← properties live INSIDE "schema"
                    "category": {
                        "type": "string",
                        "enum": ["BILLING", "TECHNICAL", "ESCALATION"],   # enum = allowed values
                        "description": "Exactly one label",
                    },
                    "urgency": {"type": "integer", "description": "1 (low) to 5 (critical)"},
                    "needs_human": {"type": "boolean"},
                    "summary": {"type": "string", "description": "One sentence"},
                },
                "required": ["category", "urgency", "needs_human", "summary"],
                "additionalProperties": False,     # ← REQUIRED on every object
            },
        },
    },
)

# Read it back: check stop_reason FIRST, then parse the text block
if response.stop_reason in ("refusal", "max_tokens"):
    raise RuntimeError(f"No valid JSON: {response.stop_reason}")
data = json.loads(next(b.text for b in response.content if b.type == "text"))
```

**Same thing with the SDK helper (Pydantic → schema → validated object):**
```python
from typing import Literal
from pydantic import BaseModel

class Ticket(BaseModel):
    category: Literal["BILLING", "TECHNICAL", "ESCALATION"]
    urgency: int
    needs_human: bool
    summary: str

response = client.messages.parse(model="claude-opus-5-5", max_tokens=2048,
                                 messages=[...], output_format=Ticket)
ticket = response.parsed_output          # a validated Ticket instance
```

#### 2. Strict tool use: anatomy of the input

```python
tools = [{                                   # a plain dict; the SDK's ToolParam TypedDict has the same keys
    "name": "create_refund",                 # specific verb_noun name
    "description": ("Issue a refund for one order after the customer confirmed the amount. "
                    "Do not use for exchanges or store credit; use create_exchange."),
    "strict": True,                          # ← top level of the tool, NOT inside input_schema
    "input_schema": {                        # ← JSON Schema for the ARGUMENTS
        "type": "object",
        "properties": {
            "order_id": {"type": "string", "description": "e.g. ORD-12345"},
            "reason": {"type": "string", "enum": ["damaged", "late", "wrong_item", "other"]},
            "amount_cents": {"type": "integer", "description": "Positive, in cents"},
        },
        "required": ["order_id", "reason", "amount_cents"],
        "additionalProperties": False,       # ← required with strict
    },
}]

response = client.messages.create(model="claude-opus-5-5", max_tokens=4096, tools=tools,
                                  messages=[{"role": "user", "content": "Refund ORD-12345, it arrived broken, $20"}])
for block in response.content:
    if block.type == "tool_use":
        args = block.input           # {"order_id": "ORD-12345", "reason": "damaged", "amount_cents": 2000}
```

#### Generic templates (fill in the placeholders)

**1. JSON outputs**
```python
output_config={
    "format": {
        "type": "json_schema",
        "schema": {
            "type": "object",
            "properties": {
                "KEY_LABEL_1": {"type": "string", "description": "What this field holds"},
                "KEY_LABEL_2": {"type": "integer", "description": "What this field holds"},
                "KEY_LABEL_3": {"type": "boolean", "description": "What this field holds"},
                "KEY_LABEL_4": {"type": "string", "enum": ["option_1", "option_2"],
                                "description": "One of the allowed values"},
            },
            "required": ["KEY_LABEL_1", "KEY_LABEL_2", "KEY_LABEL_3", "KEY_LABEL_4"],
            "additionalProperties": False,
        },
    },
}
```

**2. Strict tool use**
```python
from anthropic.types import ToolParam

tool = ToolParam({
    "name": "tool_name_here",
    "description": "Clear, detailed description of what the tool does and when Claude should use it.",
    "strict": True,
    "input_schema": {
        "type": "object",
        "properties": {
            "string_param": {"type": "string", "description": "Description of this string parameter."},
            "enum_param": {"type": "string", "enum": ["option_1", "option_2"],
                           "description": "Description of this enum parameter."},
            "int_param": {"type": "integer", "description": "Description of this integer parameter."},
        },
        "required": ["string_param", "int_param"],
        "additionalProperties": False,
    },
})
```

#### Syntax rules to remember

| Rule | Detail |
|---|---|
| Nesting (JSON outputs) | `output_config` → `format` → `type: "json_schema"` + `schema`. The `properties`, `required` and `additionalProperties` keys all sit **inside `schema`** |
| Placement (strict tools) | `"strict": True` sits at the **top level of the tool** (beside `name`), not inside `input_schema` |
| `type` values | `object`, `array`, `string`, `integer`, `number`, `boolean`, `null` |
| Allowed values | Use the **`enum`** keyword alongside `type` (e.g. `"type": "string", "enum": [...]`) |
| `additionalProperties` | `False` on **every object**, for JSON outputs and strict tools alike; no other value is supported |
| Numeric and length limits | `minimum`, `maximum`, `multipleOf`, `minLength` and `maxLength` are **not enforced** by constrained decoding. The Python/TS SDK helpers strip them and validate client-side; with a raw schema, validate in your code or use an `enum` |
| Also not supported | Recursive schemas, complex array constraints |
| `required` | List only the fields the output or call can't work without. Marking everything required makes Claude **fabricate** values |
| `ToolParam` | A TypedDict; `ToolParam({...})` and a plain dict are identical at runtime |

**Supported JSON Schema features:** basic types · `enum` · `const` · `anyOf` · `allOf` · `$ref`/`$defs` · string `format` (`date-time`, `date`, `time`, `duration`, `email`, `hostname`, `uri`, `ipv4`, `ipv6`, `uuid`) · `additionalProperties: false`.

**Checklist before you send:**
1. Is `type: "json_schema"` inside `format`, and is `format` inside `output_config`? (Or is `"strict": True` beside `name`?)
2. Does every object have `properties`, `required` and `additionalProperties: False`?
3. Are allowed values an `enum`, and not a made-up `type`?
4. Are numeric and length limits enforced by **your code** (or the SDK helper)?
5. Do you check `stop_reason` (`refusal`, `max_tokens`) **before** parsing?
6. No assistant prefill, and no citations, in the same request as JSON outputs (both return 400).
7. Is the schema **stable**? The first request on a new schema compiles a grammar (cached 24 h); changing the schema per request pays that every time.
8. On current models, forced `tool_choice` (`any`/`tool`) returns 400. Use `auto` + `strict: True` + a prompt that names the tool, or JSON outputs if you only wanted JSON.

**TRADE-OFFS**

| Approach | When |
|---|---|
| Stack all four techniques | Clearly defined output contract with edge cases covered by examples |
| Simplify | "Summarize this paragraph" doesn't need few-shot examples or a schema |
| Diagnose before adding | Prompt grows with every iteration |

---

## M2.2 Extended thinking

**MUST REMEMBER**
- Thinking comes back as its own **thinking block, positioned before the answer block**. On the newest models its content is **omitted by default**; request a readable summary through the **display** setting.
- Current models use **adaptive** reasoning. Enable it with the `thinking` parameter, then tune depth with **effort** (not a token budget).
- **`budget_tokens` is deprecated** and returns a **400 error** on the newest model generations.
- **Thinking tokens cost the same as output tokens.**
- **Carry-back rule:** when thinking and tools are both used, **every thinking block must go back to the API unchanged** on the next turn. Each block carries a **signature**; editing, summarizing or dropping the block breaks it and the request is rejected. **Redacted thinking blocks** (encrypted) follow the same rule and are returned as-is.
- The most common slip is stripping thinking blocks to save context. The right fix for context pressure is context engineering, not deleting blocks.

**When to use it**

| Task | Decision |
|---|---|
| Multi-step reasoning, math, multi-hop logic, dependent planning | **Enable**, with effort matched to depth |
| Classification, extraction, format conversion, short facts | **Leave it off**; a constrained prompt is cheaper and just as accurate |
| Agentic loop that plans across tool calls | **Enable** and budget for the planning step, not per call |
| Strip thinking blocks from history | **Never** |

**SYNTAX**: `thinking={"type": "adaptive"}` (effort is set separately).

---

## M2.3 Tool use and schema design

**MUST REMEMBER**
- **Claude does NOT run tools.** Claude picks a tool and emits a `tool_use` block. **Your code executes the tool** and returns a `tool_result`. The loop is not automatic.
- The 6-step loop: define schema → send message → receive `tool_use` block → **execute the tool (your job)** → return the result → Claude continues.
- Systematic wrong-tool calls → **fix the schema (usually the description)**.
- **Block types**: `text` (Claude's prose), `tool_use` (name, unique id, input), `tool_result` (sent in the **user** role: `tool_use_id`, content, optional `is_error`), `thinking`.
- **Critical invariant:** every `tool_use` block must be answered by a `tool_result` with the **same id** in the **immediately following user turn**. A missing, mismatched or late result triggers an **API validation error** (`invalid_request_error` / "references unknown tool_use_id"). This is structural, so a prompt change can't fix it.
- If Claude returns **text + tool_use** in one turn, **append the whole content array**. Dropping the text block corrupts context.
- All `tool_use` blocks from one assistant turn must be resolved together.

**Schema anatomy**: `name`, `description`, `input_schema`
- **Name**: specific (`get_account_balance`, not `get_data`).
- **Description**: the most important part. Write **when to use AND when NOT to use** it. Aim for 3–4 sentences: what it does, when to reach for it, what it returns, plus examples where the format matters.
- **required**: mark a field required only if the call makes no sense without it. **Marking everything required forces Claude to fabricate values.**
- **Optional fields**: leave them out of `required` and give them defaults in the function signature.
- **Overlapping parameter types** between tools are the **most common source of wrong-tool calls**. Claude routes on **name + description**, and parameter types are only a secondary signal.
- **Parallel vs sequential:** current models default to **parallel** calls for independent subtasks. When one call needs another's output, model them as **separate turns**. `disable_parallel_tool_use` forces one call per turn.
- Exclusion conditions rely on the **full conversation history** being sent. If history is truncated, the exclusion logic fails silently.
- When descriptions can't be separated even with exclusions → **merge into one tool with a `type` parameter**.

**SYNTAX: exclusion pattern**
```
search_knowledge_base: "Use this to search the knowledge base when the user asks a question that
requires looking up current information. Do not use this if the result of a prior search in this
session already covers the question."
get_cached_result: "Use this to retrieve a result already fetched during this session. Only use this
if search_knowledge_base was called earlier in this conversation for the same query."
```

**MCP as an alternative to hand-written schemas**
- The MCP client sends a **`ListToolsRequest`**, gets the tool list back and passes it to Claude. The loop and pairing rules are unchanged.
- **Connected MCP servers add their tool definitions to context even when the tools go unused.** Connect only the servers you need.
- **API MCP Connector**: put an `mcp_toolset` object in `tools`. It has a `default_config` that applies to all tools, plus per-tool `configs` keyed by tool name.
  - `defer_loading: true` loads a tool's definition only when it's needed, which lowers upfront context cost.
  - `enabled: false` hides an individual tool (an allowlist/denylist per server).
  - **Required beta header: `mcp-client-2025-11-20`.**
- **Transports**: **stdio** (local subprocess over stdin/stdout) or **Streamable HTTP** (remote; POST for client→server, optional GET SSE stream for server→client). **SSE-only is deprecated.**
- **The API MCP connector supports only remote HTTP servers.** stdio servers need Claude Desktop or Claude Code, or an MCP client you run yourself via the SDK.
- Use MCP when a maintained server exists. Write schemas by hand when none exists or you need precise control over description quality. You can also **use both**: an MCP server for breadth, then an allowlist plus tuned descriptions for precision.

**DEBUG PRIORITY (tool use)**
1. API validation error on the next request → check **tool_use / tool_result pairing and ids** before touching the schema.
2. Wrong tool selected systematically → check **description overlap** (exclusion conditions).
3. Wrong tool selected only after N turns → check the **context window** (see M2.5), not the schema.

---

## M2.4 Streaming

**MUST REMEMBER: event sequence**

| Event | Handler action |
|---|---|
| `message_start` | Create an empty content array |
| `content_block_start` | Create a slot at that **index** (type: text / tool_use / thinking). A tool_use block opens with its name and id but **no input yet** |
| `content_block_delta` | Append the fragment. Tool input arrives as **partial JSON** across many deltas (`input_json_delta` / `partial_json`; text arrives as `text_delta`) |
| `content_block_stop` | Block finished. **This is the first moment tool_use JSON can be parsed** |
| `message_delta` | Record the **stop_reason** and final usage |
| `message_stop` | Stream complete. Only now treat the message as a non-streamed response |

- **Never act on a partial block.** Parse or run a tool only after `content_block_stop`.
- **Append the turn to history only after `message_stop`.**
- **A stream ending is not the same as a message completing.** A read loop that exits isn't proof of completion.
- On interruption: **discard the partial assistant turn and retry from the last complete turn.**
- Check `stop_reason` before continuing the loop: `tool_use` means the tool calls are ready; any other value means a different path.

**SYNTAX: broken vs fixed**
```python
# BROKEN: appends even if message_stop never arrived
messages.append({"role": "assistant", "content": assemble(blocks)})
# FIX
if stop_seen:
    messages.append({"role": "assistant", "content": assemble(blocks)})
else:
    # discard partial turn, retry the request from last complete turn
    ...
```

**DEBUG PRIORITY**: a tool-use validation error **on a retry** → first check whether the previous turn was assembled from a **dropped stream**. Then check the schema.

**TRADE-OFFS**: Streaming improves perceived latency for long, user-facing responses. The cost is that you assemble the blocks yourself and must handle interruptions. **For short or backend jobs, use a non-streamed call.**

---

## M2.5 Context engineering

**MUST REMEMBER**
- **Model choice**: start with **Sonnet**. Move **up to Opus** only when an eval shows Sonnet misses the bar. Move **down to Haiku** only when an eval shows the quality loss is acceptable. Tiers: **Fable** (most capable) > **Opus** > **Sonnet** (balanced default) > **Haiku** (speed and cost).
- The context window holds the system prompt, history, tool definitions, tool results and output. **Every tool result stays in the window for the rest of the session.**
- Overflow behavior: a request **larger than the window → validation error before generation**. A request that **fits but hits the ceiling during generation** returns partial output with `stop_reason: model_context_window_exceeded`. **Neither silently truncates old content**; your application must trim or summarize.
- Production tool outputs are often **3–5× larger** than dev fixtures, so the window fills at turn 8 instead of turn 50.
- Context sizes: current API models have **≥200k** tokens; the newest flagships (including Fable) have **1M** by default.

**Four strategies**

| Strategy | What it does | Use when | What you lose |
|---|---|---|---|
| **Pruning** (rewind) | Jump back to an earlier message and drop what came after | Claude went down an unproductive or debugging path | Anything learned after the rewind point |
| **Compaction** (`/compact` in Claude Code; server-side compaction (beta) in the API; manual summarization on the client) | Summarize history into fewer tokens | Near the ceiling but continuing the same task | Details the summary didn't capture |
| **Clearing** (`/clear`; a new session in the API) | Empty context | Next task is unrelated; old context would bias it | Everything; persist what matters (e.g. CLAUDE.md) |
| **Subagent handoff** | Isolated context; returns only a summary | Self-contained, exploration-heavy subtask | Visibility into how the subagent got its answer |

- **Write the compaction summarizer prompt explicitly**: "preserve all file paths modified, all decisions made, and any errors encountered and their resolutions." A generic "summarize the conversation" drops task-critical state, which is **one of the most common multi-session failures**.
- **Prompt caching**: put `cache_control: {"type": "ephemeral"}` on the **last block you want cached**. **Up to 4 breakpoints.** Best targets: stable system prompts, tool definitions, reference documents.
- **Token counting**: the `count_tokens` endpoint takes the same body as a messages call and returns the count **without running inference**. Use it to gate requests before they fail.
- **RAG failure points**: (1) **chunking** (too small loses context, too large dilutes; overlap prevents splitting facts across a boundary); (2) **embedding match** (semantic similarity can miss exact identifiers, so add lexical match); (3) **assembly** (if chunks don't arrive in the structure the prompt expects, the model answers from memory).
- Fetch-once index = inspectable, but you maintain the index infrastructure; best for a **stable corpus with simple lookups**. Search across rounds = no index and no staleness, but more tokens and time; best for a **changing corpus or multi-step questions**.

**DEBUG PRIORITY**: **tool selection degrades after a fixed number of turns → suspect the context window first** (accumulated tool output crowds out the system prompt and instructions). Fix: **prune tool outputs after use and compact proactively before the cap.** Increasing `max_tokens` or editing the description won't help.

---

## M2.6 Agent construction

**MUST REMEMBER**
- **Ask whether the problem needs an agent at all.** Progression: single API call → workflow → agent. Move up only when the simpler pattern fails.

| Choose a **workflow** when | Choose an **agent** when |
|---|---|
| You can enumerate the steps in code | You know the goal and tools but not the path |
| Errors are costly; step-level guardrails matter | The path can't be enumerated in advance |
| Standard observability tooling is required | Non-determinism is acceptable and actions are limited by the toolset |
| Inputs are well constrained | Inputs vary unpredictably |
| The same sequence every time | The task needs creative sequencing of tools |

- **Three wiring paths** (single-agent loop stays the same; only who runs it changes):
  1. **Raw Messages API loop**: you own everything (loop, execution, context, retries, exits).
  2. **Agent SDK** (`claude-agent-sdk` / `@anthropic-ai/claude-agent-sdk`): runs the same loop as Claude Code, **inside your process**. Differs from the Anthropic SDK, which is a thin API wrapper with no loop.
  3. **Claude Managed Agents** (public beta): **Anthropic runs the loop and sandbox**. The agent is a **versioned API resource** referenced by ID, and results stream over SSE. Good for long-running work (minutes to hours) and when you'd rather not build a sandbox.
- **Managed Agents sessions are stateful and stored server-side → NOT eligible for ZDR or HIPAA BAA.** For PHI or ZDR workloads, use the Agent SDK or a raw loop on a covered configuration. **The governing constraint picks the path before convenience does.**
- Common progression: prototype on the Agent SDK, then move to Managed Agents. Expect to **re-express** the definition; there's no direct export.
- **Four loop steps**: register tools → set a **scoped** system prompt → handle the tool-use loop (your code executes) → **define exit conditions** (don't rely on Claude volunteering to stop).
- **Wiring checklist**: tools registered, system prompt scoped, loop implemented, **HITL insertion point defined**, exit conditions defined.
- **HITL insertion points**: **before a destructive tool call** (write/delete/send; high risk) · **after a planning step** (medium) · **on unexpected output** (error flag, empty result, out-of-bounds value).
- HITL question: **"What is the worst outcome if this step runs without a human check?"**
- **Over-tooling** is more common than under-tooling. Start with the minimum toolset.
- Regulated-data routing (from the constraints table):
  - **Attorney-client privilege**: direct API/SDK from the firm's app, SSO, firm-approved gateway, and **conversation logging implemented in your app layer**. Anthropic doesn't capture compliance conversation content by default on direct API traffic.
  - **HIPAA**: a BAA-covered configuration (a HIPAA-enabled org arranged with Anthropic), or Bedrock/Vertex on a HIPAA-eligible account. **The BAA doesn't cover Console, Workbench, beta features or consumer plans.**
  - **GDPR / EU residency**: **the direct API doesn't currently offer EU residency → use Bedrock or Vertex with the region pinned.** Using the global endpoint by default is the common mistake.
  - **FedRAMP**: Claude for Government (FedRAMP High via Palantir PFCS-SS), Bedrock GovCloud (FedRAMP High, DoD IL4/5), Vertex AI Assured Workloads. **Claude Enterprise on AWS Marketplace is NOT FedRAMP.**
  - **Internal residency policy**: use the procurement-approved cloud; don't switch mid-project.
  - SOC 2 governs how systems are built and run, not which endpoint you call.

**SYNTAX: HITL gate (checkpoint answer pattern)**
```python
if block.name == "update_record":
    approved = request_human_approval(block.input)   # pause, surface proposed change
    if not approved:
        tool_results.append({"type": "tool_result", "tool_use_id": block.id,
                             "content": "Update rejected by human reviewer.", "is_error": True})
        continue
result = execute_tool(block.name, block.input)
```
`update_record` description pattern: *"Use this to change one field on a customer record after the user has explicitly asked for that change. Do not use this to read records; use read_record. Requires human approval before execution."*

**DEBUG PRIORITY**: the agent did exactly what it was told, yet production broke → look for a **missing HITL gate between "proposed change ready" and "write committed"**. The validator only checked the file, not downstream dependencies.

---

## M2.7 Agent memory and Skills

**MUST REMEMBER: memory scope**

| Scope | Use when | Cost / loss |
|---|---|---|
| **In-context** | Short sessions that fit in the window and don't need to survive a restart | Token cost grows every turn; lost at session end |
| **External storage** (DB) | State must survive sessions, move between users or be shared across agent instances | Retrieval latency plus read/write code |
| **Summarized memory** | Long conversations that would outgrow the budget | Whatever the summarizer drops |
| **Stateless** | Independent jobs that finish and close | All prior context |

- Two opposite failures: **too much in context** (cost grows with session length) vs **too little persisted** (memory lost).
- Decide memory scope **at design time**. A refactor under production pressure costs far more (the course says ~1 hour in production vs ~20 min at design).
- Dev runs one long session, production runs **many short sessions with accumulated state**. Measure history + system prompt + tool schemas against the limit.
- **Skills** (`SKILL.md`: frontmatter `name` + `description`, then instructions). **Only the name and description load at startup**; the full body loads **on a description match**.
- **CLAUDE.md loads every session** (in the Claude Code CLI). In the **Agent SDK**, whether CLAUDE.md and skills load is controlled by **`settingSources`**. **Set it explicitly; don't rely on the default.**
- **Skills on the Messages API (beta)** need two headers: **`code-execution-2025-08-25`** and **`skills-2025-10-02`**, and they run **inside the code-execution container**.
- **Subagents don't inherit Skills or conversation history. They DO inherit the parent's permission context.** List skills explicitly in the subagent's configuration.

**Checkpoint 7 answers**: support agent across daily check-ins → **external storage**; one-shot document formatter → **stateless**; multi-hour coding session that won't continue → **in-context**.

---

## M2.8 Multimodal and batch

**MUST REMEMBER**
- **Image tokens = ⌈width/28⌉ × ⌈height/28⌉** (28×28-pixel patches). Example: 1000×1000 → 36×36 = **1,296 tokens**. Images over a model's long-edge or token limit are **downscaled first**, and the limits vary by model tier.
- Fixing an over-budget image pipeline is often a **resize step**.

| Image source | Use when |
|---|---|
| **Inline base64** | One-off image; the full payload travels with every request |
| **URL** | Stable, public URL; not behind auth or a short-expiry signature |
| **Files API** (`file_id`) | Same asset reused across requests or turns, or a large asset. **Beta; not on Bedrock/Vertex** |

- **PDF** → block `"type": "document"` with the same source types. `title` and `context` are **optional**; there's **no required name field**.
```json
{"type":"document","source":{"type":"base64","media_type":"application/pdf","data":"<b64>"},"title":"contract_review.pdf"}
```
- Visual prompts should state how to handle **overlap, depth and occlusion**.
- **Message Batches API**: up to **100,000 requests or 256 MB** per batch (whichever comes first) → returns a `batch_id` → **poll** → download. **Lower per-token cost**; completes **within 24 h** (often sooner); non-deterministic latency. **Results come back in arbitrary order; match them with `custom_id`.**
- **Looping over the synchronous API in chunks is NOT batching**: it's the same number of calls and hits the same rate limits.
- Sync API for anything a user is waiting on (chat replies, an instant photo classification). Batch for nightly pipelines and eval runs.

**Checkpoint 8 answers**: reference diagram used in every request → **Files API**; one-off bug screenshot → **inline base64**; classify 5,000 responses → **Message Batches API**.

---

## M2: Cumulative debug task (4 bugs, one per layer)
1. **Schema layer**: `"description": "Gets data."` is too vague (no when/when-not), so routing becomes unreliable. Fix: a specific description with an exclusion condition.
2. **Streaming layer**: appends the turn without checking `stop_seen`. Fix: gate on `message_stop`, discard and retry otherwise.
3. **Context / message-structure layer**: the filter `if b["type"] != "thinking"` **strips thinking blocks** → signature failure. A related issue: tool results are appended one message per block instead of as **one user turn holding all results**. Fix: pass thinking blocks back unchanged and collect all tool_results into a single user message.
4. **Memory layer**: concatenates **all prior session transcripts** in context, which inflates cost and eventually overflows. Fix: external storage plus injecting only the relevant subset (or summaries).

## M2 checkpoint answers (quick)
- CP1 broken extraction prompt → add an **output constraint**: exact JSON fields `category`, `urgency`, `summary` (one sentence), allowed values, "return only the JSON".
- CP2 → classify 50k: **leave it off** · dependent refactor: **enable, budget for planning** · strip thinking: **never**.
- CP3 → **B**: correct the `tool_use_id` (`toolu_02` → `toolu_01`).
- CP4 → append only if `stop_seen`; otherwise discard and retry.
- CP5 → **B**: prune `fetch_policy_document` results and compact before turn 5.

---

# MODULE M3: Claude Code, MCP & Integration

## M3.1 Agent loop, permission modes, settings, human gates

**MUST REMEMBER**
- Claude Code loop: **explore → plan → code**. **Plan mode** holds it in explore (no edits or shell) until you approve.
- **Permission modes:**

| Mode | Auto-approves | Still gates | Use for |
|---|---|---|---|
| `default` | Reads only | Every edit and shell command | New or unfamiliar projects (safe but slow) |
| `acceptEdits` | Reads, edits, and **common FS commands (mkdir, touch, rm, rmdir, mv, cp, sed) inside the working dir** | Other shell commands, **writes outside the working dir**, **protected paths** | Trusted local work where shell still needs review; not if the agent must run scripts |
| `plan` | Reads only; researches and proposes | All edits and shell until the plan is approved | Exploring sensitive or unfamiliar codebases |
| `auto` | Everything, but a **classifier reviews each action** and blocks escalation, unrecognized infrastructure, or hostile-content-driven actions | Blocked by default: prod deploys or migrations, mass deletes, credential exfiltration, force-push to main | Fewer prompts without a full bypass. **Research preview**; not a safety guarantee |
| `dontAsk` | **Only tools pre-approved in allow rules**, plus read-only commands | **Auto-DENIES everything else; no confirmation queue** | **Locked-down CI and scripts** |
| `bypassPermissions` | All tool calls, with no prompts or checks | Nothing (only catastrophic `rm -rf /` or `rm -rf ~` get a last-resort prompt). **Also skips the protected-path guard** | **Isolated, disposable container or VM only** |

- **Settings levels:**
  - **User**: `~/.claude/settings.json`, applies to all your projects
  - **Project**: `.claude/settings.json`, committed and shared with the team
  - **Local project**: `.claude/settings.local.json`, personal and auto-gitignored
  - **Enterprise**: `managed-settings.json`, set by admins and **can't be overridden**
- **A deny rule always beats an allow rule, in any mode.** An **enterprise-level deny is the most durable control** and **holds even under bypass mode**.
- Precedence for hooks and rules: **deny > ask > allow**.
- **Placing a human gate** (worst-case-cost question):
  - Low-stakes, reversible (formatting, edits in the working dir) → no gate (acceptEdits).
  - Hard to undo or sensitive path (writes outside the working dir, destructive shell, security files, deployment config) → **gate before execution** (deny rule, or default/plan mode).
  - Code the team has marked sensitive → **the agent is never the only gate**; a human reviews before merge.
- **AI code review**: findings to triage, not a verdict. **Trust findings provable from the diff** (missing null check, unclosed resource) and verify them on the cited lines. Treat **claims about runtime behavior or other systems as hypotheses to test.** Gate where a finding becomes an irreversible action, and give the reviewer your conventions.

**SYNTAX: Checkpoint 1 (trusted payments refactor: auto-approve edits, never destructive shell, never read .env.production)**
```json
{ "permissions": { "allow": ["Bash(npm run:*)"], "deny": ["Bash(rm:*)", "Bash(git push:*)"] } }   // Piece C
{ "permissions": { "deny": ["Read(.env.production)"] } }                                          // Piece D
```
Part 2 → **(b)**: a human approves the deployment-config change **before the write**.

**DEBUG / WATCH OUT**: bypassPermissions + a broad pattern deleted `/deploy/config/prod/`. Fix: **set deny rules on sensitive directories before changing modes**, and use **`auto`** (classifier-gated) instead of a full bypass.

---

## M3.2 Durable context: CLAUDE.md, rules files, hooks, subagents

**MUST REMEMBER**
- **CLAUDE.md** at the project root **loads every session** and is prepended to context. **`/init`** generates a starter version; review it before use.
- **Size is the main failure.** Every line dilutes every other line. In the 847-line example, the rule at line 347 ("don't modify /legacy/tokens/") was ignored. Keep it to **constraints that change behavior**. Move history and archives to on-demand docs, path rules to rules files, and **the one rule you can't afford to dilute to a hook**.
- **Rules files**: `.claude/rules/*.md`. Scope them with a **`paths:` glob in YAML frontmatter**. **Scoping comes from frontmatter, not folder placement.** A rules file **without `paths` loads unconditionally** at launch, like CLAUDE.md.
```yaml
---
paths:
  - "src/db/**/*.sql"
---
All SQL in the database module must include an explicit transaction boundary.
```
- **Hooks** run deterministically regardless of what the model decides. Define them in settings files or with `/hooks`. Each has an event, an optional matcher and a command.

| Event | When | Use |
|---|---|---|
| **PreToolUse** | Before a tool runs | **Can BLOCK**: **exit code 2** with the reason on **stderr** (the agent sees it). Access control |
| **PostToolUse** | After a tool runs | **Can't block.** Formatter, tests, **audit logging** |
| **UserPromptSubmit** | Prompt submitted, before the model processes it | Inject context or validate the request |
| **Stop** | Model finished responding | Notifications, cleanup, committing an audit log |
| **Notification** | Claude needs permission, or has been **idle 60 s** | Route to an external channel |
| **SessionStart** | Session starts or resumes | Init state, validate env vars or services |
| **SessionEnd** | Session ends | Teardown, final audit |

- **A CLAUDE.md instruction is a convention (probabilistic); a hook is a guardrail (deterministic).**
- **Subagents**: isolated context, return only output, **don't inherit history, context or session state**.
  - Built-in **Explore and Plan skip CLAUDE.md and git status** (for speed). **general-purpose loads both.** If project rules must apply → use general-purpose or a custom subagent.
  - **Custom subagents** (`.claude/agents/`) **don't see skills automatically**. List skills in the agent's frontmatter. Built-in agents have no preloaded skills.

**SYNTAX: Checkpoint 2 hook**
```json
{ "hooks": { "PreToolUse": [ { "matcher": "Read",
  "hooks": [ { "type": "command", "command": "<script: read tool call JSON from stdin, if path is .env.production → write reason to stderr, exit 2>" } ] } ] } }
```

**Which mechanism holds which knowledge**

| Mechanism | Loads | Cost | Belongs here |
|---|---|---|---|
| CLAUDE.md | Every session | Persistent; dilutes with size | Universal constraints, commands, framework decisions |
| Rules file | When a matching path is read (unscoped = always) | Only when triggered | Path-specific guidance |
| Hook | Nothing goes into context | Minimal | Enforced guardrails, side effects, audit |
| Subagent | Task context only | Returns a summary | Exploration and parallelizable work |

---

## M3.3 Packaging: skills, commands, plugins

**MUST REMEMBER**
- A **skill** = `SKILL.md` in `.claude/skills/<name>/`, with frontmatter (name, **description = the matching criterion**) and steps in the body.
- How skills load in each runtime:

| Runtime | How it loads | Where it runs | Gotcha |
|---|---|---|---|
| **Claude Code** | Filesystem discovery in `.claude/skills`; description match or `/skill-name` | Your terminal, under the permission mode and deny rules | Governed by the settings layer |
| **Messages API** | Sent with the request; headers **`code-execution-2025-08-25` + `skills-2025-10-02`** | **Anthropic's code-execution container** | Local files and tools aren't there |
| **Agent SDK** | Loaded only if **`settingSources`** (TS) / **`setting_sources`** (Python) includes filesystem sources | Your process | **Classic failure: skill works in Claude Code but does nothing in the SDK because settingSources was never set** |
| **Managed Agents** | Attached to the **agent resource definition** (not per session); header **`managed-agents-2026-04-01`** | Anthropic-managed sandbox | Not ZDR/HIPAA eligible; update the agent definition to change skills |

- **Three portability rules**: (1) the description is the matching criterion; (2) don't assume a local filesystem or tools exist; (3) **subagents don't inherit skills**.
- **Custom commands**: in current Claude Code, **skills are the recommended format** for both explicit and automatic invocation. **`.claude/commands/` is legacy.** For explicit-only, set **`disable-model-invocation: true`** in the frontmatter.
- **Plugin command namespacing**: a `run-tests` command in plugin `payments` → **`/payments:run-tests`**. **Renaming the plugin renames every command.**
- **Plugin** = a versioned bundle of **skills, hooks, subagents and MCP servers**, distributed through a **marketplace**. The official Anthropic marketplace is available automatically. Add others with `/plugin marketplace add <owner/repo>`.
- **Enterprise**: a **managed marketplace allowlist** controls which sources users may add, but **doesn't register marketplaces automatically**. Pair it with **`extraKnownMarketplaces`** in managed settings to push one to everyone. A plugin at managed scope **can't be overridden**.
- **Risk**: a deny rule or hook the author relied on locally **doesn't travel** unless it's bundled.

**PORTABILITY FIX (Watch out + CP4)**
- An absolute path (`/Users/alexmorgan/...`) works only on the author's machine.
- Use **`$CLAUDE_PROJECT_DIR`** for scripts in the project and **`${CLAUDE_PLUGIN_ROOT}`** for scripts bundled in the plugin. `~/` and network drives aren't fixes.
- **Document and validate required env vars at install** (e.g. a missing `DEPLOY_TOKEN` cost 3 people 2 hours). **Test the install on a clean machine.**
- CP4 → defect **C** (absolute path), fix **A** (`$CLAUDE_PROJECT_DIR`).

**CP3 answers**: Claude Code → put SKILL.md in `.claude/skills` with a matching description · Messages API → code-execution + skills beta headers and no local dependencies · Agent SDK → set settingSources explicitly · Managed Agent → API resource listing the skill + the managed-agents beta header + no local dependencies.

---

## M3.4 MCP servers: primitives, transport, scope, auth

**MUST REMEMBER**
- An MCP server exposes **tools** (actions), **resources** (read-only data the **client** pulls into context by address; **direct** = fixed address, **templated** = a parameter in the address; client support varies) and **prompts** (vetted instruction templates invoked by name).
- **Transports**: **stdio** = local subprocess, for personal or local use; **can't be shared or hosted**. **HTTP** = recommended for anything remote or shared. **SSE** = legacy and superseded.
- **Claude Code defers MCP tool definitions by default** (a tool-search step loads them on demand). An opt-in mode loads them upfront if they fit in **~10% of the window**.
- **Scopes**:
  - **Local**: `~/.claude.json` under the current project's path; personal, this project only
  - **User**: personal settings; all your projects; not shared
  - **Project**: **`.mcp.json` at the repo root**, committed so everyone who clones gets it. For a stdio server, **every teammate spawns a local subprocess and needs the runtime (e.g. Node)**
  - **Enterprise**: admin-managed, pushed to everyone, locked
- **Permission rule for one MCP tool**: **`mcp__server__tool`**, e.g. allow `mcp__github__create_issue` while everything else on the server still prompts. **A deny on one tool overrides an allow on the server.**
- **`enabled` flag in mcp_toolset** (API connector) controls **whether the model sees the tool** (context and scope). A **permission rule** controls **whether a visible tool may run** (governance). Use both.
- **GitHub MCP**: remote HTTP; **Personal Access Token as a Bearer header via an env var**. **Linear MCP**: **OAuth** browser sign-in, with the token stored automatically.

**Setup reference**

| Context | Transport | Scope | Secrets |
|---|---|---|---|
| Personal local tool | stdio | Local | Env vars only |
| Shared team server | **HTTP** | **Project (.mcp.json)** | OAuth or env var; **never commit keys** |
| Personal experiment, not ready to share | stdio or HTTP | Local | Env vars |
| Org-wide | HTTP | **Enterprise** | Admin-managed, config locked |

**SYNTAX: secret handling**
```json
// WRONG: "Authorization": "Bearer sk-abc123..."
{ "mcpServers": { "data-warehouse": { "type": "http", "url": "https://warehouse.internal/mcp",
  "headers": { "Authorization": "Bearer ${WAREHOUSE_MCP_TOKEN}" } } } }
```
- **A committed key is in repo history; overwriting the file doesn't remove it → treat it as compromised and ROTATE.**
- Two-layer prevention: a **CLAUDE.md convention** (intent) **plus a PreToolUse hook** that blocks inline credentials in `.mcp.json` edits (enforcement).

**Prompt caching (M3 detail)**
- **No global switch; you mark breakpoints.** `cache_control` type `ephemeral` caches **everything up to and including** that block. **Max 4 breakpoints.**
- Processing order is **tools → system → messages**, so a breakpoint after the tools caches the tool definitions while messages stay dynamic.
- TTL: **5 min default** (refreshed on each read). **`ttl: "1h"`** opt-in for workloads with longer gaps.
- **Minimum cacheable length ~1,024 tokens** for most current models.
- **A single changed character before the breakpoint invalidates the cache.**

**RAG (M3 framing)**: **classical RAG** = chunks → embeddings → vector DB, built upfront ("a librarian with pre-written cards"). **Agentic search** = no index; search live at query time ("a researcher"). Retrieval **scales**, since cost per request stays flat as the corpus grows, but **it's only as good as what it finds**; descriptive filenames and grouping help.

**CP5 answers**: local SQLite tool → **stdio + Local** · company-hosted code search for the whole team → **HTTP + Project** · experimental scraper for one repo → **stdio or HTTP + Local** · org-wide security scanner → **HTTP + Enterprise**.

---

## M3.5 Enterprise integration and auth

**MUST REMEMBER**
- Auth by service type:
  - **Remote, user identity** (SaaS) → **OAuth**. The server returns **401**, then a browser sign-in issues a token stored by the client.
  - **Remote, service identity** (internal API) → **API key in an env var**. In CI, the pipeline runner injects it as a secret.
  - **Local** (filesystem or local DB) → **stdio, no network auth**. The boundary is filesystem permissions plus **deny rules**.
- **Three secret practices**: (1) **separation**: config holds a reference, never the value; (2) **storage**: env var for local or short-lived secrets, **secret store** for shared or audited ones (one rotation updates every consumer); (3) **rotation**: on a schedule and **immediately after suspected exposure**. You **can't rotate a value baked into code**. Also scope credentials narrowly and keep a record of which services use each one.
- **Regulated customers ask**: where is data processed (**residency**: regional endpoint + platform), how is access logged (**PostToolUse audit hook**), can admins lock the config (**enterprise managed settings**).
- **Code modernization** answers three questions before starting: **blast radius**, **how changes are audited** (PostToolUse log), **who approves each phase** (plan mode enforces the explore/execute boundary).
- **OAuth staging→prod failure**: **redirect URIs are registered per host.** Add the production redirect URI, and check whether the customer requires **separate OAuth app registrations per environment**. Put it in the deploy checklist.

**CP6 (Jenkins reads key from file, 401)** → **B**: rotate the rejected key, **move the credential out of the file into a CI-injected env var**, and reference the variable in the MCP config. A alone keeps the file pattern; C changes the auth model unnecessarily.

## M3: Cumulative task (model answer)
1. `settings.json`: `"defaultMode": "bypassPermissions"` → change to **`acceptEdits`** and keep the `.env.production` deny.
2. `SKILL.md`: `/Users/priya/scripts/...` → **`$CLAUDE_PROJECT_DIR/scripts/validate-migration.sh`**.
3. `.mcp.json`: inline `Bearer sk-prod-...` → **`Bearer ${WAREHOUSE_MCP_TOKEN}`** and rotate the key.

---

# MODULE M4: Production Engineering, Evals & Security

## M4.0 Design document (written BEFORE code)
Four decisions, each concrete enough to check:
1. **Success criteria**: output for representative cases, specific enough to grade. These become the eval.
2. **Failure handling**: each error marked **retriable or terminal**, plus what the user gets when a failure is unrecoverable.
3. **Cost and latency budget**: per-request budget, monthly ceiling, latency target, and the **reliability floor**, set **before architecture**.
4. **Trust boundary**: which inputs are untrusted, and the **smallest set of actions and access** needed (least privilege → enforced by a hook).

## M4.1 Evals and judges

**MUST REMEMBER**
- An eval = **dataset of cases + expected behavior + grader → average score.** Write it **before** the feature so you define success rather than rationalize the output.
- A first score of 2–3/10 is normal. What matters is **the trend**. **Change ONE thing at a time** (prompt OR examples OR model).
- **Read per-case results, not just the average.** A flat average can hide 3 fixes plus 3 new breaks.
- Failure category → where to look: **formatting → output instructions; factual on retrieved content → retrieval; only on long input → context handling.**

**Grader choice**

| Output | Grader | Catches | Unreliable at |
|---|---|---|---|
| Single correct label or value | **Exact / string match** | A wrong answer, at ~zero cost | Any paraphrase or reordering |
| Structured or code | **Code-graded check** (`json.loads`, `ast.parse`, range or field checks) | Invalid JSON, unparseable code, missing fields | Whether the content is good |
| Open-ended quality | **LLM-as-judge** | Faithfulness, instruction following, tone | Noisy and costly; **meaningless until calibrated** |

- **Judge design**: ask for **strengths, weaknesses and reasoning before the score** (JSON). Without that, judges **drift toward ~6**.
- **Calibrate**: run the judge on **human-labeled cases** and measure agreement. If agreement is low, tighten the rubric, add good and bad examples, and re-measure.
- **Coverage beats perfection**: a large, slightly noisy set beats 3 hand-graded cases. Let Claude generate more cases from a labeled seed set, then **spot-check** them.
- Cost pattern: **code checks on every commit; the judge on a slower scheduled pass** (a 1,000-case judge eval = 1,000 extra API calls).
- **Validation checks shape, not correctness.** In the two-dates example ("ordered March 3, received April 12"), April 12 was extracted as the order date and passed every validation check. **The eval detects and guards; the prompt change fixes.** Ask the model to **enumerate edge cases** (two dates, no date, "next Tuesday") and turn them into graded cases.

**SYNTAX: eval and judge skeleton**
```python
def run_eval(dataset):
    results = [run_test_case(c) for c in dataset]
    average = sum(r["score"] for r in results) / len(results)

def validate_json(text):
    try: json.loads(text.strip()); return 10
    except json.JSONDecodeError: return 0

# Judge prompt returns JSON: "strengths" (1-3), "weaknesses" (1-3), "reasoning" (≤50 words), "score" (1-10)
```
**CP answers (summarization eval)**: meeting transcript → "lists all three action items **with their owners**"; bug report → "bug + repro steps, **omits the unrelated aside**"; bands **1–3 = misses required content**, **4–7 = partial**, **8–10 = complete and faithful**.

## M4.2 Testing and tracing

**MUST REMEMBER**
- **Unit**: one function in isolation. **Functional**: one Claude call returns the expected shape. **Integration**: the **handoff between two components** (**where most silent failures hide**). **End-to-end**: the whole flow (slowest, hardest to localize).
- A **trace** records each step (prompt, tool calls, intermediate outputs, timing) and tells you **which step** failed.
- **Seam bug**: `retrieve()` returns `[{"content": ...}]` but `build_prompt()` expects a string, so the model gets malformed context and **answers from memory**. Unit and functional tests both pass. **Fix: align the handoff and add an integration test using real retrieved data.**
```python
context = "\n".join(c["content"] for c in chunks)
prompt = build_prompt(question, context)
```
- **Retrieval routing**: a cheap classifier sends `lookup` → fetch-once and `multi_step` → agentic search. With uniform traffic, skip the router.

## M4.3 Failure handling

**MUST REMEMBER**
- One question: **would retrying the exact same request plausibly work?** Yes = **retriable**; no = **terminal**.
- **Retriable**: **429** (rate limit), **529** (overloaded; Anthropic-side load, **not** a rate-limit signal), **500, 502, 503, 504**. Timeouts are usually retriable, but **repeated timeouts on expensive requests mean you should fix the request**.
- **Terminal**: **400** (bad request), **401** (auth), **403** (permissions), **404**.
- **When unsure, treat it as terminal and raise.** A wrong "terminal" fails loudly and gets fixed; a wrong "retriable" hammers the service and hides the problem.
- **The SDK already retries transient errors** with backoff. **Don't stack your own loop on top**, because two layers multiply attempts. Pick one owner.
- **Honor `retry-after`** (sent on 429/529) first. Fall back to **exponential backoff with jitter and a cap**.
- **Never retry in a tight loop** (`time.sleep(0)`): each instant retry counts against the same limit and deepens it.
- **Tool errors** → return a `tool_result` with **`is_error: true`** and a message. **Never return an empty result**, or the model treats empty as valid data and gives a confident wrong answer.
- **Refusal** = HTTP **200** with `stop_reason: "refusal"`. **A status-code classifier won't catch it.** **Fail fast, raise, log; don't retry.**

**SYNTAX**
```python
RETRIABLE = {429, 529, 500, 502, 503, 504}
TERMINAL  = {400, 401, 403, 404}

def call_with_retry(make_call, max_attempts=5):
    for attempt in range(max_attempts):
        try:
            return make_call()
        except APIStatusError as e:
            if e.status_code not in RETRIABLE:
                raise                                  # terminal: fail fast
            wait = retry_after(e) or min(2 ** attempt + random.random(), 30)
            time.sleep(wait)                           # honor retry-after, else backoff + jitter
    raise RetryBudgetExhausted()
```

| Error | Retry? | Strategy | Fallback |
|---|---|---|---|
| 429 | Yes | Exponential backoff + jitter, honor retry-after, cap | Clean error or cached/simpler result |
| 529 | Yes | Backoff | Fail over, or a graceful error if it persists |
| 400 | No | — | Fix or reject the input; surface the error |
| Tool error | Only if the cause is transient | — | **is_error to Claude** |
| Refusal (200) | No | — | Raise, log |

## M4.4 Model selection (production)
- **Start with Sonnet.** Step **up** when an eval shows failures on hard, high-cost cases. Step **down** when an eval shows a cheaper model holds the bar on bulk traffic. **The eval is the gate for model changes.**
- A higher tier can be **cheaper and faster per request** if it finishes in fewer tokens. Include the **cost of a mistake** in the calculation.
- **Routing**: a default model plus an **override on a cheap signal** (task type, length, difficulty). With uniform traffic → **pin one model**.
- CP answers: millions of short labels, eval shows Haiku holds → **Haiku, cost at volume** · dependent refactor, Sonnet misses hard cases → **Opus, quality where errors are expensive** · mixed traffic → **route: Sonnet/Haiku default plus an Opus override**.

## M4.5 Cost and orchestration

**MUST REMEMBER**
- Instrument **three metrics on every call**: **token usage (input/output), latency, error rate**. Often one step accounts for ~90% of spend.
```python
log_metric(step=step_name, input_tokens=resp.usage.input_tokens,
           output_tokens=resp.usage.output_tokens, latency_ms=latency_ms)
```
- **Levers**: model choice · prompt and context size · number of tool calls · streamed vs batched · prompt caching.
- **Streaming** helps **perceived** latency (first token in ~300 ms) without changing total generation time.
- **Prompt caching economics**: **writes cost 1.25× base input (5-min TTL) or 2× (1-h TTL); reads cost 0.1×.** It only pays off when **reads outnumber writes**. Three conditions must hold: **identical prefix** (even adding "please" breaks it), **recurs within the TTL**, **long enough to clear the minimum**. **Automatic mode** (a single top-level cache flag) is the recommended start; explicit `cache_control` breakpoints are the alternative. Watch for **staleness** when the cached content reflects live data.
- **Batches API**: lower per-request cost (the checkpoint labels it **~50%**; the exact discount is version-pinned) for **non-urgent** work. **Batch + caching compound** on scheduled jobs with long fixed system prompts.
- **Orchestrator-worker**: the lead plans → workers fan out in parallel (each with its own context) → the lead synthesizes. Anthropic's research system (Opus 4 lead + Sonnet 4 workers) beat a single Opus 4 agent but used **~15× the tokens of a chat**. **Token usage explains most of the performance variance.**
  - Use it **only when the task splits into independent parallel parts** (e.g. research across many sources). **Not for tightly coupled work like coding.**
  - Use a **capable lead with cheaper workers**. Each worker needs **its own retry and backoff**; one stalled worker stalls synthesis.
- **Reliability floor first, then tune cost above it.** Example: 4 s latency ceiling and 3 retries. Every cost cut must stay within it. **The pinned eval baseline makes the floor enforceable.**
- CP answers: single-fact lookup on a stable corpus → **C** (small model, fetch_once) · broad research → **A** (orchestrator-worker) · user-facing "instant" → **D** (stream) · non-urgent batch → **B** (batch + cache).

## M4.6 Security

**MUST REMEMBER**
- **Prompt injection**: the model reads its whole context as **one token stream with no built-in trusted/untrusted boundary**. Instructions hidden in fetched pages, documents, emails, DB records or tool output act like commands. **It can be indirect** (planted for later) **or hidden** (white text, images).
- **Trusting your users doesn't help**, because injection arrives **through content**, not through the user.
- **Defense**: treat fetched or user-supplied content as **data, never instructions**. Delimiters help, but they're a **soft** boundary. Model training and classifiers are **probabilistic**. **The reliable boundary is what the agent is ALLOWED TO DO** (action side).
- **Jailbreak** (bypass the model's own safety) ≠ **prompt injection** (hijack the app's instructions). The defense has the same shape: validate input plus constrain actions.
- **Least privilege**: the identity gets only the permissions the task needs. Secrets live in **env vars or a secret manager**. **Anything that can modify the agent's auth config can act as that identity → protect it like a secret.** Least privilege bounds the blast radius when everything else fails.
- **Hooks = enforcement**; a prompt rule = convention. "**No prompt instruction is a security control.**"
- **Regulated review asks**: data residency, access logging (hook audit log), managed configuration. **ZDR eligibility varies by model and platform**; confirm at scoping via the Trust Center.
- **OS-level sandboxing** = the **residual control**: filesystem isolation (working dir) and network isolation (named endpoints only), enforced by the OS. It holds **even when a hook is missing or misconfigured** (e.g. a network call no hook covers). Security reviewers ask about this first. Configure it in Claude Code settings.

**SYNTAX: PreToolUse deny output**
```python
return {"hookSpecificOutput": {"hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": "write outside the permitted path"}}
```
Minimal secure config for a fetch-and-write agent = **4 controls**: (1) **PreToolUse hook** denying writes outside `/workspace/output`; (2) **deny rule** on `/etc`, `/secrets`, `~/.aws`; (3) **secret from env** (`os.environ["SERVICE_API_KEY"]`); (4) **audit log** on every privileged action.

| Threat | Enters via | Control | Log |
|---|---|---|---|
| Prompt injection | Fetched pages, docs, tool results | Treat as data + hook refuses actions triggered by untrusted input | Source, attempted action, block |
| Jailbreak | Crafted user prompt | Input validation + action constraint | Flagged prompt, refusal |
| Over-broad access | Identity scoped too wide | Least privilege, secret manager, locked auth config | Every privileged action + identity |
| Sandbox escape | FS or network access no rule covers | **OS-level sandbox** | Every out-of-bounds attempt |

## M4: Cumulative task (3 defects)
```python
page = fetch(page_url)                                   # untrusted
write_file(page.suggested_path, summarize(page))         # DEFECT 1 (security): path chosen by untrusted content → injection-driven write
for i in range(5):
    try: resp = client.messages.create(...); break
    except Exception: time.sleep(0)                      # DEFECT 2 (failure handling): catches everything, no retriable/terminal split, no backoff
return resp.content[0].text                              # DEFECT 3: resp may be None after exhausted retries → crash; no fallback
```
Fixes: fixed permitted output path plus a PreToolUse hook and audit log; retry only RETRIABLE codes with retry-after or backoff, jitter and a cap; raise a clean error or named fallback if `resp` is None, and check `stop_reason` (refusal). The course frames the layers as security / failure handling / eval-cost; know all three.

---

# MODULE M5: Accelerators & IP Contribution

## M5.1 Packaging for reuse

**MUST REMEMBER**
- An **accelerator** = a working build with the **reusable core separated from engagement-specific code**. Customer values are **exposed as parameters with documented defaults**. The next team **configures** it instead of rewriting it.
- **Package while the build is fresh.** Knowledge of what's customer-specific is the most expensive thing to reconstruct later.
- Asset types:

| Asset | Bundles | Correct packaging |
|---|---|---|
| **Agent template** | System prompt, tool schemas, loop | Domain values pulled into config with defaults |
| **MCP server package** | Tools, inputs, scope | Document every tool input; **the installing team sets scope** |
| **Eval suite** | Dataset + judge rubric | Ship them together. **Also the deployment gate** (run against a pinned baseline before promoting) |

- Most common mistake: shipping an agent as **loose scripts** that get copied and diverge.
- **Document assumptions** (environment, expected inputs, handled failures, the eval that defines "working"), not just code.
- **Bundle audit info**: data touched, identity used, log of actions. Without it, the build passes a demo and stalls at security review.
- Warning signs of a non-reusable template: **no parameters, no assumptions doc, no bundled eval**.
- Don't package one-offs; just ship them.

**SYNTAX: CP1**
```python
# BROKEN: repo_path="/home/acme/checkout-service"
def build_review_agent(repo_path: str):
    return Agent(model=MODEL_ID, system_prompt=SYSTEM_PROMPT,
                 tools=[read_file, run_linter], repo_path=repo_path)
```

## M5.2 Contributing back

**MUST REMEMBER**
- **Match the contribution to its channel.** **Claude Cookbook** (GitHub) = **focused reference implementations** of a single or multi-pattern idea, end to end. **MCP servers and tools** → **their own repositories** with their own conventions. **A full multi-component application sent to the Cookbook stalls**; strip it down to the reusable pattern first.
- **Maintainers accept what they can verify**: (1) **code that does one thing**; (2) **a runnable example**; (3) **a test that proves the behavior**; (4) **a short statement of assumptions**.
- **Licensing and attribution come before technical review.** Engagement code may carry restrictions. If you can't clear them, **don't contribute; escalate to the owner.**
- The Developer's job is **technical readiness**; engagement context comes from the broader team.
- CP2 answers: focused API wrapper → **the tool's own repository**, missing **a test** · full app → **the Cookbook only after stripping to a focused pattern**, missing **reduction to one pattern** · one-line fix to a Cookbook example carried in from an engagement → **the Cookbook example's own repository**, missing **the rights check**.

## M5.3 Requirements and lifecycle

**MUST REMEMBER**
- A **functional requirement** = a checkable statement of behavior ("classify into one of 4 queues; draft a reply citing policy; **never auto-send without human approval**").
- **Infrastructure (non-functional) requirements** are derived by asking: **latency** (measured where the user is), **scale** (volume and peak), **residency** (where, and which regulation), **identity** (who acts, what credentials, what's audited). These four most often decide the platform.
- Keep a **requirements record** (behaviors, constraints, and the regulation behind each) so the platform choice can be defended.
- CP3: functional → **"produces a summary a human approves before it's stored."** Infrastructure → **"transcript data is processed in the EU."** "Fast and accurate" is vague and isn't a requirement.
- **Lifecycle**: Requirements → Design → Build → Test → Deploy → Operate → Iterate. **Gates** between phases: don't build until the platform meets residency; don't promote until the eval clears the pinned baseline.
- CP4 answers: pin the full model ID and keep the prior version → **deploy** · gate promotion on the eval → **deploy** · data must be processed in a region → **requirements** · instrument cost and latency per call → **operate** · choose Bedrock for the customer's compliance posture → **design**.

## M5.4 Deployment platforms and versioning

**MUST REMEMBER**
- **The customer's existing cloud and compliance posture usually decides the platform.**

| Platform | Identity / data | Choose when | Version pinning |
|---|---|---|---|
| **First-party Claude API** | Anthropic | No binding cloud or residency constraint; wants the **newest features first** | Pin the full model ID; keep the prior snapshot |
| **Claude Platform on AWS** | Anthropic identity via the customer's AWS account; **inference is Anthropic-operated, outside the AWS boundary** | On AWS but wants **Anthropic model IDs, lifecycle and feature parity** | Same ID format as the API (e.g. `claude-opus-4-8`); Anthropic's schedule |
| **Claude in Amazon Bedrock** | Messages API at **`/anthropic/v1/messages`**; data **inside the customer's AWS boundary** | On AWS, compliance posture there, broad parity | Full model ID with the **`anthropic.` prefix**; **partner retirement dates differ** |
| **Claude on Amazon Bedrock (legacy)** | InvokeModel / Converse; **ARN-versioned IDs** | Existing integration not yet migrated | ARN-versioned identifiers |
| **Google Vertex AI** | Google Cloud IAM and billing; regional or global endpoints | On GCP with a compliance posture there | Vertex ID format; partner retirement dates differ |
| **Third-party (e.g. Microsoft Foundry)** | The wrapping product. Foundry: **Hosted on Azure** (Opus 4.8, Sonnet 5, Haiku 4.5; inference on Azure) vs **Hosted on Anthropic** (all others) | The customer already runs that platform | Per-platform controls; **confirm residency per model** |

- **Pin the full model ID, not the alias.** Aliases (`opus`, `claude-haiku-4-5`) move. **For Claude 4.6 and later, the model ID alone pins a snapshot; earlier models need the date suffix** (e.g. `claude-haiku-4-5-20251001`).
- **Version the prompt and asset alongside the code; keep the prior version** so a regression is a rollback, not a hotfix.
- **Promote through the eval**: canary a portion of traffic, compare against the pinned baseline, then promote or roll back.
- Watch out: `model="opus"` → the alias advanced → output shape changed → parser `KeyError` → **no pinned prior version to roll back to**.
- CP5 (AWS + residency + rollback) → **Amazon Bedrock + AWS identity reference + pinned full model ID + retain the prior pinned version.**

## M5.5 Comparing platforms

**MUST REMEMBER**
- **Latency**: measure **from the customer's actual region with their actual payload**, not from your laptop. In-region cloud usually wins on round trip; **the first-party API gets features first**. In Bedrock, **global vs regional endpoints** are the main residency control and can affect cost.
- **Compliance is often pass-or-fail** for regulated customers. **The cloud the customer has already certified wins** because it needs no re-certification. **The first-party API may not offer EU residency → EU-only usually means Bedrock or Vertex.** **Anthropic-hosted Foundry models don't meet EU regional residency.**
- **Cost**: per-token rates are **broadly similar** across platforms. **Total cost** moves with **egress, platform fees and integration effort**. Measure total cost per call.
- When compliance is already pass-or-fail, **skip the full comparison**; that constraint decides.
- Watch out: platform picked on **familiarity** → rejected on residency at the security review → rebuild. **Raise compliance during scoping.**
- CP6 → **Option 2**: re-measure from eu-west and pick the platform whose region meets EU-only residency.

## M5.6 Multi-component apps and trust boundaries

**MUST REMEMBER**
- **Map which component does what before connecting anything.** Example: the API (entry and orchestration) → a Claude Code task (agentic work, may fetch external content) → an MCP server (reaches the customer's system).
- **Trust boundary** = wherever data or instructions cross between deployment environments. **Mark every seam as a boundary.** **A component trusted in isolation doesn't make the seam leaving it trustworthy.**
- **The app is only as contained as its most privileged seam.** Scope each component to least privilege.
- **When a seam can't be secured, escalate to a human owner; don't ship around it.**
- For regulated deployments, Bedrock and Vertex typically meet regional residency. Confirm **ZDR and HIPAA BAA eligibility per component**.

| Component | Seam boundary | Control |
|---|---|---|
| First-party API | Request entering from outside | Input validation + the call's identity |
| Claude Code task | Fetched content (untrusted downstream) | **Treat it as data at the next seam** |
| MCP server | System access held on the app's behalf | **Least privilege + log access** |

- CP7: Blank 1 → **`treat_as_data`**; Blank 2 → **`least_privilege_read_only`**. (`run_as_instructions` and `full_access` are distractors.)

## M5: Cumulative task (model answer)
1. **Packaging**: hardcoded `repo_path="/home/acme/checkout"` → `build_agent(repo_path)`.
2. **Versioning**: `model="opus"` alias → pinned full Bedrock ID **`us.anthropic.claude-opus-4-8`** plus **`retain_previous_pinned_version=True`**.
3. **Trust boundary**: `next_call(input=fetched)` → **`next_call(input=treat_as_data(fetched))`**.
4. Then verify: `assert eval_suite.run(model=...) >= baseline_score` before promoting.

---

# Cross-module "first thing to check" debug table

| Symptom | Check FIRST | Not this |
|---|---|---|
| Output in the wrong shape | Missing output constraint or structured outputs | Rewording the prompt |
| Behavior drifts over turns | System prompt specificity | More examples |
| `invalid_request_error` after a tool call | tool_use_id pairing and turn order | Tool description |
| Validation error on a **retry** after streaming | Partial turn from a dropped stream committed to history | Schema |
| Wrong tool picked every time | Overlapping descriptions (add when-NOT) | Required array |
| Wrong tool picked **after turn N** | Context window filling (prune and compact) | Schema or max_tokens |
| Request rejected after removing thinking blocks | Thinking blocks must return unchanged | Token budget |
| Skill works in Claude Code, not in the SDK | `settingSources` not set | Skill description |
| Explore subagent ignored a CLAUDE.md rule | Explore/Plan skip CLAUDE.md → use general-purpose or custom | Rule wording |
| Rule in CLAUDE.md ignored | File size and dilution; move the critical rule to a hook | Repeating the rule |
| Plugin works only for its author | Absolute paths or undocumented env vars | Marketplace |
| OAuth works in staging, fails in prod | Redirect URI not registered for the prod host | Code |
| Unit and functional green, E2E red | Integration seam (format contract) | Parser or prompt wording |
| Rate-limit errors despite "batching" | Synchronous calls in a loop → Message Batches API | Smaller chunks |
| Bill ×15, quality ~same | Fan-out on a coupled task → single agent | More workers |
| Agent wrote a file nobody asked for | Prompt injection from fetched content → treat as data, hook, least privilege | Trusting users |
| Prod broke when nothing in the app changed | Unpinned model alias | Parser hotfix |
| Security review rejects the platform | Residency or compliance not scoped early | Latency tuning |

# Beta headers and identifiers to memorize
- `mcp-client-2025-11-20`: API MCP connector (`mcp_toolset`)
- `code-execution-2025-08-25` + `skills-2025-10-02`: Skills on the Messages API
- `managed-agents-2026-04-01`: Claude Managed Agents
- Agent SDK packages: `claude-agent-sdk` (Python), `@anthropic-ai/claude-agent-sdk` (TS)
- Env vars for paths: `$CLAUDE_PROJECT_DIR`, `${CLAUDE_PLUGIN_ROOT}`
- MCP permission rule format: `mcp__<server>__<tool>`
- Bash permission rule format: `Bash(npm run:*)`, `Bash(rm:*)`; file rule: `Read(.env.production)`, `Edit(*)`

> Gaps: a few tabbed panels in the M2 prompting and agent-wiring screens (separate XML / few-shot / output-constraint tabs, Agent SDK and Managed Agents tabs) didn't render when extracted. Their content is covered by the surrounding tables above. The course itself says to confirm version-pinned numbers (prices, discounts, model IDs, limits) against platform.claude.com.

---
<!-- nav:start -->
> ⬅️ [[claude-dev-exam-prep/00-mso-foundations-notes|M1 Foundations notes]] · 🏠 [[claude-dev-exam-prep/Developer Exam Prep|Developer index]] · [[Claude Certifications|Home]] · [[claude-dev-exam-prep/02-commute-recall|Commute recall]] ➡️
<!-- nav:end -->
