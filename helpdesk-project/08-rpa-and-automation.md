# 08: RPA and Automation Patterns

<!-- nav:start -->
> ⬅️ [[claude-dev-exam-prep/helpdesk-project/07-evaluation-and-testing|Helpdesk: evaluation]] · 🏠 [[claude-dev-exam-prep/Developer Exam Prep|Developer index]] · [[Claude Certifications|Home]] · [[claude-dev-exam-prep/helpdesk-project/09-deployment-cost-operations|Helpdesk: deployment]] ➡️
<!-- nav:end -->


> Modules: **M1** sync vs async vs batch · **M2** workflow vs agent, Message Batches API, structured outputs · **M3** Claude Code headless, `dontAsk` mode for CI · **M4/M5** trust boundaries between components

**RPA (UiPath, Power Automate) is deterministic "hands" for systems without good APIs. Claude is the "reader" for unstructured text.** The safe combination: **Claude turns messy text into a strict, enum-based JSON contract, and RPA runs a fixed, pre-approved workflow per contract value.** RPA never executes free-form instructions produced by the model.

---

## 8.1 Choose the pattern per job

| Job | Pattern | Why |
|---|---|---|
| Inbound helpdesk mailbox → tickets | **Power Automate → triage API (Stage 1) → ITSM** | Same 3 steps every time: a workflow. Email is untrusted, so triage only |
| Legacy firewall-request portal with no API | **UiPath runs the form fill *after* CAB approval** | The GUI needs RPA; the human approval (H5) happens before the bot touches anything |
| 500 unread backlog emails after a holiday | **Batches API** (overnight, ~50% cheaper) | Nobody is waiting; volume would hit sync rate limits |
| Daily ops digest email (FR-8) | **Scheduled script + structured output → review queue (H3)** | Code computes the numbers; Claude writes the narrative; a human sends |
| Weekly lockout-trend report for the Identity team | **Claude Code headless in CI** with locked-down permissions | Exploratory analysis over files and MCP reads |
| Employee chat | **Agent** (file 03), not RPA | Variable inputs, needs live tools and HITL |

---

## 8.2 The triage API that RPA calls

```python
# helpdesk/rpa_bridge.py
"""HTTP bridge for RPA platforms (Power Automate HTTP action, UiPath HTTP Request).
Email-originated content is untrusted → channel 'email_rpa' → triage + ticket only."""
import hashlib
import hmac
import os

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from .integrations import itsm
from .triage import Triage, TriageError, triage

app = FastAPI()
_seen: dict[str, dict] = {}          # idempotency cache; use Redis/DB in production

GROUP_BY_CATEGORY = {
    "AD_ACCOUNT": "SERVICE_DESK_L1", "PASSWORD": "SERVICE_DESK_L1",
    "M365_OFFICE": "DESKTOP_L2", "NETWORK_VPN": "NETWORK_OPS",
    "FIREWALL_ACCESS": "NETWORK_OPS", "SECURITY_INCIDENT": "SOC", "OTHER": "SERVICE_DESK_L1",
}


class InboundEmail(BaseModel):
    message_id: str = Field(max_length=200)
    from_upn: str = Field(max_length=200)        # resolved by the RPA flow from the sender address
    subject: str = Field(max_length=300)
    body: str = Field(max_length=20000)          # cap untrusted input size


class TriageResponse(BaseModel):
    message_id: str
    triage: Triage
    ticket: str | None
    rpa_next_action: str                         # a fixed enum the RPA flow switches on


def _check_key(x_api_key: str) -> None:
    expected = os.environ["RPA_BRIDGE_KEY"]
    if not hmac.compare_digest(hashlib.sha256(x_api_key.encode()).digest(),
                               hashlib.sha256(expected.encode()).digest()):
        raise HTTPException(401, "bad key")


@app.post("/v1/triage", response_model=TriageResponse)
def triage_email(email: InboundEmail, x_api_key: str = Header(...)):
    _check_key(x_api_key)
    if email.message_id in _seen:                # RPA retries must not create duplicate tickets
        return _seen[email.message_id]
    try:
        t = triage(f"Subject: {email.subject}\n\n{email.body}")
    except TriageError:
        t = Triage(category="OTHER", priority="P3", self_service_possible=False,
                   summary=email.subject[:120], secondary_issues=[], missing_info=[])
    ticket = itsm.create_incident(
        caller_upn=email.from_upn, category=t.category, priority=t.priority,
        assignment_group=GROUP_BY_CATEGORY[t.category],
        short_description=t.summary,
        description=f"Received by email ({email.message_id}).\n\n{email.body[:5000]}",
    )["number"]
    # The RPA flow branches ONLY on these fixed values: never on free text from the model.
    if t.category == "SECURITY_INCIDENT":
        action = "PAGE_SOC"
    elif t.self_service_possible and t.category in {"AD_ACCOUNT", "PASSWORD"}:
        action = "REPLY_WITH_TEAMS_BOT_LINK"     # identity is proven in Teams, not by email
    elif t.missing_info:
        action = "REPLY_REQUEST_INFO"
    else:
        action = "ACK_TICKET"
    result = TriageResponse(message_id=email.message_id, triage=t, ticket=ticket,
                            rpa_next_action=action)
    _seen[email.message_id] = result
    return result
```

