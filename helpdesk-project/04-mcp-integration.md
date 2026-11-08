# 04: MCP Integration: AD and ITSM as Reusable Servers

<!-- nav:start -->
> ⬅️ [[claude-dev-exam-prep/helpdesk-project/03-stage2-tool-use-agent|Helpdesk: tool-use agent]] · 🏠 [[claude-dev-exam-prep/Developer Exam Prep|Developer index]] · [[Claude Certifications|Home]] · [[claude-dev-exam-prep/helpdesk-project/05-security-and-governance|Helpdesk: security]] ➡️
<!-- nav:end -->


> Modules: **M2** MCP as an alternative to hand-written schemas, API MCP connector · **M3** MCP primitives, transport, scope, permission rules, hooks, plugins, secrets

In file 03 the tools lived inside one application. Three consumers now need them:
1. the **employee assistant** (file 03),
2. the **ops team** working in **Claude Code** (investigating lockout storms, bulk status checks),
3. the **RPA bridge** (file 08).

MCP lets you **build the capability once** and have every MCP client reuse it.

---

## 4.1 Decide what goes through MCP, and how

| Capability | MCP? | Transport | Scope | Why |
|---|---|---|---|---|
| AD status / unlock / reset (ops) | **Yes**: `helpdesk-ad` server | **Streamable HTTP**, hosted internally (stdio for local dev only) | **Project** `.mcp.json` for the ops repo; **enterprise** managed settings once stable | A shared team server needs HTTP. A stdio server in `.mcp.json` "looks shareable but isn't" (each machine spawns its own copy plus its own AD credentials) |
| ServiceNow incidents + KB | **Yes**: vendor or internal `helpdesk-itsm` server | HTTP | Project / enterprise | Read-mostly and SaaS-hosted, so it's also safe to reach through the **API MCP connector** |
| Employee self-service tools (file 03) | **No**: kept as in-process client tools | n/a | n/a | The policy gate, MFA and HITL must sit **between** "model asks" and "tool runs". See 4.6 |

---

## 4.2 The AD MCP server for the ops team (tools, resources, prompts)

