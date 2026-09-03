# AuthBlade Architecture

Components, flows, and trust boundaries.

Companion documents: [implementation-concept.md](implementation-concept.md), [security-model.md](security-model.md), [data-model.md](data-model.md), [roadmap.md](roadmap.md).

Status labels: `DEFINED` defined product component, `MVP` first implementable release, `NEXT` next phase, `LATER` long-term roadmap.

---

## 1. Architectural principle

```
The agent proposes.
AuthBlade decides.
A trusted enforcement point enforces.
The target system executes.
AuthBlade records the outcome.
```

Two roles are kept strictly separate:

| Role | Component | Responsibility |
| --- | --- | --- |
| Policy Decision Point | AuthBlade Control Plane | Decides ALLOW or DENY, deterministically, and records the decision. |
| Policy Enforcement Point | MCP Guard, Desktop Guard, Browser Guard, Code Guard, gateway, broker, trusted runtime | Intercepts the proposed action, calls the decision point, enforces the result, executes if permitted, and reports evidence. |

AuthBlade is preventive only where the agent cannot reach the target system without crossing an enforcement point. Everywhere else it is detective. This property is a deployment characteristic, not a software feature, and it must be assessed per channel.

The agent does not control whether AuthBlade is called, whether DENY is respected, whether credentials are exposed, whether execution occurs, whether outcomes are recorded, or whether human approval is required.

---

## 2. System overview

```
                          ┌─────────────────────────────┐
                          │        AI Agent (Z1)        │
                          │  proposes actions           │
                          │  holds no reusable secrets  │
                          └──────────────┬──────────────┘
                                         │ proposed action
                                         ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │                  Policy Enforcement Points (Z2, trusted)             │
   │  ┌────────────┐ ┌──────────────┐ ┌───────────────┐ ┌──────────────┐  │
   │  │ MCP Guard  │ │ Desktop Guard│ │ Browser Guard │ │  Code Guard  │  │
   │  │   MVP      │ │  DEFINED/MVP │ │     NEXT      │ │     NEXT     │  │
   │  └────────────┘ └──────────────┘ └───────────────┘ └──────────────┘  │
   │  normalize -> authenticate -> request decision -> enforce -> report  │
   └──────────────────────────────┬───────────────────────────────────────┘
                                  │ canonical authorization request
                                  ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │              AuthBlade Control Plane (Z3, trusted, PDP)              │
   │                                                                      │
   │  Authority Layer          Evaluation and Approval    Observability    │
   │  ─────────────────        ────────────────────────   ──────────────   │
   │  Agent Registry           Deterministic ABAC (MVP)   Tasks            │
   │  Enforcement Registry     Risk evaluation (NEXT)     Sessions, Traces │
   │  Attributes               Human approval (NEXT)      Decisions        │
   │  Policies and versions    Obligations (NEXT)         Actions          │
   │  Decisions                                           Outcomes         │
   │  Credentials (hashed)                                Evidence, Export │
   │                                                                      │
   │              Supabase PostgreSQL, Row Level Security                 │
   └──────────────────────────────┬───────────────────────────────────────┘
                                  │ ALLOW or DENY
                                  ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │            Target Systems (Z4, independently governed)               │
   │  SAP, Microsoft 365, internal APIs, Windows and Citrix desktops,     │
   │  repositories. Credentials live here or inside the enforcement point.│
   └──────────────────────────────┬───────────────────────────────────────┘
                                  │ outcome
                                  ▼
                        back into the action chain
```

---

## 3. Trust boundaries

| Zone | Contents | Trust | Boundary crossing control |
| --- | --- | --- | --- |
| Z0 | Model context: prompt, tool schemas, tool results | Untrusted | Nothing in Z0 is authoritative. No credential ever enters it. |
| Z1 | Agent runtime process | Low trust | Reaches Z4 only through Z2. Its identity claims are only accepted from Z2. |
| Z2 | Enforcement points: MCP Guard server, Desktop Guard main process and native helper, gateways | Trusted | Authenticates to Z3 with its own credential. Holds target credentials. |
| Z3 | Control plane: API, policy engine, database | Trusted | Authenticates every caller. Enforces workspace isolation in the database. |
| Z4 | Target systems and the desktop operating system | Independently governed | Has its own access controls, which remain necessary. |

The security value of the whole design comes from the Z1 to Z2 boundary. If that boundary is not enforced by the environment, AuthBlade records rather than prevents.

---

## 4. Control plane layers

### 4.1 Authority Layer

Holds everything needed to decide.

