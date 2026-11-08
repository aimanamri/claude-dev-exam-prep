# 09: Deployment, Cost and Operations

<!-- nav:start -->
> ⬅️ [[claude-dev-exam-prep/helpdesk-project/08-rpa-and-automation|Helpdesk: RPA]] · 🏠 [[claude-dev-exam-prep/Developer Exam Prep|Developer index]] · [[Claude Certifications|Home]] · [[claude-dev-exam-prep/prompts/architect-foundations-session-prompt|Architect build prompt]] ➡️
<!-- nav:end -->


> Modules: **M4** model selection, cost/latency instrumentation, prompt caching, reliability floor · **M5** platform choice, version pinning, eval-gated promotion, comparing platforms, packaging as an accelerator, contributing back

---

## 9.1 Platform decision (M5)

| If the requirements say... | Choose | Client |
|---|---|---|
| No binding residency; want the newest features and server-side refusal fallback | **First-party Claude API** | `anthropic.Anthropic()` |
| Data must stay in the company's AWS account / region | **Claude in Amazon Bedrock** (Messages API, `anthropic.` model prefix, region pinned) | `AnthropicBedrockMantle(aws_region=...)` |
| Company is on Google Cloud with a compliance posture there | **Vertex AI** (regional or `eu`/`us` multi-region endpoint) | `AnthropicVertex(project_id=..., region=...)` |
| Company is on AWS but wants Anthropic's model IDs, lifecycle and feature parity, and accepts inference outside the AWS boundary | **Claude Platform on AWS** | see Anthropic's docs for the client setup |

Measure latency **from the users' region with real payloads** (not a developer laptop), confirm **ZDR/retention eligibility per model** at scoping, and compare **total** cost (egress, platform fees, integration effort), not token price alone.

```python
# helpdesk/llm_platform.py
"""Platform-aware client factory. Server-side `fallbacks` exist only on the Claude API
(and Claude Platform on AWS); on Bedrock/Vertex use the SDK refusal middleware or handle
stop_reason == "refusal" in code (the agent already does)."""
import os

import anthropic

PLATFORM = os.environ.get("HELPDESK_PLATFORM", "anthropic")   # anthropic | bedrock | vertex


def make_client_and_model():
    if PLATFORM == "bedrock":
        from anthropic import AnthropicBedrockMantle
        return (AnthropicBedrockMantle(aws_region=os.environ["AWS_REGION"]),
                "anthropic.claude-opus-5-5", False)
    if PLATFORM == "vertex":
        from anthropic import AnthropicVertex
        return (AnthropicVertex(project_id=os.environ["GCP_PROJECT"],
                                region=os.environ.get("VERTEX_REGION", "europe-west1")),
                "claude-opus-5-5", False)
    return anthropic.Anthropic(max_retries=3), "claude-opus-5-5", True


client, MODEL_ID, SERVER_FALLBACKS = make_client_and_model()


def create_message(**kwargs):
    if SERVER_FALLBACKS:
        return client.beta.messages.create(betas=["server-side-fallback-2026-07-01"],
                                           fallbacks="default", **kwargs)
    return client.messages.create(**kwargs)
```

---

## 9.2 Version everything that changes behavior (M5)

| Artifact | How it's pinned | Rollback target |
|---|---|---|
| Model | Full model ID `claude-opus-5-5` (4.6+ IDs pin a snapshot; never a moving alias like `opus`) | The previous ID kept in config |
| Prompts | `PROMPT_VERSION = "2026.11.1"` in `prompts.py`, in git | The previous git tag |
| Tool schemas | Versioned with the prompts (descriptions change routing) | Same tag |
| Policy rules | `policy.py` in git, change via PR + Identity review | Same tag |
| Eval baseline | `evals/baseline.json` (scores per case) | n/a |

```python
# helpdesk/release.py
"""Canary: send a share of sessions to the candidate config; promote only via the eval gate."""
import hashlib
import os

STABLE = {"model": os.environ.get("MODEL_STABLE", "claude-opus-5-5"), "prompt_version": "2026.10.2"}
CANDIDATE = {"model": os.environ.get("MODEL_CANDIDATE", "claude-opus-5-5"), "prompt_version": "2026.11.1"}
CANARY_PERCENT = int(os.environ.get("CANARY_PERCENT", "10"))


def config_for_session(session_id: str) -> dict:
    bucket = int(hashlib.sha256(session_id.encode()).hexdigest(), 16) % 100
    return CANDIDATE if bucket < CANARY_PERCENT else STABLE      # sticky per session
```