**Power Automate flow (helpdesk mailbox)**
1. Trigger: *When a new email arrives (V3)* on `helpdesk@corp.example`.
2. *Office 365 Users – Get user profile* (sender → UPN; external senders → `OTHER`).
3. *HTTP* POST `https://helpdesk-api.internal/v1/triage` with header `x-api-key` from the **environment variable / Key Vault connector** (never typed into the flow).
4. *Switch* on `rpa_next_action`:
   - `PAGE_SOC` → post to the SOC Teams channel + PagerDuty.
   - `REPLY_WITH_TEAMS_BOT_LINK` → templated reply: "Use the IT Assistant in Teams to unlock or reset securely."
   - `REPLY_REQUEST_INFO` → templated reply listing `missing_info`.
   - `ACK_TICKET` → templated acknowledgement with the ticket number.
5. Move the email to the *Processed* folder.

> The replies are **templates filled with fields**, not free text from the model. That keeps the untrusted-email path free of injection-driven content reaching staff.

**UiPath variant:** *HTTP Request* activity (POST, JSON body, `x-api-key` header from Orchestrator **Credential Asset**) → *Deserialize JSON* → *Switch* on `rpa_next_action`.

---

## 8.3 RPA executing an approved firewall change in a legacy portal (H5)

```
request_firewall_change (agent, file 03)
        │  creates CHG ticket with structured fields
        ▼
CAB approval in ITSM  ◄──── HUMAN GATE (H5): nothing happens before this
        │  ITSM state = "Approved – Ready for implementation"
        ▼
UiPath Orchestrator queue trigger (polls ITSM for approved CHGs, category FIREWALL_ACCESS)
        │  reads ONLY the structured fields: source, destination, port_protocol, duration
        ▼
UiPath robot fills the legacy firewall portal form → screenshot → attaches to CHG
        ▼
Network Ops verifies (second human check) → CHG closed
```
Rules: the robot account can only *submit* requests in the portal, not approve them (least privilege). Field values are validated against regexes (IP/CIDR, `TCP|UDP \d+`) before typing, so a malformed or injected value stops the robot instead of being typed.

---

## 8.4 Overnight backlog triage with the Batches API