| Element | Purpose | Status |
| --- | --- | --- |
| Agent Registry | Every agent has an AuthBlade agent ID, a type, an owner, attributes, and an active flag. | `MVP` |
| Enforcement-point Registry | Every enforcement point is separately registered, typed, credentialed, and optionally device bound. | `MVP` |
| Attributes | Agent, resource, and context attributes resolvable at evaluation time. | `MVP` |
| Policies and versions | JSON policies with immutable published versions. | `MVP` |
| Decisions | Immutable decision records with request and policy snapshots. | `MVP` |
| Delegation controls | Constraints on which agents may delegate to which. | `NEXT` |

### 4.2 Evaluation and Approval Layer

| Element | Purpose | Status |
| --- | --- | --- |
| Deterministic ABAC engine | Pure function from request plus policy set to decision. | `MVP` |
| Risk evaluation | Computed risk attributes feeding policy. | `NEXT` |
| Human approval | REQUIRE_APPROVAL, approval requests, action-bound permits. | `NEXT` |
| Obligations | ALLOW_WITH_OBLIGATIONS and obligation fulfilment tracking. | `NEXT` |
| Simulation and replay | Evaluate proposed policy versions against historical requests. | `NEXT` |

### 4.3 Observability Layer

| Element | Purpose | Status |
| --- | --- | --- |
| Tasks, sessions, traces | Correlation spine across channels and components. | `MVP` |
| Actions and outcomes | What was attempted and what resulted. | `MVP` |
| Evidence metadata | Source and level for every asserted fact. | `MVP` |
| Combined timeline | One ordered view per task or session. | `MVP` |
| Match status | MATCHED, UNMATCHED, NOT_EXECUTED, UNKNOWN. | `MVP` |
| Semantic matching | Parameter-level decision-to-action comparison. | `NEXT` |
| Evidence export | Structured JSON export. | `MVP` |

---

## 5. Canonical action model

Every enforcement component normalizes its native interaction into one shape, aligned with the AuthZEN-style subject, action, resource, context model.

```json
{
  "subject":           { "agent_id": "procurement-agent-01", "agent_type": "computer-use" },
  "delegation":        { "user_id": "user-4711", "task_id": "task-882" },
  "action":            { "type": "purchase_requisition.submit" },
  "resource":          { "type": "purchase_requisition", "id": "draft-71" },
  "context":           { "amount": 2500, "currency": "EUR", "company_code": "DE01" },
  "environment":       { "channel": "desktop", "application": "SAP GUI", "production": true },
  "enforcement_point": { "id": "desktop-guard-4711", "type": "DESKTOP_GUARD" }
}
```

Blocks: `subject`, `delegation`, `action`, `resource`, `context`, `environment`, `intent`, `risk`, `enforcement_point`, `evidence_source`.

This normalization is why one business rule can govern many channels. `purchase_requisition.submit` is the same action type whether it arrives from an MCP tool call, an API request, a browser form, or a SAP GUI transaction observed by Desktop Guard.

---

## 6. Authorization flow

```
1. Agent proposes an action inside its channel.
2. Enforcement point intercepts it before any execution begins.
3. Enforcement point normalizes it into the canonical action model.
4. Enforcement point authenticates to the control plane with its own credential
   and asserts the agent identity it is permitted to represent.
5. Control plane validates the payload, verifies that this enforcement point may
   represent this agent and this channel, and checks agent status.
6. Control plane resolves attributes and selects the applicable policy set.
7. Engine evaluates deterministically.
   Explicit DENY wins. Then ALLOW. Otherwise default DENY.
8. Control plane persists an immutable decision with request and policy snapshots.
9. Control plane returns decision, decision_id, reason_code, reason,
   matching policies with versions, timestamp, and latency.
10. On DENY the enforcement point does not execute and records a BLOCKED action.
11. On ALLOW the enforcement point executes using credentials the agent never sees.
12. Enforcement point records the action and the outcome with evidence source and level.
13. All events join the shared timeline through the correlation identifiers.
```

Every failure in steps 5 through 8 produces DENY with a specific reason code. There is no path from an internal error to ALLOW.

---

## 7. Enforcement components

### 7.1 MCP Guard `MVP`

A trusted MCP server, or a wrapper in front of one, for structured MCP and API actions.

```
Agent ──tool call──> MCP Guard ──authorize──> Control Plane
                        │  <──ALLOW / DENY────────┘
                        │
                     on ALLOW: execute with held credentials
                        │
                     Target System ──result──> MCP Guard ──outcome──> Control Plane
```

Key properties:

- The agent receives a business capability, not the credential behind it.
- Credentials never leave the trusted server.
- The parameters authorized are the parameters executed. Rebinding between the two is a defect.
- The authorization call is blocking. There is no execute-then-check path.

