# AuthBlade Roadmap

Phases from the landing page to enterprise deployment.

Companion documents: [implementation-concept.md](implementation-concept.md), [architecture.md](architecture.md), [security-model.md](security-model.md), [data-model.md](data-model.md).

---

## Status vocabulary

| Label | Meaning |
| --- | --- |
| `DEFINED` | Defined product component. The design is settled. The initial technical implementation may still be limited. |
| `DONE` | Implemented in this repository. |
| `MVP` | In scope for the first implementable release. |
| `NEXT` | Next phase after the MVP. Extension points are designed now, behaviour is not built now. |
| `LATER` | Long-term roadmap. The architecture must not block it, nothing is promised. |

Nothing labelled `NEXT` or `LATER` may be presented in public material as available.

---

## Phase 0: Landing page and documentation `DONE`

Delivered in this repository:

- A static landing page in HTML, CSS, and minimal vanilla JavaScript, deployable on GitHub Pages with no build step.
- This documentation set: implementation concept, architecture, security model, data model, and roadmap.

Not delivered: any part of the platform itself.

---

## Phase 1: Foundation `MVP`

| Item | Description |
| --- | --- |
| Supabase project | Database, auth, and local development configuration. |
| Schema and migrations | The minimum MVP table set, applied through ordered SQL migrations. |
| Row Level Security | Enabled on every tenant table, with a passing isolation suite. |
| Authentication | Supabase Auth for control plane users. |
| Workspaces | Creation, membership, and roles. |
| API keys | Issue, hash, rotate, revoke. |
| API skeleton | Node and TypeScript, Zod validation, stable error codes, request correlation. |
| Web application shell | React, TypeScript, Vite, Tailwind, accessible navigation and layout. |

**Exit criterion:** a user signs in, creates a workspace, and the tenant isolation suite proves that no cross-workspace read, write, or delete is possible.

---

## Phase 2: MCP MVP `MVP`

Authority plus the first enforcement channel, delivered as one vertical slice because neither is credible alone.

| Item | Description |
| --- | --- |
| Agent Registry | Agents with type, owner, environment, attributes, and an active flag. |
| Enforcement-point Registry | Separate registration, separate credentials, permitted channels and agents. |
| `authorization-engine` | A pure package implementing the nine MVP operators, default DENY, and explicit DENY precedence. |
| Policy storage | JSON policies validated against the schema, with immutable published versions. |
| `POST /api/v1/authorize` | Enforcement-point authentication, validation, evaluation, immutable snapshot persistence, fail-closed error paths. |
| Policy editor | Authoring and validation in the web application. |
| MCP Guard | Tool-to-action mapping, blocking authorization call, credential isolation, execution, outcome reporting. |

**Exit criterion:** `create_purchase_requisition` executes at EUR 2,500 and is refused at EUR 25,000, the golden decision corpus passes, and the determinism test proves that identical input plus identical policy version yields an identical decision.

---

## Phase 3: Observability `MVP`

| Item | Description |
| --- | --- |
| Tasks, sessions, traces | The correlation spine, written by enforcement points. |
| Actions and outcomes | Recording with evidence source and evidence level. |
| Match status | `MATCHED`, `UNMATCHED`, `NOT_EXECUTED`, `UNKNOWN`, stored and displayed. |
| Combined timeline | One ordered view per task and per session, distinguishing ALLOW, DENY, EXECUTED, BLOCKED, SUCCESS, and FAILED by shape and text as well as colour. |
| JSON export | Structured evidence export for a task or a time range. |

**Exit criterion:** the demo task timeline shows every event with the correct verdict, the correct evidence level, and correct correlation.

---

## Phase 4: Desktop Guard MVP `DEFINED`, initial implementation

Desktop Guard is an existing defined product component. This phase delivers its initial technical implementation.

| Item | Description |
| --- | --- |
| Device and session registration | Enrolment, credential binding, session lifecycle. |
| Native Windows helper | Process and foreground-window detection, running under a separate account. |
| Application launch authorization | Central evaluation of `application.launch`. |
| Signed session policy | Issued at session start, expiring, verified by the helper. |
| Enforcement | Denied launches are prevented, not merely logged. |
| Event reporting | Actions, decisions, and outcomes with `ENFORCEMENT_OBSERVED` evidence. |
| Operator interface | Electron and React renderer showing session status and the local timeline. |
| Electron hardening | Every requirement in the security model asserted by automated tests. |

**Exit criterion:** Excel, Word, and SAP GUI launch. Outlook, PowerShell, and Command Prompt are blocked. Every attempt appears in the combined timeline with enforcement-observed evidence, and the Electron security assertions pass.

Explicitly out of scope for this phase: deep UI Automation, business-action recognition, and SAP semantics. Application-level enforcement must work first.

---

## Phase 5: Evaluation `NEXT`

| Item | Description |
| --- | --- |
| Risk evaluation | The `RiskEvaluator` extension computing risk attributes usable in policy. |
| Deviation signals | Surfacing actions inconsistent with the declared task mandate. |
| Semantic matching | The `ActionMatcher` extension comparing normalized resources and parameters, detecting parameter drift, duplicate execution, and expired authorization. |
| Policy analytics | Which policies match, which never match, and which denials recur. |

---

## Phase 6: Approval `NEXT`