```python
# mcp_servers/helpdesk_ad_server.py
"""MCP server exposing AD helpdesk operations to OPS ENGINEERS (not employees).

Differences from the employee tools in file 03:
- tools take a target UPN (ops acts on behalf of users), so every write needs an
  open ITSM ticket number and re-checks protected accounts server-side;
- the server never returns a temporary password (out-of-band SMS only);
- every call is audited with the engineer identity from the transport.
"""
import os
import time

import requests
from mcp.server.fastmcp import FastMCP

from helpdesk.audit import audit
from helpdesk.integrations import ad, notify
from helpdesk.integrations.ad import ProtectedAccountError
from helpdesk.store import count_actions, record_action

mcp = FastMCP("helpdesk-ad")

# stdio dev: engineer identity from the local environment.
# HTTP prod: identity comes from the OAuth token validated at the gateway (see 4.3).
ENGINEER = os.environ.get("OPS_ENGINEER_UPN", "unknown-engineer")


def _ticket_is_open(number: str) -> bool:
    r = requests.get(
        f"{os.environ['SNOW_INSTANCE'].rstrip('/')}/api/now/table/incident",
        headers={"Accept": "application/json",
                 "Authorization": f"Bearer {os.environ['SNOW_TOKEN']}"},
        params={"sysparm_query": f"number={number}^active=true", "sysparm_fields": "number",
                "sysparm_limit": "1"},
        timeout=10,
    )
    r.raise_for_status()
    return len(r.json()["result"]) == 1


def _audit(event: str, upn: str, **fields) -> None:
    audit(event, upn=upn, session_id=f"mcp:{ENGINEER}", channel="ops_cli",
          engineer=ENGINEER, **fields)


@mcp.tool()
def get_account_status(upn: str) -> dict:
    """Read-only. Return lockout, disabled and password state for one employee account
    in the employee OU. Use before unlock/reset. Does not modify anything."""
    s = ad.get_account_status(upn)
    _audit("mcp_get_account_status", upn)
    return {"upn": upn, "locked": s.locked, "disabled": s.disabled,
            "must_change_password": s.must_change_password,
            "password_last_set": s.password_last_set, "protected": s.protected}


@mcp.tool()
def bulk_account_status(upns: list[str]) -> list[dict]:
    """Read-only. Status for up to 50 accounts, for investigating lockout storms
    (e.g. after a password-spray alert). Use instead of calling get_account_status in a loop."""
    out = []
    for upn in upns[:50]:
        try:
            s = ad.get_account_status(upn)
            out.append({"upn": upn, "locked": s.locked, "disabled": s.disabled,
                        "protected": s.protected})
        except Exception as e:                     # partial results with the error, never silent
            out.append({"upn": upn, "error": str(e)})
    _audit("mcp_bulk_account_status", "multiple", count=len(out))
    return out


@mcp.tool()
def unlock_account(upn: str, ticket_number: str) -> dict:
    """Unlock one employee account. Requires an OPEN ITSM ticket number for that user.
    Refuses protected/admin/service accounts. Do not use for accounts flagged in a
    security incident; escalate to the SOC instead."""
    if not _ticket_is_open(ticket_number):
        raise ValueError(f"Ticket {ticket_number} is not open; create or reopen it first")
    try:
        ad.unlock_account(upn)
    except ProtectedAccountError as e:
        _audit("mcp_unlock_blocked", upn, ticket=ticket_number, reason=str(e))
        raise
    record_action(upn, "unlock", time.time())
    _audit("mcp_unlock", upn, ticket=ticket_number)
    return {"upn": upn, "status": "unlocked", "ticket": ticket_number}


@mcp.tool()
def reset_password_out_of_band(upn: str, ticket_number: str) -> dict:
    """Reset an employee's password and SMS a temporary password to their registered
    mobile (must change at next sign-in). The password is NEVER returned here.
    Requires an open ticket and the caller's confirmation in Claude Code."""
    if not _ticket_is_open(ticket_number):
        raise ValueError(f"Ticket {ticket_number} is not open")
    if count_actions(upn, "reset_password", time.time() - 86400) >= 3:
        raise ValueError("Reset limit reached for 24h; escalate to the SOC")
    temp, mobile = ad.reset_password(upn)
    if not mobile:
        raise ValueError("No registered mobile; use the in-person identity process")
    notify.send_sms(mobile, f"IT Service Desk: temporary password {temp}. Change at next "
                            f"sign-in. Ref {ticket_number}.")
    del temp
    record_action(upn, "reset_password", time.time())
    _audit("mcp_reset_password", upn, ticket=ticket_number)
    return {"upn": upn, "status": "reset_sent_by_sms", "ticket": ticket_number}


# ---- Resources: read-only data the CLIENT pulls into context by address ----

@mcp.resource("policy://password-reset")
def password_reset_policy() -> str:
    """Direct resource (fixed address): the identity-verification policy text."""
    with open(os.environ.get("PW_POLICY_FILE", "policies/password_reset.md"), encoding="utf-8") as f:
        return f.read()


@mcp.resource("kb://article/{number}")
def kb_article(number: str) -> str:
    """Templated resource (parameter in the address): one KB article by number."""
    r = requests.get(
        f"{os.environ['SNOW_INSTANCE'].rstrip('/')}/api/now/table/kb_knowledge",
        headers={"Accept": "application/json",
                 "Authorization": f"Bearer {os.environ['SNOW_TOKEN']}"},
        params={"sysparm_query": f"number={number}", "sysparm_fields": "short_description,text",
                "sysparm_limit": "1"},
        timeout=10,
    )
    r.raise_for_status()
    res = r.json()["result"]
    return f"{res[0]['short_description']}\n\n{res[0]['text']}" if res else "Not found"


# ---- Prompts: vetted templates invoked by name ----

@mcp.prompt()
def escalation_email(ticket_number: str, summary: str, steps_tried: str) -> str:
    """Write the standard escalation hand-over email for the ops queue."""
    return (
        "Write a hand-over email for the service desk queue.\n"
        f"Ticket: {ticket_number}\nSummary: {summary}\nAlready tried: {steps_tried}\n"
        "Format: Subject line, then Impact / What happened / What was tried / Next step / "
        "Owner. Max 150 words. No passwords, MFA codes or personal data beyond name and UPN."
    )


if __name__ == "__main__":
    # Local development: stdio (Claude Code spawns this as a subprocess).
    # Shared deployment: MCP_TRANSPORT=streamable-http behind the OAuth gateway.
    mcp.run(transport=os.environ.get("MCP_TRANSPORT", "stdio"))
```

**Primitive choice (M3):**
| Need | Primitive | Example here |
|---|---|---|
| The model takes an action or reads live state | **Tool** | `unlock_account`, `bulk_account_status` |
| Known data should be in context from the start | **Resource** (direct or templated) | `policy://password-reset`, `kb://article/{number}` |
| Everyone should use the same vetted wording | **Prompt** | `escalation_email` |

