# AuthBlade Implementation Concept

**Status:** Concept document for a development team. The landing page in this repository is implemented. The platform described here is not implemented in this repository.

**Scope legend used throughout this document:**

| Label | Meaning |
| --- | --- |
| `DEFINED` | Defined product component. The design is settled, the initial technical implementation may still be limited. |
| `MVP` | In scope for the first implementable release. |
| `NEXT` | Next phase after the MVP. Extension points are designed now, behaviour is not built now. |
| `LATER` | Long-term roadmap. Architecture must not block it, nothing is promised. |

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Product and non-goals](#2-product-and-non-goals)
3. [Customers and users](#3-customers-and-users)
4. [Agent taxonomy](#4-agent-taxonomy)
5. [Control, Observe, Assure](#5-control-observe-assure)
6. [Trust and threat models](#6-trust-and-threat-models)
7. [Canonical action model](#7-canonical-action-model)
8. [Identity and enforcement points](#8-identity-and-enforcement-points)
9. [Authorization architecture](#9-authorization-architecture)
10. [Observability architecture](#10-observability-architecture)
11. [Correlation and evidence](#11-correlation-and-evidence)
12. [MCP Guard](#12-mcp-guard)
13. [Desktop Guard and secure Electron](#13-desktop-guard-and-secure-electron)
14. [Browser Guard and Code Guard extensions](#14-browser-guard-and-code-guard-extensions)
15. [Supabase and RLS](#15-supabase-and-rls)
16. [APIs and policy model](#16-apis-and-policy-model)
17. [Failure behaviour](#17-failure-behaviour)
18. [Privacy and retention](#18-privacy-and-retention)
19. [Deployment](#19-deployment)
20. [Monorepo](#20-monorepo)
21. [Testing and security testing](#21-testing-and-security-testing)
22. [Development and deployment setup](#22-development-and-deployment-setup)
23. [MVP phases](#23-mvp-phases)
24. [Approval architecture](#24-approval-architecture)
25. [Semantic adapters](#25-semantic-adapters)
26. [Simulation and replay](#26-simulation-and-replay)
27. [Open source versus commercial packaging](#27-open-source-versus-commercial-packaging)
28. [Risks and trade-offs](#28-risks-and-trade-offs)
29. [Next step](#29-next-step)

---

## 1. Executive summary

AuthBlade is a cross-channel runtime authority and observability platform for AI agents. It evaluates proposed agent actions against deterministic policies, enforces decisions through trusted enforcement points, and records the chain from assigned task and authorization decision to actual execution and business outcome.

The operating principle is fixed:

```
The agent proposes.
AuthBlade decides.
A trusted enforcement point enforces.
The target system executes.
AuthBlade records the outcome.
```

Two roles must never be confused:

- **Policy Decision Point (PDP):** AuthBlade Control Plane. It decides.
- **Policy Enforcement Point (PEP):** MCP Guard, Desktop Guard, Browser Guard, Code Guard, an API gateway, a broker, or another trusted runtime. It enforces.

AuthBlade is preventive **only** when the agent cannot bypass the enforcement point. Where the agent can bypass it, AuthBlade is detective, not preventive. This distinction must remain explicit in product documentation, in the user interface, and in sales material.

Technology baseline:

- **Backend:** Node.js, TypeScript, a Node HTTP framework, Supabase PostgreSQL, Supabase Auth, Row Level Security, SQL migrations, Zod validation.
- **Web frontend:** React, TypeScript, Vite, Tailwind CSS, accessible headless component primitives.
- **Desktop Guard:** Electron with a React renderer and a TypeScript main process, plus a native Windows helper or service for privileged and tamper-resistant functions, including Windows UI Automation access.
- **Data:** PostgreSQL only for the MVP. No graph database.

The deliverable of the first implementable release is narrow and demonstrable: a workspace-isolated control plane, an agent and enforcement-point registry, deterministic JSON policies with ALLOW and DENY, an authorization API, a task, session, decision, action, and outcome record set, an MCP Guard, and a Desktop Guard application-policy demo, all visible in a single combined timeline.

---

## 2. Product and non-goals

### 2.1 Product definition

| Field | Value |
| --- | --- |
| Name | AuthBlade |
| Domain | authblade.com |
| Category | Cross-channel runtime authority and observability for AI agents |
| Primary tagline | Control what AI agents can do before they do it. |
| Supporting message | Authorize every consequential action. Observe what actually happened. |
| Additional message | Control, observe, and assure every AI agent action. |
| Developer description | Add deterministic authorization and action tracing to AI agents across MCP, APIs, browsers, and desktop environments. |
| Primary call to action | Start building |

### 2.2 What the product is

A control plane plus a family of enforcement components. The control plane holds identity, attributes, policy, decisions, and the evidence chain. Each enforcement component translates one execution channel into the canonical action model, calls the control plane, and enforces the returned decision at the point of action.

### 2.3 Non-goals

The following are explicitly out of scope. Stating them prevents the architecture from drifting.

| Non-goal | Reason |
| --- | --- |
| Building or hosting agents | AuthBlade governs agents, it does not supply them. |
| Prompt filtering or jailbreak detection as the primary control | Prompts are not a security boundary. Model-level defences are complementary and not authoritative. |
| An LLM making the final authorization decision | Decisions must be deterministic and reproducible. A model may assist in authoring or explaining policy, never in deciding. |
| Replacing operating system, identity, network, or endpoint controls | AuthBlade complements them. Desktop Guard specifically depends on them. |
| Capturing chain-of-thought or full prompts | The system records structured actions. Hidden reasoning is out of scope by design. |
| A general-purpose SIEM or APM | AuthBlade records the authority and execution chain, not arbitrary telemetry. |
| A proprietary policy language | Deterministic JSON policies aligned with an AuthZEN-style request shape. No new DSL for the MVP. |
| A graph database in the MVP | PostgreSQL with correlation identifiers and indexes is sufficient for the modelled depth. |
| Screenshot-based surveillance of desktop users | Screenshots are not captured by default. Any later capture must be opt in, scoped, and retention limited. |

### 2.4 Product claims discipline

Public material must not claim:

- Certifications or legal compliance that has not been achieved.
- Tamper-proof evidence, unless cryptographic and target-confirmed evidence is actually implemented.
- That AuthBlade alone prevents every Windows action without supporting operating system and environment controls.
- That one integration secures every agent type.

Public material may claim:

- Deterministic runtime authorization at supported enforcement points.
- An audit-ready action chain.
- Credential isolation from the model context at supported enforcement points.

---

## 3. Customers and users

### 3.1 Primary buyer

Enterprise AI platform teams and cybersecurity teams deploying agents into regulated or sensitive business processes. They own the question "may this agent do this?" and they are accountable when the answer turns out to be wrong.

Buying triggers:

- An agent programme moving from pilot to production.
- An internal audit or risk finding about autonomous execution.
- A regulatory or contractual requirement for evidence of control over automated actions.
- An incident, near miss, or unexplained change caused by automation.

### 3.2 Other stakeholders

| Stakeholder | Interest |
| --- | --- |
| IAM | Agent identity, delegation, separation from human identity, integration with the existing identity estate. |
| AI governance | Mandate, scope, and demonstrable boundaries for autonomous systems. |
| Internal audit | Evidence that a decision existed before an execution, and that denials held. |
| Compliance | Segregation of duties, approval trails, retention. |
| Risk management | Financial impact limits, reversibility, blast radius. |
| Process owners | Whether the agent stayed inside the business process as designed. |
| Enterprise architecture | One authority model rather than per-application authorization logic. |
| Data protection | Data minimization, no secrets in logs, retention, residency. |

### 3.3 Primary user

Developers and platform engineers integrating agents, MCP servers, APIs, browsers, and computer-use environments. They must be able to:

1. Register an agent and an enforcement point in minutes.
2. Write a policy as readable JSON.
3. Call one authorization endpoint.
4. See the decision, its reason, and the matching policy version.
5. See the resulting action and outcome in one timeline.

The messaging must combine developer usability with enterprise control and auditability. If the first authorization call takes longer than a short session to achieve, adoption fails regardless of the enterprise story.

---

## 4. Agent taxonomy

Agents are classified along five axes. Classification drives policy defaults, enforcement selection, and risk treatment.

| Axis | Values |
| --- | --- |
| Execution channel | MCP or API, computer use or desktop, browser, coding, workflow, communication, transaction, infrastructure, multi-agent |
| Autonomy | Suggest only, human in the loop, human on the loop, fully autonomous |
| Identity model | Own agent identity, delegated human identity, shared service account, unidentified |
| Risk | Read only, reversible write, irreversible write, financial, safety relevant |
| Environment | Development, test, staging, production, regulated production |

### 4.1 Execution channels and their enforcement components

| Channel | Typical actions | Enforcement component | Status |
| --- | --- | --- | --- |
| MCP and API agents | Structured tool calls, REST and RPC calls | MCP Guard, API gateway plugin | `MVP` |
| Computer-use and desktop agents | Application launch, window interaction, GUI transactions | Desktop Guard | `DEFINED`, initial implementation `MVP` |
| Browser agents | Navigation, form submission, upload, download | Browser Guard | `NEXT` |
| Coding agents | Repository writes, commands, dependency installation, deployment | Code Guard | `NEXT` |
| Workflow agents | Multi-step orchestration across systems | Reuses MCP Guard plus task model | `MVP` for the task model |
| Communication agents | Email, chat, ticket, external messaging | MCP Guard for API paths, Desktop Guard for client applications | `MVP` for the API path |
| Transaction agents | Payments, postings, orders | MCP Guard plus business action level | `MVP` |
| Infrastructure agents | Cloud and cluster changes | Code Guard and MCP Guard | `NEXT` |
| Multi-agent systems | Delegation between agents | Parent and child identity recorded now, delegation control later | Record `MVP`, control `NEXT` |

A single integration cannot secure every agent type. Product material must not imply otherwise. What is shared across channels is the control plane, the action model, the policy language, and the evidence chain.

---

## 5. Control, Observe, Assure

### 5.1 Control `MVP`

Determine and enforce whether an agent may act.

In scope for the MVP:

- Agent registry and enforcement-point registry.
- Attributes on agents, resources, and context.
- Deterministic ABAC evaluation.
- Default DENY.
- Explicit DENY precedence over ALLOW.
- Session and application restrictions for desktop sessions.
- MCP and desktop authorization.

Decision effects:

- `MVP`: `ALLOW`, `DENY`.
- `NEXT`: `REQUIRE_APPROVAL`, `ALLOW_WITH_OBLIGATIONS`.

The decision type is an enum in the schema from day one, so adding effects does not require a migration of decision history semantics.

### 5.2 Observe `MVP`

Record the authority and execution chain:

```
Task -> delegation -> proposed action -> policy -> decision
     -> enforcement -> actual action -> outcome
```

In scope for the MVP: task chain, decision chain, action chain, outcome chain, task and session and trace correlation, enforcement events, evidence sources, a combined timeline, and basic JSON evidence export.

Explicitly recorded: structured actions and their metadata. Explicitly not recorded: hidden model reasoning, chain-of-thought, and full prompts.

### 5.3 Assure `NEXT` and `LATER`

Evaluate whether actions are critical, appropriate, expected, and consistent with the assigned mandate.

| Capability | Status |
| --- | --- |
| Risk evaluation | `NEXT` |
| Human approval | `NEXT` |
| Segregation of duties | `NEXT` |
| Intent-to-execution matching | `NEXT` |
| Deviation detection | `LATER` |
| Policy simulation and replay | `NEXT` |
| Audit and compliance evidence packs | `NEXT` |
| Action-bound permits | `NEXT` |

For this phase, the task is to define extension points, not to implement advanced evaluation or approval. The extension points are listed in [section 27 of the architecture set](#25-semantic-adapters) and in `architecture.md`.

---

## 6. Trust and threat models

### 6.1 Trust zones

| Zone | Contents | Trust level |
| --- | --- | --- |
| Z0 Model context | Agent prompt, tool schemas, model reasoning, tool results | **Untrusted.** Assume any content reaching it can influence behaviour. |
| Z1 Agent runtime | The process running the agent loop | **Low trust.** May be honest, must not be relied upon. |
| Z2 Enforcement point | MCP Guard server, Desktop Guard main process and native helper, gateway | **Trusted.** Holds credentials, enforces decisions, produces observed evidence. |
| Z3 Control plane | AuthBlade API, policy engine, database | **Trusted.** Authoritative for decisions and records. |
| Z4 Target system | SAP, Microsoft 365, internal APIs, desktop operating system | **Independently governed.** Has its own controls, produces confirmed evidence. |

The security value of the design comes from the boundary between Z1 and Z2. If an agent can reach a target system without crossing Z2, AuthBlade cannot prevent that action.

### 6.2 Threat model

| ID | Threat | Mitigation | Residual risk |
| --- | --- | --- | --- |
| T1 | Prompt injection causes the agent to attempt a harmful action | Enforcement point evaluates the action independently of prompt content. Default DENY. Explicit DENY for high-impact action types. | Actions that policy permits but that are contextually inappropriate. Reduced by `NEXT` risk evaluation and approval. |
| T2 | Agent skips the authorization call | Enforcement point, not the agent, makes the call. Target credentials are only inside the enforcement point. | A channel with no enforcement point. Mitigated by narrowing the agent's reachable surface. |
| T3 | Agent ignores a DENY | Enforcement point does not execute on DENY. The agent never has the means to execute directly. | An enforcement point implemented as advisory. Prohibited by design. |
| T4 | Credential exfiltration through the model | No reusable downstream credential is ever returned to the agent. No tool returns tokens, passwords, cookies, or keys. | Credentials leaked outside AuthBlade's scope. |
| T5 | Agent disables Desktop Guard | Native helper runs with separate privileges. Agent account cannot stop the service. Tamper detection and health reporting. Fail closed for protected actions. | A locally privileged attacker. Depends on operating system controls. |
| T6 | Agent launches an unapproved process | Application allow and deny enforcement plus Windows App Control or AppLocker as the underlying operating system control. | Desktop Guard alone is not an operating system control. Layering is mandatory. |
| T7 | Spoofed enforcement point | Each enforcement point authenticates with its own credential. AuthBlade verifies that it may represent the claimed agent and channel. | Credential theft from the enforcement point host. Reduced by short-lived credentials and device binding. |
| T8 | Spoofed agent identity | Agent identity claims are only accepted from an authenticated enforcement point. Unauthenticated identity claims are never trusted. | An enforcement point misconfigured to represent too many agents. |
| T9 | Cross-tenant data access | Row Level Security on every tenant table. Workspace scoping enforced in the database, never only in the frontend. | A misapplied policy on a new table. Covered by mandatory RLS tests. |
| T10 | Tampering with history | Decisions and outcomes are append only at the application layer, with immutable request and policy snapshots. | Database administrator access. Cryptographic evidence is `LATER`. |
| T11 | Control plane outage used as a bypass | Fail closed. No fail-open mode in the MVP. Local session policies are signed and expiring and cover low-risk interactions only. | Availability becomes a business dependency. Accepted and documented. |
| T12 | Sensitive data leaking into evidence | Metadata only, payload size limits, redaction, no screenshots by default. | Poorly chosen custom attribute values. Covered by documentation and review. |
| T13 | Replay of an authorization decision | Decisions carry identifiers, timestamps, and expiry. `NEXT` action-bound permits make binding explicit. | In the MVP, matching is recorded rather than cryptographically bound. |
| T14 | Malicious or compromised child agent | Parent and child identity recorded. Delegation control is `NEXT`. | Delegation is observable before it is controllable. Documented honestly. |

### 6.3 What the design does not defend against

State these plainly in the security model document as well:

- A human insider with legitimate access to the target system.
- An operating system compromise at or above the privilege of the native helper.
- A target system that accepts changes through a path with no enforcement point.
- Business-logic harm caused by an action that policy legitimately permits.

---

## 7. Canonical action model

Every enforcement component normalizes its native interaction into a single shape. This is the contract that makes cross-channel policy possible.

### 7.1 Structure

| Block | Purpose |
| --- | --- |
| `subject` | Which agent is acting, and of what type. |
| `delegation` | On whose behalf, under which task, from which parent. |
| `action` | What is proposed, expressed as a stable business or technical action type. |
| `resource` | What is acted upon. |
| `context` | Parameters that matter for the decision, such as amount and currency. |
| `environment` | Channel, application, production flag, device, network posture. |
| `intent` | The declared purpose, recorded and usable in policy, never trusted as proof. |
| `risk` | Computed or declared risk attributes. `NEXT` for computed values. |
| `enforcement_point` | Which trusted component is asking. |
| `evidence_source` | How the fact was established. |

### 7.2 Reference example

```json
{
  "subject": {
    "agent_id": "procurement-agent-01",
    "agent_type": "computer-use"
  },
  "delegation": {
    "user_id": "user-4711",
    "task_id": "task-882"
  },
  "action": {
    "type": "purchase_requisition.submit"
  },
  "resource": {
    "type": "purchase_requisition",
    "id": "draft-71"
  },
  "context": {
    "amount": 2500,
    "currency": "EUR",
    "company_code": "DE01"
  },
  "environment": {
    "channel": "desktop",
    "application": "SAP GUI",
    "production": true
  },
  "enforcement_point": {
    "id": "desktop-guard-4711",
    "type": "DESKTOP_GUARD"
  }
}
```

### 7.3 Action type naming

Action types use a dotted, lowercase, resource-first convention: `<resource>.<operation>` or `<resource>.<subresource>.<operation>`.

Examples: `purchase_requisition.create`, `purchase_requisition.submit`, `supplier.bank_details.update`, `application.launch`, `file.download`, `email.send_external`, `repository.push`.

Rules:

1. An action type describes a business or technical outcome, never an implementation detail such as a button name.
2. The same action type must be usable from any channel. `purchase_requisition.create` is the same action whether it arrives from an MCP tool or from SAP GUI.
3. Action types are registered per workspace so that policies can be validated against a known vocabulary.

### 7.4 Alignment with AuthZEN

The request shape maps directly onto the AuthZEN-style subject, action, resource, context model. The `authzen-adapter` package translates between the AuthBlade internal request and an AuthZEN-style external request so that AuthBlade can act as a decision point for callers that already speak that shape. Avoid unnecessary proprietary protocol surface.

---

## 8. Identity and enforcement points

### 8.1 Identities to distinguish

| Identity | Meaning | MVP treatment |
| --- | --- | --- |
| Agent identity | The autonomous actor | AuthBlade agent ID in the Agent Registry |
| Delegating human | The person on whose behalf work happens | Optional, recorded when supplied |
| Service identity | A non-agent system caller | Registered as an enforcement point or an API key principal |
| Enforcement-point identity | The trusted component making the call | Separately registered and separately credentialed |
| Parent and child agents | Delegation between agents | Recorded through `parent_agent_id` and `parent_task_id` |
| Target-system identity | The account used inside the target | Recorded as metadata, never stored as a credential |

### 8.2 MVP rules

1. AuthBlade maintains an Agent Registry. Every agent has an AuthBlade agent ID.
2. Every enforcement point is separately registered and separately authenticated.
3. Enforcement points receive their own credentials. An agent credential is never an enforcement-point credential.
4. AuthBlade verifies that the enforcement point is permitted to represent the claimed agent and the claimed channel. An enforcement point of type `MCP_GUARD` cannot submit a request with `environment.channel = "desktop"`.
5. The delegated user is optional but recorded when present.
6. All identity claims enter the audit chain, including rejected claims.
7. Unauthenticated agent identity claims are never trusted. Identity arrives with the authenticated enforcement point, not inside the payload alone.

### 8.3 Credential handling for enforcement points

- Registration issues a credential once. Only a hash is stored.
- Credentials are workspace scoped, type scoped, and optionally device bound.
- Desktop Guard credentials are additionally bound to a registered device and are short lived, refreshed by the native helper rather than by the renderer.
- Rotation and revocation are first-class operations. Revocation takes effect on the next authorization call, with no cached grace period for protected actions.

### 8.4 Enterprise identity integration `NEXT` and `LATER`

AuthBlade complements enterprise identity systems rather than replacing them. Candidate integrations: Entra Agent ID, Okta, OAuth 2.0 client credentials and token exchange, workload identity federation, mTLS client certificates, signed assertions, and formal delegation chains. The identity model keeps external identifiers as attributes so that these integrations map onto existing agent records without a schema break.

---

## 9. Authorization architecture

### 9.1 Evaluation pipeline

```
Authenticated request
  -> schema validation (Zod)
  -> enforcement-point authorization check (may this PEP represent this agent and channel?)
  -> agent status check (active?)
  -> attribute resolution (agent, resource, context, environment, enforcement point)
  -> policy set selection (workspace, action type, environment)
  -> deterministic evaluation
  -> effect combination (explicit DENY wins, then ALLOW, else default DENY)
  -> decision persistence with immutable snapshot
  -> response
```

Every stage failure produces `DENY` with a specific reason code. There is no path from an internal error to `ALLOW`.

### 9.2 Attributes evaluated

| Category | Examples |
| --- | --- |
| Agent | ID, type, owner, department, tenant, environment, risk rating, capabilities, limits, permitted systems, active status |
| Delegating user | ID, department, role attributes, assurance level |
| Action | Type, operation, read or write, business classification, risk, parameters, financial impact, reversibility |
| Resource | Type, ID, owner, tenant, country, classification, criticality, business unit, target system |
| Context | Time, amount, currency, purpose, user, request ID, session ID, source, assurance level |
| Environment | Channel, application, production flag, device, session |
| Enforcement point | ID, type, device, environment, trust status, version, session |

### 9.3 Evaluation principles

These are non-negotiable and must be covered by tests:

1. Default DENY. Anything unmatched is denied.
2. Explicit DENY overrides any ALLOW.
3. Inactive agents are denied.
4. Invalid requests are denied.
5. Errors and timeouts fail closed.
6. LLMs never make the final decision.
7. Identical input plus identical policy version produces an identical decision.

Determinism excludes wall-clock lookups inside evaluation. If a policy needs the current time, the time is captured once at request ingress, written into the snapshot, and passed into evaluation as an input value.

### 9.4 Policy structure

```json
{
  "id": "supplier-bank-details-deny",
  "version": 1,
  "effect": "DENY",
  "priority": 100,
  "description": "No agent may change supplier bank details.",
  "target": {
    "action.type": { "equals": "supplier.bank_details.update" }
  },
  "conditions": [],
  "reason_code": "SUPPLIER_BANK_DETAILS_FORBIDDEN"
}
```

MVP operators: `equals`, `not_equals`, `in`, `not_in`, `less_than`, `less_than_or_equal`, `greater_than`, `greater_than_or_equal`, `exists`.

Design constraints:

- Conditions combine with logical AND inside one policy. Alternatives are expressed as separate policies. This keeps evaluation trivially analysable.
- No arithmetic, no string manipulation, no regular expressions, no loops, and no user-supplied code in the MVP. This is what makes the engine provably terminating and reviewable.
- Policies are stored as JSON, validated against a JSON Schema in the `policy-schema` package, and versioned. A published version is immutable.

### 9.5 Effect combination

```
if any matching policy has effect DENY   -> DENY
else if any matching policy has ALLOW    -> ALLOW
else                                     -> DENY (default)
```

When `REQUIRE_APPROVAL` arrives in the `NEXT` phase, it slots between DENY and ALLOW: DENY beats REQUIRE_APPROVAL, and REQUIRE_APPROVAL beats ALLOW.

### 9.6 Performance targets

| Path | Target |
| --- | --- |
| Authorization decision, warm policy cache | p95 under 50 ms server side |
| Authorization decision, cold | p95 under 200 ms server side |
| Desktop Guard local interaction check | p95 under 5 ms, no network |

Policy sets are cached in the API process keyed by workspace and policy-set version, and invalidated on publish. The cache holds policy definitions only, never decisions.

---

## 10. Observability architecture

### 10.1 Hierarchy

```
Task
 └─ Session
     └─ Trace
         └─ Decision
             └─ Action
                 └─ Outcome
```

A task may contain multiple sessions, traces, decisions, actions, retries, parallel branches, and child tasks. The hierarchy is a containment convention, not a strict tree in storage. Storage uses foreign keys plus correlation identifiers so that partially reported chains remain queryable.

### 10.2 Shared identifiers

`workspace_id`, `agent_id`, `enforcement_point_id`, `task_id`, `session_id`, `trace_id`, `decision_id`, `action_id`, `outcome_id`, `parent_action_id`.

Every event carries `workspace_id` and as many of the others as are known. An event with a missing correlation identifier is still stored, and is reported as partially correlated rather than dropped.

### 10.3 Ingestion

- Enforcement points write through the API, authenticated with their own credential.
- Writes are idempotent on a client-supplied `event_key` so that a retry after a network failure does not duplicate an action.
- Desktop Guard buffers events locally in an encrypted queue during a control plane outage and replays them with original timestamps preserved alongside the receipt timestamp.
- The API validates every payload with Zod, rejects unknown fields, and applies size limits before persistence.

### 10.4 Timeline construction

The combined timeline is a single ordered view over decisions, actions, outcomes, and enforcement events for a task or a session, ordered by event time with a stable secondary sort on record type and identifier. The user interface renders ALLOW, DENY, EXECUTED, BLOCKED, SUCCESS, and FAILED distinctly, using shape and text as well as colour so that the distinction does not rely on colour alone.

### 10.5 Retention and volume

Interaction-level events are the highest-volume category and are, by default, not sent to the control plane. Desktop Guard aggregates them locally and reports operations and business actions. This keeps the control plane volume proportional to meaningful actions rather than to mouse movement.

---

## 11. Correlation and evidence

### 11.1 Evidence levels

| Level | Meaning | Confidence |
| --- | --- | --- |
| `AGENT_DECLARED` | The agent claims it attempted or completed the action | Lowest |
| `ENFORCEMENT_OBSERVED` | A trusted Guard observed or executed the action | Higher |
| `TARGET_CONFIRMED` | The target system confirms the action | Highest |

Every action and every outcome stores both an `evidence_source` (which component asserted it) and an `evidence_level`. The user interface must show the level, because an outcome recorded at `AGENT_DECLARED` carries materially less weight than one at `TARGET_CONFIRMED`.

Use the phrase "audit-ready action chain". Do not use "tamper-proof" or "cryptographic proof" until cryptographic and target-confirmed evidence is actually implemented.

### 11.2 Decision-to-action matching

MVP statuses: `MATCHED`, `UNMATCHED`, `NOT_EXECUTED`, `UNKNOWN`.

Mismatch categories the model is designed to surface:

| Category | Description |
| --- | --- |
| Execution without decision | An action exists with no corresponding decision. |
| Execution after DENY | An action followed a DENY decision. |
| Different resource or parameters | The executed action differs from the authorized one. |
| Expired authorization | Execution happened outside the decision validity window. |
| Duplicate execution | Two actions reference one single-use decision. |
| Authorized but not executed | A decision exists with no action. |
| Outcome without enforcement evidence | An outcome reported only at `AGENT_DECLARED`. |

MVP behaviour: store and display the status. The matcher sets `MATCHED` on a direct `decision_id` reference, `NOT_EXECUTED` when a decision has no action after a configured window, `UNMATCHED` when an action has no decision reference, and `UNKNOWN` otherwise.

`NEXT`: the `ActionMatcher` extension performs semantic matching, comparing normalized resources and parameters rather than only identifiers, and detecting the parameter-drift and duplicate cases above.

---

## 12. MCP Guard

Status: `MVP`.

### 12.1 Role

MCP Guard is the enforcement point for structured MCP and API actions. It is a trusted MCP server, or a wrapper in front of one, that holds credentials and refuses to execute without an ALLOW.

### 12.2 Flow

1. Agent invokes a narrowly defined tool.
2. MCP Guard authenticates and identifies the agent and the enforcement point.
3. MCP Guard sends a normalized authorization request to AuthBlade.
4. AuthBlade returns ALLOW or DENY.
5. DENY stops execution. The agent receives a structured refusal with the reason code, and no credential material.
6. ALLOW lets the trusted MCP server execute.
7. Credentials remain inside the trusted server.
8. The server reports execution and outcome.
9. AuthBlade adds all events to the shared timeline.

### 12.3 Tool design rules

A safe tool expresses a business capability with a constrained parameter set:

```
create_purchase_requisition(company_code, supplier_id, amount, currency, description)
```

The following tool shapes are prohibited in a governed deployment, because each one hands the agent an unbounded capability or a reusable secret:

```
get_sap_password()
get_access_token()
execute_arbitrary_http_request()
execute_arbitrary_sap_request()
run_arbitrary_shell_command()
```

The agent must never receive production API keys, passwords, OAuth refresh tokens, session cookies, private keys, service-account credentials, or any other reusable downstream credential. The agent receives a business capability, not the credential behind it.

### 12.4 Implementation notes

- Written in TypeScript, distributed as a Node package and a container image.
- Configuration declares, per tool: the action type it maps to, which parameters become `resource` fields, which become `context` fields, and which are excluded from evidence entirely.
- The authorization call is synchronous and blocking. There is no execute-then-check path.
- The parameters sent for authorization are the parameters used for execution. A rebind between authorization and execution is a defect, and the integration test suite asserts against it.
- Outcome reporting uses `TARGET_CONFIRMED` when the target returns a durable reference such as a document number, and `ENFORCEMENT_OBSERVED` otherwise.

---

## 13. Desktop Guard and secure Electron

Status: `DEFINED`. Initial implementation in the `MVP`.

### 13.1 Role

Desktop Guard is an existing AuthBlade component for computer-use agents operating Windows, Citrix, virtual desktops, Cloud PCs, and enterprise GUI applications. It creates a trusted enforcement layer between the computer-use agent and the desktop environment.

```
Computer-use agent
  -> Desktop Guard
  -> AuthBlade Control Plane
  -> Controlled Windows, Citrix, or virtual desktop
```

### 13.2 Responsibilities

- Register devices and sessions.
- Identify agent and enforcement point.
- Detect the active process, application, and foreground window.
- Use Windows UI Automation context where available.
- Evaluate application launches.
- Evaluate consequential desktop actions.
- Apply session restrictions.
- Prevent denied input or execution.
- Record actions, decisions, and outcomes.
- Support local policy information for low-latency interactions.
- Fail closed for protected actions.
- Resist agent-driven disablement.
- Avoid arbitrary process or shell access.
- Integrate with Windows and Citrix controls.

### 13.3 Application policy example

| Allowed | Denied |
| --- | --- |
| Excel | Outlook |
| Word | PowerShell |
| SAP GUI | Command Prompt |
| | Unapproved browsers |
| | Arbitrary executables |

### 13.4 Why Electron, and what Electron is not

Electron is required because a local component must govern and observe desktop execution, present an operator interface, and ship as a managed desktop application with a familiar update and signing story. The React and TypeScript stack is shared with the control plane web application.

Electron alone is not the security boundary. An ordinary Electron renderer cannot block a Windows process. Product material must not claim otherwise. The boundary is the combination of:

1. The Electron main process, which holds no renderer-reachable privileged primitives.
2. A native Windows service or helper, running under a separate account, which performs privileged and tamper-resistant functions: process and window monitoring, UI Automation access, launch interception, and credential custody.
3. Operating system and environment controls: Windows App Control or AppLocker, account separation, Citrix policies, VM isolation, endpoint management, network restrictions, mailbox entitlements, and Microsoft Graph permissions.

### 13.5 Component layout

| Component | Privilege | Responsibility |
| --- | --- | --- |
| Renderer (React) | Lowest | Operator interface, status, timeline view. No secrets, no privileged primitives. |
| Preload bridge | Lowest | A minimal, explicitly enumerated API surface. No generic invoke passthrough. |
| Main process (Node, TypeScript) | Standard user | Application lifecycle, IPC allowlist, message validation, local event queue, control plane client. |
| Native helper or Windows service | Elevated, separate account | Process and foreground-window monitoring, UI Automation, launch interception, tamper detection, credential custody, health reporting. |

The renderer never talks to the native helper. Every request travels renderer to preload to main to helper, and every hop validates.

### 13.6 Electron security requirements

Every item below is a build-time or test-time assertion, not a guideline:

- `nodeIntegration` disabled.
- `contextIsolation` enabled.
- `sandbox` enabled where possible.
- Strict Content Security Policy, no inline script, no remote origins.
- No remote module.
- Minimal preload bridge.
- Explicit IPC allowlist. Unknown channels are rejected and logged.
- Every IPC message validated against a schema.
- No generic command execution.
- No generic process launch.
- No arbitrary PowerShell.
- No arbitrary file access.
- No secrets in the renderer.
- Signed binaries.
- Verified updates.
- Device registration.
- Short-lived credentials.
- Tamper detection.
- Health reporting.
- Fail closed.
- Encrypted local storage.
- Minimal retention.
- Redacted logs.
- Local event queue for temporary outages.

Additionally: `webSecurity` stays enabled, `will-navigate` and `setWindowOpenHandler` deny all external navigation, and the renderer loads only local files.

### 13.7 Local decision handling

Interaction-level events are evaluated locally against a signed, expiring session policy issued by the control plane at session start. The session policy is a restricted subset: application allow and deny lists, window and control scopes, and an explicit list of action types that must always go to the control plane.

Rules:

- Any action classified as an operation with business relevance, or as a business action, requires central evaluation.
- The session policy carries an expiry. On expiry, protected actions fail closed until a new session policy is obtained.
- Revocation is honoured at the next central call, and the session policy lifetime bounds the revocation window. That bound is a documented configuration value.
- The signature is verified by the native helper, not by the renderer.

### 13.8 Initial versus later scope

| Initial implementation `MVP` | Later `NEXT` and `LATER` |
| --- | --- |
| Device and session registration | Deep UI Automation |
| Process and application identification | Business-action recognition |
| Application allow and deny | SAP adapters |
| Event logging | Screen-state verification |
| Timeline integration | Consequential-button interception |
| | Advanced local decisions |
| | Cryptographic evidence |
| | Citrix integration |
| | Advanced tamper resistance |

### 13.9 Honest limitations

Desktop Guard complements, and does not replace, Windows App Control, AppLocker, account separation, Citrix policies, VM isolation, endpoint management, network restrictions, mailbox entitlements, and Microsoft Graph permissions. Deployment guidance must state that the agent account is expected to be a restricted account, that application control is expected to be configured at the operating system level, and that Desktop Guard adds agent-aware authorization and evidence on top of that foundation.

---

## 14. Browser Guard and Code Guard extensions

Both are `NEXT`. They are included in the architecture and on the landing page as vision, and must not be described as available.

### 14.1 Browser Guard

Governs: domains and URLs, uploads and downloads, form submissions, sensitive fields, browser sessions, external communications, and final confirmation actions.

Design direction: a managed browser extension or a controlled automation runtime, paired with a trusted proxy for cases where extension integrity cannot be assured. The extension observes and the proxy enforces, because an extension alone can be disabled by a sufficiently privileged agent. Normalization maps navigation to `page.navigate`, submission to a business action type where a mapping exists, and file transfer to `file.upload` and `file.download`.

### 14.2 Code Guard

Governs: repositories and paths, commands, package installation, pull requests, branches, secrets, deployment targets, and production changes.

Design direction: enforcement at the tool boundary of the coding agent rather than inside the shell. A wrapper exposes narrow capabilities such as `repository.write`, `package.install`, `pull_request.create`, and `deployment.trigger`, and refuses a generic shell tool. Normalization is identical in structure to MCP Guard, which is why Code Guard is a specialization rather than a separate architecture.

---

## 15. Supabase and RLS

Full detail is in `data-model.md`. This section states the platform decisions.

### 15.1 Platform choices

- Supabase PostgreSQL as the single store. No graph database for the MVP.
- Supabase Auth for human users of the control plane web application.
- API keys and enforcement-point credentials for machine callers, verified in the API layer, never by the browser client.
- SQL migrations checked into `supabase/migrations`, applied in order, never edited after release.
- Row Level Security enabled on every tenant table without exception.

### 15.2 Table set

Full set: `users`, `workspaces`, `workspace_members`, `agents`, `agent_attributes`, `enforcement_points`, `enforcement_point_credentials`, `policies`, `policy_versions`, `tasks`, `sessions`, `traces`, `authorization_decisions`, `actions`, `execution_outcomes`, `evidence_references`, `approval_requests`, `approval_decisions`, `devices`, `api_keys`.

Minimum MVP set: `workspaces`, `workspace_members`, `agents`, `enforcement_points`, `policies`, `policy_versions`, `tasks`, `sessions`, `authorization_decisions`, `actions`, `execution_outcomes`, `api_keys`.

### 15.3 Requirements

1. `workspace_id` on every tenant record.
2. RLS policies for tenant isolation on every tenant table.
3. No reliance on frontend filtering for isolation.
4. API keys stored as hashes with a non-secret prefix for lookup.
5. Enforcement-point credentials stored as hashes, bound to workspace, type, and optionally device.
6. Immutable decision snapshots: the evaluated request and the resolved attributes are stored as written.
7. Policy-version snapshots: a decision references the exact `policy_version_id` that produced it.
8. Evidence source and level on actions and outcomes.
9. Data minimization: metadata rather than payloads.
10. No credentials in events, enforced by a redaction layer and asserted by tests.
11. No screenshots by default.
12. No full prompts and no hidden reasoning.

### 15.4 Machine access pattern

Machine callers never receive a Supabase client credential. They call the Node API with their own credential. The API resolves the workspace, then uses a service role connection with an explicit workspace filter applied in every query, plus RLS as the second line of defence for user-facing paths. Two independent mechanisms guard tenancy: the query filter and the row policy.

---

## 16. APIs and policy model

Full endpoint reference belongs in `docs/api`. This section fixes the contract.

### 16.1 Authorization endpoint

`POST /api/v1/authorize`

Input:

```json
{
  "agent_id": "procurement-agent-01",
  "enforcement_point_id": "desktop-guard-4711",
  "delegated_user_id": "user-4711",
  "task_id": "task-882",
  "session_id": "sess-5501",
  "trace_id": "trace-9910",
  "action": { "type": "purchase_requisition.submit" },
  "resource": { "type": "purchase_requisition", "id": "draft-71" },
  "context": { "amount": 2500, "currency": "EUR", "company_code": "DE01" },
  "environment": { "channel": "desktop", "application": "SAP GUI", "production": true },
  "intent": "Create requisition for approved office supplies request 4711"
}
```

Output:

```json
{
  "decision": "ALLOW",
  "decision_id": "dec-77120",
  "reason_code": "PR_WITHIN_LIMIT",
  "reason": "Applicable policy matched.",
  "matching_policies": [
    { "policy_id": "pr-limit-de", "policy_version_id": "pv-3", "version": 3, "effect": "ALLOW" }
  ],
  "timestamp": "2026-09-03T10:03:41.204Z",
  "latency_ms": 12,
  "permit": null
}
```

`permit` is a reserved placeholder for `NEXT` action-bound permits. It is always `null` in the MVP, and clients must tolerate its presence.

Authentication: the enforcement-point credential in an `Authorization` header. The `agent_id` in the body is a claim that AuthBlade validates against what the authenticated enforcement point may represent. Never trust unauthenticated agent identity claims.

### 16.2 Remaining endpoints

| Endpoint | Purpose |
| --- | --- |
| `POST /api/v1/tasks` | Create a task with purpose, constraints, delegating user, and optional parent task. |
| `GET /api/v1/tasks/{task_id}` | Read a task with its correlated sessions, traces, decisions, actions, and outcomes. |
| `POST /api/v1/tasks/{task_id}/events` | Append task-level events such as start, checkpoint, and completion. |
| `POST /api/v1/actions` | Record a started or completed action. |
| `PATCH /api/v1/actions/{action_id}` | Update status, end time, result reference, or error. |
| `POST /api/v1/decisions/{decision_id}/outcome` | Record the outcome bound to a decision. |
| `POST /api/v1/sessions` | Open a session and, for Desktop Guard, receive a signed session policy. |
| `POST /api/v1/sessions/{session_id}/end` | Close a session and invalidate its session policy. |
| `POST /api/v1/enforcement-points/register` | Register an enforcement point and issue its credential. |
| `POST /api/v1/devices/register` | Register a device for Desktop Guard credential binding. |

Cross-cutting rules:

- Every write accepts an idempotency key and returns the original result on replay.
- Every response carries the request identifier for correlation.
- Errors use a stable machine-readable `error_code` plus human text.
- Unknown fields are rejected rather than ignored, so that a client bug surfaces immediately.
- Rate limits are per workspace and per enforcement point, and exceeding them produces an explicit error, never a silent ALLOW.

### 16.3 Policy management

Policies are managed through the web application and, `NEXT`, through an API. A policy has a stable `id` and an ordered set of versions. Publishing creates a new immutable `policy_version`. Decisions reference the version, so a decision remains explainable after the policy changes.

---

## 17. Failure behaviour

| Situation | Behaviour |
| --- | --- |
| Control plane unreachable during a protected write | Fail closed. The action does not execute. |
| Control plane unreachable during a consequential action | Fail closed. |
| Authorization timeout | Treated as DENY with reason code `EVALUATION_TIMEOUT`. |
| Internal evaluation error | Treated as DENY with reason code `EVALUATION_ERROR`. |
| Invalid request payload | DENY with reason code `INVALID_REQUEST`. |
| Unknown or inactive agent | DENY with reason code `AGENT_INACTIVE` or `AGENT_UNKNOWN`. |
| Enforcement point not permitted to represent the agent | DENY with reason code `PEP_NOT_AUTHORIZED_FOR_AGENT`. |
| Denials and failures | Recorded safely, including the reason, so that a denial is itself evidence. |
| Low-risk desktop interaction during an outage | May be evaluated locally against a signed, expiring session policy. |
| Session policy expired | Protected actions fail closed until refreshed. |
| Event ingestion unavailable | Desktop Guard queues locally, encrypted, and replays. Enforcement decisions are never queued. |

There is no fail-open mode in the MVP. This is a product decision, not a limitation: an operator who can flip authorization to fail open has removed the guarantee the product exists to provide. Availability of the control plane therefore becomes a business dependency, which is documented in deployment guidance and addressed by the `LATER` local PDP option.

Caches expire and support revocation. A cache holds policy definitions and session policies, never decisions for protected actions.

---

## 18. Privacy and retention

Principles:

- Structured metadata rather than full content.
- No credentials, ever, in any record.
- No hidden reasoning, no chain-of-thought, no full prompts.
- No screenshots by default.
- Payload size limits on every field that accepts free-form content.
- Redaction applied at ingestion, with a deny list for common secret patterns and a configurable field allowlist per action type.
- Configurable retention `NEXT`.
- A documented workspace deletion process.
- Immutable application history combined with a necessary administrative deletion capability, so that a legal deletion request can be honoured without pretending records were never written.

`LATER`: data residency options, customer-managed encryption keys, and local evidence processing where evidence never leaves the customer environment.

Personal data appears in three places and each is minimized: the delegating user identifier (an opaque identifier, not a name, unless the customer chooses otherwise), the device and session records for Desktop Guard, and control plane user accounts. Desktop Guard is not a workforce monitoring tool, and the interaction-level data that would make it one is deliberately kept local and aggregated.

---

## 19. Deployment

### 19.1 MVP deployment

- Multi-tenant SaaS.
- Supabase backend for database and auth.
- Hosted Node API.
- React administration user interface.
- Electron Desktop Guard distributed to customer devices.
- MCP Guard operated by the customer, or provided by AuthBlade as a container image.
- Strict tenant isolation.
- No customer production credentials in the AuthBlade SaaS. Credentials live in the customer-operated MCP Guard or in the customer's own secret store.
- Metadata-focused observability.

The last two points matter commercially as well as technically. AuthBlade is not a credential vault and does not become one. That reduces both blast radius and procurement friction.

### 19.2 Future deployment options `LATER`

Private cloud, self-hosting, regional residency, customer-managed encryption, a local policy decision point for latency or sovereignty, local evidence storage, high availability commitments, and service level agreements.

The architecture keeps these open by ensuring the policy engine is a pure library with no cloud dependency, and by keeping evidence ingestion separate from decision evaluation.

---

## 20. Monorepo

```
apps/
  control-plane-web/     React administration user interface
  control-plane-api/     Node and TypeScript API, policy decision point
  desktop-guard/         Electron application plus native Windows helper
  mcp-guard/             Trusted MCP server and wrapper
  browser-guard/         NEXT

packages/
  authorization-engine/  Pure deterministic evaluation, no input or output
  action-model/          Canonical action model types and normalization helpers
  policy-schema/         JSON Schema plus Zod schemas and validators
  event-model/           Task, session, trace, decision, action, outcome types
  authzen-adapter/       AuthZEN-style request and response translation
  mcp-adapter/           MCP tool definition to action type mapping
  action-matcher/        Decision-to-action matching, MVP status only
  evidence-sdk/          Client for recording actions and outcomes
  shared-types/          Cross-cutting TypeScript types
  api-client/            Typed client for the control plane API
  ui/                    Shared accessible React components
  config/                Shared lint, TypeScript, and build configuration

supabase/
  migrations/
  seed.sql
  config.toml

docs/
  architecture/
  api/
  security/
  threat-model/
  desktop-guard/
  mcp-guard/
```

Rules:

- `authorization-engine` has no dependency on the database, on HTTP, or on any cloud service. It is a function from request plus policy set to decision. This is what makes it testable, embeddable in a local PDP, and reusable in simulation and replay.
- `action-model` and `policy-schema` are the only packages both the control plane and every guard depend on. Keeping that boundary narrow is what makes the cross-channel promise real.
- Not every application is implemented now. The structure is documented, and lightweight placeholders are created only where they help.

Tooling: pnpm workspaces, TypeScript project references, one shared ESLint and Prettier configuration, and Vitest for unit tests.

---

## 21. Testing and security testing

| Layer | Coverage |
| --- | --- |
| Unit | Policy operators, effect combination, attribute resolution, normalization helpers, redaction. |
| Policy engine | A golden corpus of request and policy pairs with expected decisions. Determinism assertion: the same input evaluated twice yields byte-identical decisions. Property tests asserting that an explicit DENY always wins and that no input produces ALLOW without a matching ALLOW policy. |
| API integration | Every endpoint, including authentication failures, idempotent replay, oversized payloads, and unknown fields. |
| RLS and tenant isolation | For each tenant table, a test that a member of workspace A cannot read, write, or delete a row in workspace B, executed against a real PostgreSQL instance. A new table without an RLS test fails the build. |
| Electron security | Automated assertions that `nodeIntegration` is off, `contextIsolation` is on, sandbox is enabled where supported, the CSP is present and strict, the preload surface matches the declared allowlist exactly, and unknown IPC channels are rejected. |
| End to end | The full demo scenario, driving MCP Guard and a Desktop Guard test harness against a seeded workspace. |
| Decision-action correlation | Fixtures for every match status and every mismatch category, asserting the recorded status. |
| Security testing | Dependency scanning, secret scanning in CI, a redaction test corpus containing realistic secret shapes, fuzzing of the authorization payload, and an authorization bypass test suite that attempts to execute without a decision, after a DENY, and with a mismatched enforcement point. |

Two tests are treated as release blockers regardless of anything else: the tenant isolation suite and the fail-closed suite.

---

## 22. Development and deployment setup

Local development:

1. `pnpm install` at the repository root.
2. `supabase start` for a local PostgreSQL and auth stack.
3. `pnpm db:migrate` and `pnpm db:seed` to apply migrations and the demo workspace.
4. `pnpm dev` to run the API and the web application together.
5. `pnpm --filter mcp-guard dev` for the MCP Guard against the local API.
6. `pnpm --filter desktop-guard dev` for the Electron application, on Windows for full functionality and in a limited mode elsewhere.

Environment configuration is by explicit variables with a validated schema at process start. A missing or malformed variable stops the process rather than defaulting, because a silently defaulted authorization setting is a security defect.

Continuous integration: lint, typecheck, unit tests, policy corpus, API integration tests against an ephemeral PostgreSQL, RLS suite, Electron security assertions, dependency and secret scanning. Migrations are validated by applying them to an empty database and then to the previous release schema.

Release: the API and the web application deploy from the main branch after a green pipeline. Desktop Guard releases are signed, versioned, and published through a verified update channel, with the native helper versioned alongside the Electron application and a compatibility matrix enforced at startup.

---

## 23. MVP phases

### Phase 0: Landing page and documentation `done in this repository`

Static landing page and this documentation set.

### Phase 1: Foundation `MVP`

Supabase project, schema and migrations for the minimum table set, RLS on every tenant table, Supabase Auth, workspaces and membership, API keys, the Node API skeleton with validation and error handling, and the React application shell.

Exit criterion: a user can sign in, create a workspace, and no cross-workspace read is possible in the isolation suite.

### Phase 2: Authority `MVP`

Agent registry, enforcement-point registry, credential issue and rotation, the `authorization-engine` package, JSON policy storage with versions, the `POST /api/v1/authorize` endpoint, decision persistence with immutable snapshots, and a policy editor with validation.

Exit criterion: the demo policy set evaluates correctly for every case in the golden corpus, and the determinism test passes.

### Phase 3: MCP MVP `MVP`

MCP Guard with tool-to-action mapping, the blocking authorization call, credential isolation, execution, and outcome reporting.

Exit criterion: `create_purchase_requisition` executes at EUR 2,500 and is refused at EUR 25,000, with both recorded.

### Phase 4: Observability `MVP`

Tasks, sessions, traces, actions, outcomes, evidence levels, MVP match statuses, the combined timeline view, and JSON export.

Exit criterion: the timeline for the demo task shows every event with correct verdict and evidence rendering.

### Phase 5: Desktop Guard MVP `MVP`

Device and session registration, the native helper for process and foreground-window detection, application launch authorization, the signed session policy, blocking of denied launches, event reporting, and the operator interface.

Exit criterion: Excel, Word, and SAP GUI launch, Outlook, PowerShell, and Command Prompt are blocked, and every attempt appears in the timeline with `ENFORCEMENT_OBSERVED` evidence.

### Phase 6 onward `NEXT` and `LATER`

Evaluation and risk, human approval, semantic adapters, simulation and replay, Browser Guard, Code Guard, delegation control, and enterprise deployment options.

### Demo scenario

Agent: `procurement-agent-01`.

Allowed applications: Excel, Word, SAP GUI. Denied applications: Outlook, PowerShell, Command Prompt.

Policies:

1. German purchase requisitions up to EUR 5,000 are allowed.
2. Above EUR 5,000 is denied.
3. Supplier bank-detail changes are explicitly denied.
4. All unmatched actions are denied.

Flow:

1. Task created.
2. Excel requested, allowed, and started.
3. SAP GUI requested, allowed, and started.
4. A EUR 2,500 purchase requisition is requested and allowed.
5. MCP execution starts.
6. The target reports success.
7. Outlook is requested and denied.
8. Desktop Guard blocks Outlook.
9. A EUR 25,000 request is denied and not executed.
10. The combined timeline shows all events.

Deep SAP GUI semantics are deliberately excluded from the initial demo. Application-level enforcement must work first, and the SAP adapter is added afterwards.

---

## 24. Approval architecture

Status: `NEXT`. Designed now, not implemented now.

Flow:

1. The agent proposes an action.
2. Policy returns `REQUIRE_APPROVAL`.
3. Enforcement pauses. The action does not execute and no partial execution occurs.
4. AuthBlade creates an approval request.
5. A human reviews it.
6. The human approves or rejects.
7. AuthBlade re-evaluates, because policy may have changed in the interval and policy remains authoritative.
8. Execution occurs only after a resulting authorization.
9. The approval and the outcome enter the same trace.

Principles:

- Exact-action binding. An approval authorizes one specific action with specific parameters.
- Material changes invalidate the approval. A changed amount, resource, or target requires a new approval.
- Expiration. Approvals have a validity window.
- Single use. An approval is consumed by one execution.
- No broad standing permission is created by an approval.
- The policy engine remains authoritative. Approval is an input to evaluation, not a replacement for it.
- Segregation of duties.
- The initiator is not automatically an eligible approver.

Approval context presented to the reviewer: agent, delegating user, task, purpose, action, target system, resource, parameters, risk, matching policy, related actions in the same task, expected result, and expiration.

Schema readiness: `approval_requests` and `approval_decisions` are in the full table set, the decision enum already anticipates `REQUIRE_APPROVAL`, and the authorize response already carries a `permit` placeholder.

---

## 25. Semantic adapters

Status: `NEXT`.

A semantic adapter turns native channel signals into a business action type. Without adapters, Desktop Guard can control which applications run. With adapters, it can control what those applications do.

Interface responsibilities:

| Interface | Responsibility |
| --- | --- |
| `ActionAdapter` | Translate native channel signals into canonical actions. |
| `EnforcementPoint` | Authenticate, request decisions, enforce them, and report events. |
| `PolicyEvaluator` | Evaluate a request against a policy set deterministically. |
| `EvidenceProvider` | Supply evidence for an action with a source and level. |
| `ActionMatcher` | Correlate decisions with executed actions and set a match status. |
| `RiskEvaluator` | Compute risk attributes for a proposed action. `NEXT` |
| `ApprovalProvider` | Create, present, and resolve approval requests. `NEXT` |
| `IdentityProvider` | Resolve external identities to AuthBlade identities. `NEXT` |
| `CredentialProvider` | Supply credentials to trusted components only, never to agents. |
| `NotificationProvider` | Deliver approval requests and alerts. `NEXT` |
| `AuditExporter` | Produce evidence exports in required formats. |

Adapter design direction for SAP GUI as the first case: identify the transaction and screen through UI Automation context, map a specific screen plus a specific confirming control to `purchase_requisition.submit`, and extract amount, currency, and company code as context. The mapping is declarative and versioned, so an application update that breaks a mapping produces a fail-closed unmatched action rather than a silent permit.

---

## 26. Simulation and replay

Status: `NEXT`.

Because `authorization-engine` is a pure function and decisions store an immutable request snapshot, two capabilities follow directly:

- **Simulation.** Evaluate a proposed policy version against historical requests and report which decisions would change. This lets a customer see the blast radius of a policy edit before publishing it.
- **Replay.** Re-evaluate a historical decision with its original snapshot and confirm the recorded result, which is both a correctness check and an audit answer to "why was this allowed?".

Requirements this places on the MVP, which is why they are built now even though the feature is later: complete request snapshots, policy version immutability, a decision reference to the exact policy version, and an engine with no hidden inputs such as wall-clock reads.

---

## 27. Open source versus commercial packaging

A working assumption for the team, to be confirmed commercially.

| Component | Suggested packaging | Reason |
| --- | --- | --- |
| `action-model`, `policy-schema`, `authzen-adapter` | Open source | Adoption depends on the action model being an open contract. |
| `evidence-sdk`, `api-client` | Open source | Client libraries should be inspectable and forkable. |
| `mcp-guard` reference implementation | Open source | It runs in customer infrastructure and holds credentials, so customers must be able to read it. |
| `authorization-engine` | Open source or source available | Determinism claims are more credible when the engine can be reviewed. |
| Control plane API and web application | Commercial | Multi-tenancy, policy management, and the timeline are the product. |
| Desktop Guard | Commercial | Signed binaries, the native helper, and support are the value. |
| Business policy packs, approval, simulation, replay, semantic adapters | Commercial | These are the moat. |

The principle: anything that runs inside customer infrastructure and touches credentials should be readable. Anything that is operated as a service can be commercial.

---

## 28. Risks and trade-offs

| Risk | Assessment | Response |
| --- | --- | --- |
| Fail closed makes AuthBlade a business dependency | Real and accepted | Documented plainly, high availability and a local PDP on the roadmap, low-risk interactions handled locally. |
| Desktop enforcement is genuinely hard | The main technical risk | Native helper rather than renderer enforcement, layered with operating system controls, honest scoping of the initial release. |
| Overclaiming prevention | The main reputational risk | The preventive versus detective distinction is stated in the product, the documentation, and the landing page. |
| Semantic adapters are brittle | Real | Declarative versioned mappings, fail closed on an unmatched mapping, application-level enforcement working first. |
| Action type vocabulary fragmentation | Real | Per-workspace registered vocabularies, validation against them, and shipped starter vocabularies. |
| Latency in interactive desktop work | Real | Local evaluation for interactions, central evaluation for operations and business actions, explicit performance targets. |
| Enterprise identity integration debt | Moderate | External identifiers modelled as attributes from the start. |
| Approval fatigue once approval ships | Moderate | Risk-based triggering rather than blanket approval, and exact-action binding so approvals stay meaningful. |
| Competing with platform-native controls | Commercial | Position as cross-channel and complementary, never as a replacement for operating system or identity controls. |
| Scope creep into SIEM or APM | Commercial and technical | The non-goals list is enforced in review. |

Trade-offs consciously accepted:

1. **PostgreSQL over a graph database.** Simpler operations and adequate for the modelled depth, at the cost of complex path queries later. Revisit only with evidence.
2. **JSON policies over a policy DSL.** Less expressive, far more analysable, and a precondition for simulation. Revisit only when customers hit a real wall.
3. **AND-only conditions.** More policies, simpler review. This is a deliberate correctness choice.
4. **No fail-open.** Availability cost accepted in exchange for the guarantee.
5. **Electron plus a native helper rather than a pure native application.** Slower on Windows-specific depth, faster on the operator interface and cross-platform control plane reuse.

---

## 29. Next step

The immediate next step is Phase 1 combined with the vertical slice of Phase 2, delivered together rather than sequentially, because the isolation and determinism guarantees are only credible when demonstrated end to end.

Concretely, the first sprint should produce:

1. The Supabase schema for the minimum MVP table set, with RLS on every tenant table and a passing tenant isolation suite.
2. The `authorization-engine` package with the nine MVP operators, effect combination, default DENY, and a golden decision corpus derived from the demo policy set.
3. `POST /api/v1/authorize` with enforcement-point authentication, Zod validation, decision persistence with an immutable snapshot, and fail-closed behaviour on every error path.
4. A minimal React view listing decisions with reason code, matching policy version, and latency.

The measurable exit criterion for the sprint: a developer with a fresh workspace can register an agent and an enforcement point, publish the demo policy set, and receive a correct ALLOW at EUR 2,500 and a correct DENY at EUR 25,000, with both decisions visible and explainable in the user interface, and with the cross-workspace isolation and fail-closed suites green.

Everything after that follows the phase order in [section 23](#23-mvp-phases).