Safe tool shape:

```
create_purchase_requisition(company_code, supplier_id, amount, currency, description)
```

Prohibited tool shapes, each of which hands the agent an unbounded capability or a reusable secret:

```
get_sap_password()
get_access_token()
execute_arbitrary_http_request()
execute_arbitrary_sap_request()
run_arbitrary_shell_command()
```

### 7.2 Desktop Guard `DEFINED`, initial implementation `MVP`

An AuthBlade component for computer-use agents operating Windows, Citrix, virtual desktops, Cloud PCs, and enterprise GUI applications.

```
Computer-use agent -> Desktop Guard -> AuthBlade Control Plane -> Controlled desktop
```

Internal structure:

| Layer | Privilege | Responsibility |
| --- | --- | --- |
| Renderer (React) | Lowest | Operator interface, session status, local timeline. No secrets, no privileged primitives. |
| Preload bridge | Lowest | Minimal enumerated API. No generic invoke passthrough. |
| Main process (Electron, Node, TypeScript) | Standard user | Lifecycle, IPC allowlist and validation, encrypted local queue, control plane client. |
| Native Windows helper or service | Elevated, separate account | Process and foreground-window monitoring, UI Automation, launch interception, credential custody, tamper detection, health reporting. |

The renderer never talks to the helper. Every request goes renderer to preload to main to helper, validated at each hop.

Responsibilities: register devices and sessions, identify agent and enforcement point, detect active process and application and foreground window, use Windows UI Automation context where available, evaluate application launches, evaluate consequential desktop actions, apply session restrictions, prevent denied input or execution, record actions and decisions and outcomes, support local policy information for low-latency interactions, fail closed for protected actions, resist agent-driven disablement, avoid arbitrary process or shell access, and integrate with Windows and Citrix controls.

Application policy example:

| Allowed | Denied |
| --- | --- |
| Excel | Outlook |
| Word | PowerShell |
| SAP GUI | Command Prompt |
| | Unapproved browsers |
| | Arbitrary executables |

Desktop Guard complements, and does not replace, Windows App Control, AppLocker, account separation, Citrix policies, VM isolation, endpoint management, network restrictions, mailbox entitlements, and Microsoft Graph permissions. AuthBlade alone does not prevent every Windows action without supporting operating system and environment controls.

### 7.3 Browser Guard `NEXT`

Governs domains and URLs, uploads and downloads, form submissions, sensitive fields, browser sessions, external communications, and final confirmation actions.

Design direction: a managed extension for observation and normalization, paired with a trusted proxy for enforcement, because an extension alone can be disabled by a sufficiently privileged agent.

### 7.4 Code Guard `NEXT`

Governs repositories and paths, commands, package installation, pull requests, branches, secrets, deployment targets, and production changes.

Design direction: enforcement at the coding agent's tool boundary rather than inside a shell. Narrow capabilities such as `repository.write`, `package.install`, `pull_request.create`, and `deployment.trigger`, and no generic shell tool.

---

## 8. Action levels

| Level | Examples | Handling |
| --- | --- | --- |
| Interaction | Mouse movement, click, keystroke, scroll, focus, low-level API interaction | Not every interaction requires a cloud decision. Desktop Guard may evaluate low-risk interactions locally against a signed, expiring session policy. |
| Operation | Open application, read file, update record, invoke MCP tool, submit form, upload or download, start session | Authorized and observed where relevant. |
| Business action | Create purchase requisition, submit payment, change supplier bank details, send external email, post journal entry, approve invoice, modify production | Normally requires central evaluation. May later require human approval. |

This tiering is what keeps the control plane volume proportional to meaningful actions rather than to mouse movement, and what keeps interactive desktop work responsive.

---

## 9. Observability and correlation

Hierarchy:

```
Task -> Session -> Trace -> Decision -> Action -> Outcome
```

A task may contain multiple sessions, traces, decisions, actions, retries, parallel branches, and child tasks. Storage uses foreign keys plus correlation identifiers, so a partially reported chain remains queryable rather than being dropped.

Shared identifiers: `workspace_id`, `agent_id`, `enforcement_point_id`, `task_id`, `session_id`, `trace_id`, `decision_id`, `action_id`, `outcome_id`, `parent_action_id`.

Evidence levels:

| Level | Meaning | Confidence |
| --- | --- | --- |
| `AGENT_DECLARED` | The agent claims it attempted or completed the action | Lowest |
| `ENFORCEMENT_OBSERVED` | A trusted Guard observed or executed the action | Higher |
| `TARGET_CONFIRMED` | The target system confirms the action | Highest |