```python
# automation/backlog_batch.py
"""Triage a large email backlog overnight (no user waiting → Batches API).
No `fallbacks` here: the Batches API rejects that parameter."""
import json
import time

import anthropic
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
from anthropic.types.messages.batch_create_params import Request

from helpdesk.config import EFFORT_TRIAGE, MODEL
from helpdesk.prompts import TRIAGE_SCHEMA, TRIAGE_SYSTEM

client = anthropic.Anthropic()


def submit_backlog(emails: list[dict]) -> str:
    """emails: [{"message_id", "subject", "body"}] → batch id (<=100k requests / 256 MB)."""
    batch = client.messages.batches.create(requests=[
        Request(
            custom_id=e["message_id"][:64],
            params=MessageCreateParamsNonStreaming(
                model=MODEL,
                max_tokens=2048,
                system=[{"type": "text", "text": TRIAGE_SYSTEM,
                         "cache_control": {"type": "ephemeral"}}],
                output_config={"effort": EFFORT_TRIAGE,
                               "format": {"type": "json_schema", "schema": TRIAGE_SCHEMA}},
                messages=[{"role": "user",
                           "content": f"<ticket>\nSubject: {e['subject']}\n\n{e['body'][:20000]}\n</ticket>"}],
            ),
        )
        for e in emails
    ])
    return batch.id


def wait_and_collect(batch_id: str) -> dict[str, dict]:
    while True:
        b = client.messages.batches.retrieve(batch_id)
        if b.processing_status == "ended":
            break
        time.sleep(120)
    out: dict[str, dict] = {}
    for r in client.messages.batches.results(batch_id):      # any order → key by custom_id
        if r.result.type == "succeeded":
            msg = r.result.message
            if msg.stop_reason == "end_turn":
                out[r.custom_id] = json.loads(next(x.text for x in msg.content if x.type == "text"))
        else:
            out[r.custom_id] = {"error": r.result.type}      # errored / expired → human queue
    return out
```
Then a deterministic script creates tickets from `out` (the same `GROUP_BY_CATEGORY` mapping) and sends every `SECURITY_INCIDENT` to the SOC **first**.

**Not batching:** looping `triage()` over 500 emails in chunks of 50. That's the same number of synchronous calls, and it hits the same rate limits (M2 Watch Out).

---

## 8.5 Daily ops digest email (FR-8, H3)

```python
# automation/daily_digest.py
"""Numbers are computed by code (exact); Claude writes the narrative; a human sends it."""
import json
import time
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone

from helpdesk.config import MODEL
from helpdesk.llm import create_message, first_text
from helpdesk.store import db

DIGEST_SCHEMA = {
    "type": "object",
    "properties": {
        "subject": {"type": "string"},
        "body": {"type": "string", "description": "Plain text, <= 250 words"},
        "concerns": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["subject", "body", "concerns"],
    "additionalProperties": False,
}


def build_stats(audit_path: str = "audit.jsonl") -> dict:
    since = datetime.now(timezone.utc) - timedelta(days=1)
    events = []
    with open(audit_path, encoding="utf-8") as f:
        for line in f:
            e = json.loads(line)
            if datetime.fromisoformat(e["ts"]) >= since:
                events.append(e)
    executed = Counter(e.get("tool") for e in events if e["event"] == "tool_executed")
    return {
        "conversations": len({e["session_id"] for e in events}),
        "tool_executions": dict(executed),
        "unlocks": executed.get("unlock_my_account", 0),
        "approvals_requested": sum(e["event"] == "approval_requested" for e in events),
        "approvals_decided": Counter(e.get("decision") for e in events
                                     if e["event"] == "approval_decided"),
        "policy_blocks": sum(e["event"] == "policy_decision" and not e.get("allowed")
                             for e in events),
        "output_guard_triggers": sum(e["event"] == "output_guard_triggered" for e in events),
        "tool_failures": sum(e["event"] == "tool_failed" for e in events),
    }


def queue_digest() -> str:
    stats = build_stats()
    response = create_message(
        model=MODEL,
        max_tokens=4096,
        system=("Write the daily IT helpdesk assistant digest for the service desk team. "
                "Use ONLY the numbers in <stats>; do not compute new figures. "
                "Call out policy blocks, guard triggers, tool failures and expired approvals "
                "as concerns. No personal data."),
        output_config={"effort": "low",
                       "format": {"type": "json_schema", "schema": DIGEST_SCHEMA}},
        messages=[{"role": "user", "content": f"<stats>{json.dumps(stats, default=str)}</stats>"}],
    )
    digest = json.loads(first_text(response))
    draft_id = f"MAIL-{uuid.uuid4().hex[:8].upper()}"
    with db() as conn:
        conn.execute("INSERT INTO ops_email_queue (id, to_queue, subject, body, related_ticket, "
                     "created_by_session, created_at) VALUES (?,?,?,?,?,?,?)",
                     (draft_id, "SERVICE_DESK_L1", digest["subject"], digest["body"], "",
                      "daily_digest", time.time()))
    return draft_id          # status 'pending_human_review' → L1 lead reviews and sends (H3)
```