```python
# ci/eval_gate.py
"""Release gate (H8). Fails the pipeline unless the candidate:
 - passes every safety case, and
 - is not worse than the pinned baseline on any category by more than 2 points."""
import json
import subprocess
import sys
from collections import defaultdict

BASELINE = "evals/baseline.json"
RESULTS = "evals/last_run.json"


def by_tag(results: list[dict], cases: dict[str, dict]) -> dict[str, float]:
    buckets = defaultdict(list)
    for r in results:
        for tag in cases[r["id"]].get("tags", ["untagged"]):
            buckets[tag].append(r["passed"])
    return {t: 100 * sum(v) / len(v) for t, v in buckets.items()}


def main() -> int:
    run = subprocess.run([sys.executable, "-m", "evals.run_eval", "evals/cases.jsonl"])
    with open("evals/cases.jsonl", encoding="utf-8") as f:
        cases = {c["id"]: c for c in (json.loads(line) for line in f if line.strip())}
    results = json.load(open(RESULTS, encoding="utf-8"))
    baseline = json.load(open(BASELINE, encoding="utf-8"))
    current = by_tag(results, cases)
    failures = [f"{tag}: {current.get(tag, 0):.0f}% < baseline {base:.0f}%"
                for tag, base in baseline.items() if current.get(tag, 0) < base - 2]
    if run.returncode != 0:
        failures.append("run_eval gate failed (safety case or overall < 90%)")
    for f in failures:
        print("GATE FAIL:", f)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
```

**Rollout stages (each one is gated):**
1. **Shadow**: the bot drafts triage and replies for L1 only; no tools that change anything. Measure SC accuracy on real traffic.
2. **Read-only tools**: KB, service status, account status, tickets.
3. **Unlock** with MFA (+ L1 approval when risky).
4. **Reset** with MFA + L1 approval (H1).
5. *(Later, evidence-gated)* **Risk-based H1**: L1 approval only for new device or location. Requires ≥ 3 months of clean audit, zero SR violations, and the safety eval at 100%.

---

## 9.3 Model selection and routing (M4)

The code defaults to `claude-opus-5-5` on every route. Moving any route to a cheaper tier is a **measured decision**:

| Route | Candidate | Promote only if the eval shows... | Notes |
|---|---|---|---|
| Triage (email + chat) | `claude-haiku-5-5` (Haiku) | Category accuracy within 1 pt of Opus **and** SECURITY_INCIDENT recall still 100% | Haiku 5.5 has **no** server-side fallback; don't send `fallbacks`, handle `refusal` in code |
| FAQ answers from KB | `claude-sonnet-5-5` (Sonnet) | Judge score not lower in any band; faithfulness 100% | Sonnet's default effort is `high`; set it explicitly |
| Agent turns (tools + HITL) | stay on `claude-opus-5-5` | n/a | Wrong-tool errors here are costly, so quality wins |

Before building a multi-model cascade, try **the same model at lower effort** first: one model keeps one prompt-cache namespace and often matches a cheaper tier on simple routes. Judge **cost per resolved conversation**, not cost per request.

```python
# helpdesk/router.py
import os

ROUTES = {
    "triage": {"model": os.environ.get("MODEL_TRIAGE", "claude-opus-5-5"), "effort": "low"},
    "faq": {"model": os.environ.get("MODEL_FAQ", "claude-opus-5-5"), "effort": "low"},
    "agent": {"model": os.environ.get("MODEL_AGENT", "claude-opus-5-5"), "effort": "medium"},
}


def route(kind: str) -> dict:
    return ROUTES[kind]
```

---

## 9.4 Cost model and instrumentation (M4)

Prices below are the per-million-token list prices cached in Anthropic's reference as of Oct 2026. **Confirm current pricing at build time.**

| Model | Input $/MTok | Output $/MTok |
|---|---|---|
| `claude-opus-5-5` | 4.00 | 20.00 |
| `claude-sonnet-5-5` | 2.00 | 10.00 |
| `claude-haiku-5-5` | 0.10 (≤100K prompt) | 0.50 |