---

## 4.3 Transport and scope for the ops team in Claude Code

**Local development (one engineer, not ready to share): stdio + local scope**
```bash
claude mcp add helpdesk-ad --scope local -- python -m mcp_servers.helpdesk_ad_server
```

**Team use: HTTP server, project scope, committed `.mcp.json` (secrets by env reference only)**
```json
{
  "mcpServers": {
    "helpdesk-ad": {
      "type": "http",
      "url": "https://mcp-ad.helpdesk.internal/mcp",
      "headers": { "Authorization": "Bearer ${HELPDESK_AD_MCP_TOKEN}" }
    },
    "helpdesk-itsm": {
      "type": "http",
      "url": "https://mcp-itsm.helpdesk.internal/mcp",
      "headers": { "Authorization": "Bearer ${ITSM_MCP_TOKEN}" }
    }
  }
}
```
- **Never** write `"Bearer sk-..."` inline. A committed token stays in git history; overwriting it later doesn't remove it, so it has to be **rotated** (M3 Watch Out).
- In production, put an **OAuth (Entra ID) gateway** in front of the HTTP server so each engineer authenticates as themselves. That gives the audit log a real engineer identity instead of a shared token. Register a separate OAuth app per environment and add each environment's redirect URI (the M3 staging→prod failure).
- **Enterprise scope** (managed settings) once the server is mandatory for every service desk machine: it's centrally locked and developers can't remove it.

| Scope | File | Use in this project |
|---|---|---|
| Local | `~/.claude.json` (per project) | Engineer testing a new tool |
| User | personal settings | A personal read-only utility used across repos |
| **Project** | `.mcp.json` in the `helpdesk-ops` repo | Team-shared AD + ITSM servers |
| **Enterprise** | managed settings | Mandatory, locked config for all service desk machines |

---

## 4.4 Permission rules and hooks for MCP tools (H6 HITL in Claude Code)

```json
// helpdesk-ops/.claude/settings.json  (committed, team-wide)
{
  "permissions": {
    "defaultMode": "default",
    "allow": [
      "mcp__helpdesk-ad__get_account_status",
      "mcp__helpdesk-ad__bulk_account_status",
      "mcp__helpdesk-itsm__search_knowledge"
    ],
    "ask": [
      "mcp__helpdesk-ad__unlock_account",
      "mcp__helpdesk-ad__reset_password_out_of_band",
      "mcp__helpdesk-itsm__create_incident"
    ],
    "deny": [
      "Bash(ldapmodify:*)",
      "Bash(Set-ADAccountPassword:*)",
      "Read(.env*)",
      "Read(**/secrets/**)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "mcp__helpdesk-ad__.*",
        "hooks": [{ "type": "command", "command": "python3 \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/ad_guard.py" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "mcp__helpdesk-ad__.*",
        "hooks": [{ "type": "command", "command": "python3 \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/ad_audit.py" }]
      }
    ]
  }
}
```
*(Settings files are JSON. Remove the `//` comment line in a real file.)*

- **allow** = reads run without a prompt (no gate on low-stakes reads).
- **ask** = **the engineer approves every write**. This is the human gate before a destructive call.
- **deny** blocks raw shell paths around the MCP server, so nobody can bypass the guarded tools with `ldapmodify`. **Deny beats allow in every mode.**
- `defaultMode: default`, never `bypassPermissions`. That mode would remove the `ask` prompts *and* the protected-path guard.

```python
# helpdesk-ops/.claude/hooks/ad_guard.py
"""PreToolUse guard for AD MCP tools. Deterministic: runs on every call regardless
of what the model or the prompt says. Exit code 2 = block; stderr goes to Claude."""
import json
import re
import sys

PROTECTED = re.compile(r"^(adm-|svc-|sa-|administrator@|krbtgt)", re.IGNORECASE)
WRITE_TOOLS = {"mcp__helpdesk-ad__unlock_account", "mcp__helpdesk-ad__reset_password_out_of_band"}
TICKET = re.compile(r"^INC\d{7}$")

event = json.load(sys.stdin)
tool = event.get("tool_name", "")
args = event.get("tool_input", {}) or {}

targets = args.get("upns") or [args.get("upn", "")]
for upn in targets:
    if upn and PROTECTED.match(upn):
        print(f"Blocked: {upn} is a protected/privileged account. Use the PAM process.",
              file=sys.stderr)
        sys.exit(2)

if tool in WRITE_TOOLS and not TICKET.match(str(args.get("ticket_number", ""))):
    print("Blocked: AD write actions need a valid open ticket number (INC + 7 digits).",
          file=sys.stderr)
    sys.exit(2)

if tool == "mcp__helpdesk-ad__bulk_account_status" and len(args.get("upns", [])) > 50:
    print("Blocked: bulk status is limited to 50 accounts per call.", file=sys.stderr)
    sys.exit(2)

sys.exit(0)
```