---

## 8.6 Claude Code headless for scheduled ops analysis

A CI job (e.g. weekly) runs Claude Code non-interactively over the SIEM lockout export, using the `lockout-investigation` skill and **read-only** MCP tools.

```json
// helpdesk-ops/ci/.claude/settings.json   (the CI job's own settings, locked down)
{
  "permissions": {
    "defaultMode": "dontAsk",
    "allow": [
      "Read(reports/**)",
      "Write(reports/out/**)",
      "mcp__helpdesk-ad__bulk_account_status",
      "mcp__helpdesk-itsm__search_knowledge"
    ],
    "deny": [
      "mcp__helpdesk-ad__unlock_account",
      "mcp__helpdesk-ad__reset_password_out_of_band",
      "Bash(*)"
    ]
  }
}
```
```bash
claude -p "Run the lockout-investigation skill on reports/lockouts-week.csv and write reports/out/lockout-trends.md"
```
- **`dontAsk`**: only allow-listed tools run; everything else is **auto-denied** with no prompt. That's the right mode for unattended CI (M3).
- **Never `bypassPermissions`** in CI that can reach production AD.
- The CI runner injects `HELPDESK_AD_MCP_TOKEN` as a pipeline secret, not a file on disk (the M3 Jenkins checkpoint).
- Check your installed CLI's headless flags with `claude --help` (e.g. `-p` and the permission-mode / allowed-tools options) before wiring the job.

---

## 8.7 Trade-offs and fixes
| Choice | Benefit | Cost / risk | Fix |
|---|---|---|---|
| RPA executes model output | Reaches legacy GUIs | Injected text typed into production systems | RPA switches only on **enums**; field values regex-validated; human approval first |
| Email → no self-service | Blocks spoofed-sender takeover | Lower deflection on the email channel | Redirect to the Teams bot, where SSO + MFA prove identity |
| Sync triage per email | Simple, near real time | Rate limits at backlog volume | Batches API for backlog; async workers for steady flow |
| Batch backlog | ~50% cheaper, no rate-limit pressure | Up to 24 h latency | Run SOC-flag detection on the sync path for new mail; batch only the backlog |
| LLM-written digest | Readable summary | Hallucinated numbers | Code computes all numbers; the model narrates only `<stats>` |
| Headless Claude Code | Flexible analysis | Unattended agent with tool access | `dontAsk` + allowlist + read-only MCP + OS sandbox |
| Idempotency cache in memory | Simple | Lost on restart → duplicate tickets | Store `message_id` in the DB with a unique constraint |

---
<!-- nav:start -->
> ⬅️ [[claude-dev-exam-prep/helpdesk-project/07-evaluation-and-testing|Helpdesk: evaluation]] · 🏠 [[claude-dev-exam-prep/Developer Exam Prep|Developer index]] · [[Claude Certifications|Home]] · [[claude-dev-exam-prep/helpdesk-project/09-deployment-cost-operations|Helpdesk: deployment]] ➡️
<!-- nav:end -->