Cache economics: writes cost ~**1.25×** base input (5-min TTL) or 2× (1 h); reads ~**0.1×**. Batches API: ~**50%** off.

```python
# helpdesk/cost.py
PRICES = {  # USD per million tokens; refresh from the pricing page at build time
    "claude-opus-5-5": (4.00, 20.00),
    "claude-sonnet-5-5": (2.00, 10.00),
    "claude-haiku-5-5": (0.10, 0.50),
}


def call_cost(model: str, usage) -> float:
    inp, out = PRICES[model]
    cache_write = getattr(usage, "cache_creation_input_tokens", 0) or 0
    cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0
    return (usage.input_tokens * inp
            + cache_write * inp * 1.25
            + cache_read * inp * 0.10
            + usage.output_tokens * out) / 1_000_000
```

**Worked estimate for one agent conversation (Opus 5.5, illustrative):**
| Per model call | Tokens | Cost |
|---|---|---|
| Cached prefix (tools + system) read | 4,000 × 0.1 | $0.0016 |
| Uncached input (session block + history + tool results) | 2,500 | $0.0100 |
| Output incl. thinking at `medium` | 1,200 | $0.0240 |
| **Per call** | | **≈ $0.036** |
| Calls per conversation (avg 3 tool turns) | × 3.5 | **≈ $0.13** |

At 2,400 conversations/month ≈ **$300**, inside the $800 ceiling and the $0.25/conversation target (design doc 6.3). Real numbers come from the `model_call` audit events (tokens per call), so you can see **which step** dominates spend instead of guessing from the invoice.

**Caching checklist (silent invalidators):**
- The system prompt is byte-identical across users. Per-user data goes in the **second** system block, after the breakpoint (file 03).
- The tool list is in a deterministic order and doesn't vary per request.
- No timestamps or UUIDs in the cached prefix.
- Verify that `usage.cache_read_input_tokens > 0` on the second call of every session; alert if it's zero.

---

## 9.5 Operating metrics (dashboard)

| Area | Metric | Source | Target / alert |
|---|---|---|---|
| Value | Deflection rate | ITSM auto-closed ÷ conversations | ≥ 40% |
| Value | Unlock time p50 | audit timestamps | < 3 min |
| Quality | Escalations needing an info round trip | ITSM reassign/reopen | < 10% |
| Quality | Nightly eval score / safety score | eval runs | ≥ 90% / 100% |
| Safety | SR violations (wrong-user action, protected change) | audit + SOC review | **0** (page on any) |
| Safety | Policy blocks, output-guard triggers | audit | Trend review weekly |
| HITL | Approval latency, < 5 s approvals, expiry rate | approvals table | See file 07 §7.8 |
| Cost | $ per resolved conversation, cache-hit ratio | `model_call` events | ≤ $0.25; cache reads > 60% of input |
| Reliability | Error rate by type (429/529/5xx/refusal/tool) | audit | Alert at > 2% |
| Latency | First token p95 (chat), tool turn p95 | traces | < 2 s, < 8 s |

**Reliability floor before cost (M4):** no cost change (cheaper model, lower effort, fewer retries) ships unless the safety eval stays at 100% and the latency/error budgets hold.

---

## 9.6 Package it as an accelerator (M5)

Parameterize what changes per customer or tenant, document the assumptions, and bundle the eval and audit pieces:

```yaml
# helpdesk-accelerator/config.example.yaml   (copied and filled per engagement)
tenant:
  name: "ACME"
  sso_issuer: "https://login.microsoftonline.com/<tenant-id>/v2.0"
directory:
  type: "ad_ldaps"                     # or "entra_graph"
  ldaps_host: "${AD_LDAPS_HOST}"
  users_base_dn: "OU=Employees,DC=acme,DC=example"
  protected_groups: ["Domain Admins", "Enterprise Admins", "Helpdesk-Bot-Protected"]
itsm:
  type: "servicenow"
  instance: "${SNOW_INSTANCE}"
  assignment_groups: {L1: "SERVICE_DESK_L1", IAM: "IDENTITY_IAM", DESKTOP: "DESKTOP_L2",
                      NETWORK: "NETWORK_OPS", SOC: "SOC"}
hitl:
  approver_group: "SG-ServiceDesk-L1"
  approval_ttl_seconds: 600
  reset_requires_l1: true
limits:
  max_resets_per_day: 3
  max_agent_turns: 8
model:
  id: "claude-opus-5-5"
  platform: "anthropic"                # anthropic | bedrock | vertex
```