Match statuses in the MVP: `MATCHED`, `UNMATCHED`, `NOT_EXECUTED`, `UNKNOWN`. Semantic matching is an `ActionMatcher` extension and is `NEXT`.

The result is an audit-ready action chain. It is not tamper-proof evidence, and must not be described as such until cryptographic and target-confirmed evidence exists.

---

## 10. Technology architecture

| Layer | Technology |
| --- | --- |
| Database and auth | Supabase PostgreSQL, Supabase Auth, Row Level Security, SQL migrations |
| API and policy decision point | Node.js, TypeScript, a Node HTTP framework, Zod validation |
| Policy engine | A pure TypeScript package with no input or output dependencies |
| Web application | React, TypeScript, Vite, Tailwind CSS, accessible component primitives |
| Desktop Guard | Electron with a React renderer and a TypeScript main process, plus a native Windows helper or service |
| MCP Guard | Node.js and TypeScript, distributed as a package and a container image |
| Landing page | Static HTML, CSS, and minimal vanilla JavaScript, no build step |

The policy engine has no dependency on the database, on HTTP, or on any cloud service. That is what makes it testable, embeddable in a `LATER` local decision point, and reusable for simulation and replay.

---

## 11. Extension interfaces

| Interface | Responsibility | Status |
| --- | --- | --- |
| `ActionAdapter` | Translate native channel signals into canonical actions | `MVP` for MCP and application launch |
| `EnforcementPoint` | Authenticate, request decisions, enforce, report | `MVP` |
| `PolicyEvaluator` | Deterministic evaluation of a request against a policy set | `MVP` |
| `EvidenceProvider` | Supply evidence with a source and level | `MVP` |
| `ActionMatcher` | Correlate decisions with executed actions | Status only in `MVP`, semantic `NEXT` |
| `RiskEvaluator` | Compute risk attributes | `NEXT` |
| `ApprovalProvider` | Create, present, and resolve approvals | `NEXT` |
| `IdentityProvider` | Resolve external identities to AuthBlade identities | `NEXT` |
| `CredentialProvider` | Supply credentials to trusted components only | `MVP` |
| `NotificationProvider` | Deliver approval requests and alerts | `NEXT` |
| `AuditExporter` | Produce evidence exports | `MVP` for JSON |

---

## 12. Deployment architecture

MVP: multi-tenant SaaS, Supabase backend, hosted Node API, React administration user interface, Electron Desktop Guard on customer devices, and an MCP Guard operated by the customer or provided by AuthBlade as a container image. Strict tenant isolation. No customer production credentials in the AuthBlade SaaS. Metadata-focused observability.

Future `LATER`: private cloud, self-hosting, regional residency, customer-managed encryption, a local policy decision point, local evidence processing, high availability commitments, and service level agreements.

---

## 13. Failure architecture

| Situation | Behaviour |
| --- | --- |
| Control plane unreachable during a protected write | Fail closed |
| Consequential action during an outage | Fail closed |
| Timeout | DENY, reason code `EVALUATION_TIMEOUT` |
| Internal error | DENY, reason code `EVALUATION_ERROR` |
| Invalid request | DENY, reason code `INVALID_REQUEST` |
| Expired session policy | Protected actions fail closed until refreshed |
| Event ingestion unavailable | Desktop Guard queues locally, encrypted, and replays. Decisions are never queued. |

There is no fail-open mode in the MVP. Caches hold policy definitions and session policies, never decisions for protected actions, and every cache expires and supports revocation.

---

## 14. Cross-channel example

One rule:

> No AI agent may change supplier bank details without independent human approval.

Because every channel normalizes to `supplier.bank_details.update`, the same policy governs:

| Channel | Native interaction | Enforcement point |
| --- | --- | --- |
| MCP | `update_supplier_bank_details` tool call | MCP Guard |
| API | `PATCH /suppliers/{id}/bank-details` | Gateway plugin or MCP Guard |
| Browser | Supplier maintenance form submission | Browser Guard `NEXT` |
| Windows | Vendor master client confirmation | Desktop Guard |
| Citrix | The same client inside a virtual session | Desktop Guard |
| SAP GUI | Transaction screen confirmation | Desktop Guard with a semantic adapter `NEXT` |

In the MVP the rule is expressed as an explicit DENY, which always wins over any ALLOW. When approval ships, the same rule becomes `REQUIRE_APPROVAL` with exact-action binding, and the policy identity and its audit history are preserved across that change because policy versions are immutable and decisions reference the version that produced them.