| Item | Description |
| --- | --- |
| `REQUIRE_APPROVAL` effect | Added to the decision enum and the effect combination, ranking below DENY and above ALLOW. |
| Approval requests | Created on `REQUIRE_APPROVAL`, with enforcement paused and no partial execution. |
| Reviewer interface | Agent, user, task, purpose, action, system, resource, parameters, risk, matching policy, related actions, expected result, and expiration. |
| Re-evaluation after approval | Policy remains authoritative. Approval is an input, not a replacement. |
| Action-bound permits | Exact-action binding, material-change invalidation, expiration, single use. |
| Segregation of duties | The initiator is not automatically an eligible approver. |
| Notifications | The `NotificationProvider` extension. |

**Constraint:** no approval creates a broad standing permission.

---

## Phase 7: Semantic adapters `NEXT`

| Item | Description |
| --- | --- |
| Adapter framework | Declarative, versioned mappings from native signals to business action types. |
| Deep UI Automation | Window, control, and screen context from Windows UI Automation. |
| SAP GUI adapter | The first application adapter: transaction and screen identification, confirming-control mapping, and extraction of amount, currency, and company code. |
| Screen-state verification | Confirming that the observed state matches the authorized action. |
| Consequential-button interception | Enforcement at the confirming control rather than only at application launch. |
| Fail-closed mappings | An application update that breaks a mapping produces an unmatched action, never a silent permit. |

---

## Phase 8: Simulation and replay `NEXT`

| Item | Description |
| --- | --- |
| Replay | Re-evaluate a historical decision from its stored snapshot and confirm the recorded result. |
| Simulation | Evaluate a proposed policy version against historical requests and report which decisions would change. |
| Blast radius report | What a policy edit would allow or deny that it previously did not. |

This phase is cheap because its prerequisites are built in the MVP: complete request snapshots, immutable policy versions, decisions referencing the exact version, and an engine with no hidden inputs.

---

## Phase 9: Browser Guard and Code Guard `NEXT`

| Component | Scope |
| --- | --- |
| Browser Guard | Domains and URLs, uploads and downloads, form submissions, sensitive fields, browser sessions, external communications, final confirmation actions. A managed extension for observation paired with a trusted proxy for enforcement. |
| Code Guard | Repositories and paths, commands, package installation, pull requests, branches, secrets, deployment targets, production changes. Enforcement at the tool boundary, with no generic shell tool. |

---

## Phase 10: Enterprise deployment `LATER`

| Item | Description |
| --- | --- |
| Private cloud and self-hosting | For customers who cannot use multi-tenant SaaS. |
| Regional data residency | Deployment and storage per region. |
| Customer-managed encryption | Customer-held keys for evidence data. |
| Local policy decision point | The pure engine embedded on customer infrastructure for latency or sovereignty, which also softens the control plane availability dependency. |
| Local evidence processing | Evidence that never leaves the customer environment. |
| High availability and service levels | Formal availability commitments. |
| Cryptographic evidence | Signed evidence chains, which is the precondition for any stronger evidence claim than "audit-ready". |
| Enterprise identity integration | Entra Agent ID, Okta, OAuth token exchange, workload identity, mTLS, signed assertions, formal delegation chains. |
| Delegation control | Enforcing which agents may delegate to which, rather than only recording it. |
| Business policy packs | Reusable rule sets for recurring enterprise processes. |

---

## Desktop Guard scope summary

Because this component is most likely to be misread, its scope is restated in one place.

| Initial implementation | Later |
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

Throughout every phase, Desktop Guard complements and does not replace Windows App Control, AppLocker, account separation, Citrix policies, VM isolation, endpoint management, network restrictions, mailbox entitlements, and Microsoft Graph permissions.

---

## Sequencing rationale

1. **Isolation before features.** Tenant isolation is the one defect class that cannot be fixed after customers arrive.
2. **Determinism before breadth.** A reproducible engine is the precondition for simulation, replay, and any audit claim.
3. **MCP before desktop.** The structured channel proves the model end to end with far less environmental complexity.
4. **Application-level desktop enforcement before semantics.** Blocking Outlook is useful on its own and is achievable. Recognising a SAP transaction is neither, until the layer below it works.
5. **Approval after evaluation.** Approval without risk evaluation produces approval fatigue, which makes approval meaningless.
6. **Evidence claims last.** "Audit-ready action chain" is defensible now. Anything stronger waits for cryptographic and target-confirmed evidence.

---

## Immediate next step

Phase 1 combined with the vertical slice of Phase 2, delivered together. The first sprint produces:

1. The Supabase schema for the minimum MVP table set, with RLS on every tenant table and a passing tenant isolation suite.
2. The `authorization-engine` package with the nine MVP operators, effect combination, default DENY, and a golden decision corpus derived from the demo policy set.
3. `POST /api/v1/authorize` with enforcement-point authentication, validation, immutable snapshot persistence, and fail-closed behaviour on every error path.
4. A minimal React view listing decisions with reason code, matching policy version, and latency.

**Measurable exit criterion:** a developer with a fresh workspace registers an agent and an enforcement point, publishes the demo policy set, and receives a correct ALLOW at EUR 2,500 and a correct DENY at EUR 25,000, with both decisions visible and explainable in the user interface, and with the isolation and fail-closed suites green.