| Accelerator piece | What ships | What the next team configures |
|---|---|---|
| Agent template | Prompts, tool schemas, loop, policy, HITL | `config.yaml` values (no code edits) |
| MCP servers + ops plugin | `helpdesk-ad`, `helpdesk-itsm`, hooks, skill | Endpoints, tokens via env, scope |
| Eval suite | `cases.jsonl`, graders, judge rubric, gate script | Tenant-specific cases added; baseline re-pinned |
| Audit bundle | Event schema, hash chain, digest script | SIEM destination, retention |
| Docs | Assumptions (AD delegation, SSO claims, MFA provider API), required env vars, failure modes | n/a |

**Contributing back:** the reusable *pattern* (e.g. "policy gate + MFA + HITL approval around tool calls") can go to the Cookbook as a **focused example with a runnable demo and a test**, after confirming you have the **rights** to contribute code built during a customer engagement. The full helpdesk application doesn't belong there.

---

## 9.7 Final checklist mapped to the course

| ✔ | Item | Module |
|---|---|---|
| ☐ | Requirements (business, ops, functional, infrastructure) written and signed off | M5 |
| ☐ | Design doc: success criteria, failure handling, cost budget, trust boundary | M4 |
| ☐ | Workflow vs agent chosen per path; simplest pattern first | M2 |
| ☐ | Prompts: system contract, XML data framing, few-shot, structured outputs; no temperature, no prefill | M1, M2 |
| ☐ | Tool descriptions with when/when-not; `strict: true`; no target-user params | M2 |
| ☐ | Loop: full `response.content` appended; all tool_results in one user turn; `is_error` on failures; exit after 8 turns | M2, M4 |
| ☐ | HITL H1–H8 enforced in code, fail-closed, audited, monitored for rubber-stamping | M2, M3 |
| ☐ | Policy gate, MFA step-up, protected accounts, least-privilege AD delegation, kill switch | M4, M5 |
| ☐ | MCP: HTTP + project/enterprise scope, env-referenced secrets, `ask` rules + hooks, plugin | M3 |
| ☐ | Memory scope per session shape; summarizer schema; append-only history | M2 |
| ☐ | Eval set + code graders + calibrated judge + batch regression; 4 test levels; tracing | M4 |
| ☐ | Platform and region per residency; pinned model + prompt versions; canary + eval gate | M5 |
| ☐ | Per-call cost/latency/error metrics; caching verified; reliability floor respected | M4 |
| ☐ | Packaged as a parameterized accelerator with bundled eval and audit | M5 |

## 9.8 Project-wide trade-off summary
| Decision | We chose | Main trade-off | Revisit when |
|---|---|---|---|
| Wiring path | Raw Messages API loop | More code to own | Never for the action path (gates must sit in our code) |
| HITL on resets | Always (v1) | L1 load, user wait | 3 months of clean audits + eval evidence |
| Model | Opus 5.5 everywhere | Higher per-token cost | The eval shows a cheaper tier holds per route |
| Email channel | Triage-only | Lower deflection | Never for actions (identity can't be proven by email) |
| Memory | Ticket-scoped summaries | Detail loss | If L1 reports missing context → expand the summary schema |
| MCP connector | Read-only KB only | Less convenience | Never for AD actions (no HITL hook point) |
| Platform | Per residency requirement | Feature lag on some platforms | When residency rules or platform features change |

---
<!-- nav:start -->
> ⬅️ [[claude-dev-exam-prep/helpdesk-project/08-rpa-and-automation|Helpdesk: RPA]] · 🏠 [[claude-dev-exam-prep/Developer Exam Prep|Developer index]] · [[Claude Certifications|Home]] · [[claude-dev-exam-prep/prompts/architect-foundations-session-prompt|Architect build prompt]] ➡️
<!-- nav:end -->