```python
# helpdesk-ops/.claude/hooks/ad_audit.py
"""PostToolUse audit trail for AD MCP calls (can't block; records what happened)."""
import getpass
import json
import os
import sys
from datetime import datetime, timezone

event = json.load(sys.stdin)
record = {
    "ts": datetime.now(timezone.utc).isoformat(),
    "engineer": os.environ.get("OPS_ENGINEER_UPN", getpass.getuser()),
    "session_id": event.get("session_id"),
    "tool": event.get("tool_name"),
    "input": event.get("tool_input"),
}
log_path = os.environ.get("OPS_AUDIT_LOG", os.path.expanduser("~/.helpdesk-ops-audit.jsonl"))
with open(log_path, "a", encoding="utf-8") as f:
    f.write(json.dumps(record) + "\n")
sys.exit(0)
```

> **Why both `ask` and a hook?** `ask` is a human checkpoint (judgment). The hook is a **deterministic** rule that holds even if someone switches to a permissive mode or the engineer clicks "yes" too fast. A CLAUDE.md line like "never touch admin accounts" is only a convention; the hook enforces it.

---

## 4.5 Durable context for the ops repo (CLAUDE.md, rules, skills, plugin)

```markdown
<!-- helpdesk-ops/CLAUDE.md  (short: only rules that change behavior) -->
# Helpdesk Ops
- AD writes only through the helpdesk-ad MCP tools, never shell/LDAP commands.
- Every AD write needs an open INC ticket; put the ticket number in the tool call.
- Never paste or print passwords, MFA codes or tokens. Resets are SMS-only.
- Security indicators (password spray, impossible travel, phishing) → stop and page the SOC.
- Test command: `pytest -q`
```

```markdown
<!-- helpdesk-ops/.claude/skills/lockout-investigation/SKILL.md -->
---
name: lockout-investigation
description: Investigate a spike of AD account lockouts (lockout storm, password spray suspicion). Use when several users report lockouts in a short window or a SIEM lockout alert is pasted.
---
## Steps
1. Ask for the alert time window and the list of affected UPNs (or the SIEM export).
2. Call `bulk_account_status` (max 50 per call). Never unlock during this investigation.
3. Group by OU/site/device. If >10 accounts from one source within 15 min, treat it as a
   possible password spray: stop and draft a SOC escalation with the `escalation_email` prompt.
4. Otherwise identify the common cause (stale mobile mail profile, mapped drive with old
   creds, scheduled task) and search the KB via `search_knowledge`.
5. Output a table: UPN | locked | probable cause | recommended action | ticket.
```

- **CLAUDE.md** = always-on, short (it dilutes as it grows). **Skill** = loads only when a lockout investigation happens.
- **Explore/Plan subagents skip CLAUDE.md.** For investigations where the "never unlock during investigation" rule must hold, use a general-purpose or custom subagent, or rely on the hook, which applies everywhere.

**Package it as a plugin so the whole team gets one versioned install:**
```
helpdesk-ops-plugin/
  .claude-plugin/plugin.json         # {"name": "helpdesk-ops", "version": "1.2.0", "description": "..."}
  skills/lockout-investigation/SKILL.md
  hooks/hooks.json                   # same PreToolUse/PostToolUse config, commands use ${CLAUDE_PLUGIN_ROOT}
  scripts/ad_guard.py                # bundled, so hooks run on every machine
  scripts/ad_audit.py
  .mcp.json                          # the two HTTP servers, tokens via ${ENV}
```
- Hook commands reference `"${CLAUDE_PLUGIN_ROOT}/scripts/ad_guard.py"`, never `/Users/<author>/...` (the M3 "works only on my machine" failure).
- Document the required env vars (`HELPDESK_AD_MCP_TOKEN`, `ITSM_MCP_TOKEN`, `OPS_ENGINEER_UPN`) and **test the install on a clean machine**.
- The skill is invoked as `/helpdesk-ops:lockout-investigation` (namespaced by plugin name).
- Enterprise rollout: a managed marketplace allowlist plus `extraKnownMarketplaces`, so every service desk machine gets the same locked version.

---

## 4.6 Using MCP from the employee assistant: keep the HITL gate

**Option A: your own MCP client inside the agent loop (recommended for action tools).** You read the tool list from the server, but **your loop** calls the tool *after* the policy, MFA and HITL gates.

```python
# helpdesk/mcp_client_tools.py
"""Use MCP-served tools from our own loop while keeping the policy gate in between."""
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client


async def load_mcp_tools(session: ClientSession) -> list[dict]:
    listed = await session.list_tools()           # the ListToolsRequest
    return [{"name": t.name, "description": t.description or "", "input_schema": t.inputSchema}
            for t in listed.tools]


async def call_gated(session: ClientSession, name: str, args: dict, gate) -> str:
    decision = gate(name, args)                   # same policy.check / MFA / approval flow
    if not decision.allowed:
        return f"Blocked by policy: {decision.reason}"
    result = await session.call_tool(name, args)
    return "\n".join(c.text for c in result.content if getattr(c, "type", "") == "text")


async def open_session(url: str, token: str):
    """Usage:
        async with streamablehttp_client(url, headers=...) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()
                ...
    """
    return streamablehttp_client(url, headers={"Authorization": f"Bearer {token}"})
```

**Option B: the API MCP connector (Anthropic connects to the server and executes the tools).** Use it **only for read-only or low-risk tools on internet-reachable servers**, e.g. a SaaS ITSM knowledge search.

```python
# helpdesk/kb_via_connector.py
import os

from .config import EFFORT_CHAT, FALLBACK_BETA, MODEL
from .llm import client


def ask_kb_via_connector(question: str):
    return client.beta.messages.create(
        model=MODEL,
        max_tokens=4096,
        betas=["mcp-client-2025-11-20", FALLBACK_BETA],
        fallbacks="default",
        output_config={"effort": EFFORT_CHAT},
        mcp_servers=[{
            "type": "url",
            "url": "https://mcp.itsm-vendor.example.com/mcp",
            "name": "itsm",
            "authorization_token": os.environ["ITSM_MCP_TOKEN"],
        }],
        tools=[{
            "type": "mcp_toolset",
            "mcp_server_name": "itsm",                     # must match mcp_servers[].name
            "default_config": {"enabled": False},          # allowlist mode: hide everything...
            "configs": {"search_knowledge": {"enabled": True}},   # ...expose only KB search
        }],
        messages=[{"role": "user",
                   "content": f"<user_message>\n{question}\n</user_message>"}],
    )
```

**Trade-offs (why the AD tools never go through the connector)**
| Aspect | Own MCP client (A) | API MCP connector (B) |
|---|---|---|
| Who executes the tool | **Your code**, after policy + MFA + HITL | **Anthropic's infrastructure**, as soon as the model calls it |
| HITL possible between request and execution | **Yes** | **No**: there's no hook point in your code |
| Server reachability | Internal network is fine | Must be reachable from the internet (remote HTTP only) |
| Context cost | You choose which tools to send | `enabled`/`defer_loading` per tool control what the model sees |
| Good for | AD unlock/reset, anything that changes state | Read-only KB search on a vendor-hosted server |

**MCP context cost:** each connected server's tool definitions take context space. Connect only the servers the route needs. With the connector, hide unused tools with `enabled: false` (allowlist) and use `defer_loading` for large servers. In Claude Code, MCP tool definitions are deferred by default.

---

## 4.7 MCP debug priorities
| Symptom | Check first |
|---|---|
| Tool works for its author, fails for teammates | `.mcp.json` uses a stdio command or absolute path that exists on only one machine → HTTP server or `${CLAUDE_PLUGIN_ROOT}` |
| 401 from the MCP server in CI | Token read from a file on the runner → inject an env secret in the pipeline and reference `${VAR}` |
| OAuth sign-in loops in prod only | Redirect URI not registered for the prod host |
| Model calls `reset_password_out_of_band` without a ticket | Look at the hook first (it should exit 2), then the server check; the description is the last line of defense |
| API connector request rejected | `mcp_servers` without a matching `mcp_toolset` entry, or a missing `mcp-client-2025-11-20` beta |

---
<!-- nav:start -->
> ⬅️ [[claude-dev-exam-prep/helpdesk-project/03-stage2-tool-use-agent|Helpdesk: tool-use agent]] · 🏠 [[claude-dev-exam-prep/Developer Exam Prep|Developer index]] · [[Claude Certifications|Home]] · [[claude-dev-exam-prep/helpdesk-project/05-security-and-governance|Helpdesk: security]] ➡️
<!-- nav:end -->
