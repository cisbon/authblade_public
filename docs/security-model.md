# AuthBlade Security Model

Threats, credential handling, fail-closed behaviour, Electron hardening, MCP and desktop limitations, tenant isolation, and data minimization.

Companion documents: [implementation-concept.md](implementation-concept.md), [architecture.md](architecture.md), [data-model.md](data-model.md), [roadmap.md](roadmap.md).

This document describes the security model of a system under design. It makes no claim of certification, audit, or legal compliance.

---

## 1. Security objectives

1. An agent cannot perform a protected action without a prior ALLOW decision from AuthBlade.
2. An agent cannot obtain a reusable downstream credential.
3. A DENY decision cannot be overridden by the agent.
4. A decision is reproducible from its stored snapshot.
5. Execution and its outcome are recorded with an honest evidence level.
6. One workspace cannot read or write another workspace's data.
7. Failure of the control plane does not become permission.

Objective 1 holds only where the agent cannot reach the target system without crossing an enforcement point. That precondition is a deployment property, and assessing it per channel is part of the deployment method.

---

## 2. Trust zones

| Zone | Contents | Trust | Assumption |
| --- | --- | --- | --- |
| Z0 | Model context: prompt, tool schemas, tool results, retrieved content | Untrusted | Anything reaching the context can influence behaviour. Content is data, never instruction to the security layer. |
| Z1 | Agent runtime process | Low trust | May be honest. Must never be relied upon for enforcement. |
| Z2 | Enforcement points: MCP Guard, Desktop Guard main process and native helper, gateways | Trusted | Holds credentials, enforces decisions, produces observed evidence. |
| Z3 | Control plane: API, engine, database | Trusted | Authoritative for decisions and records. |
| Z4 | Target systems and the desktop operating system | Independently governed | Retains its own access controls, which remain necessary. |

The entire security value rests on the Z1 to Z2 boundary. Where an agent can reach Z4 without crossing Z2, AuthBlade is detective rather than preventive, and product material must say so.

---

## 3. Threat model

| ID | Threat | Mitigation | Residual risk |
| --- | --- | --- | --- |
| T1 | Prompt injection drives a harmful action | The enforcement point evaluates the action independently of prompt content. Default DENY. Explicit DENY for high-impact action types. | Actions that policy permits but that are contextually inappropriate. Addressed by risk evaluation and approval, both `NEXT`. |
| T2 | The agent skips the authorization call | The enforcement point makes the call, not the agent. Target credentials exist only inside the enforcement point, so skipping the call also means having no way to execute. | A channel deployed with no enforcement point. Mitigated by narrowing the agent's reachable surface. |
| T3 | The agent ignores a DENY | The enforcement point does not execute on DENY, and the agent has no direct execution path. | An enforcement point implemented as advisory. Prohibited by design and asserted in the bypass test suite. |
| T4 | Credential exfiltration through the model | No reusable downstream credential is ever returned to the agent. No tool returns tokens, passwords, cookies, or keys. | Credentials leaked through paths outside AuthBlade's scope. |
| T5 | The agent disables Desktop Guard | The native helper runs under a separate, more privileged account that the agent account cannot stop. Tamper detection, health reporting, and fail closed for protected actions. | A locally privileged attacker. Depends on operating system controls. |
| T6 | The agent launches an unapproved process | Application allow and deny enforcement, layered with Windows App Control or AppLocker as the operating system control. | Desktop Guard alone is not an operating system control. Layering is mandatory, not optional. |
| T7 | A spoofed enforcement point | Each enforcement point authenticates with its own credential. AuthBlade verifies it may represent the claimed agent and channel. | Credential theft from the enforcement point host. Reduced by short-lived credentials and device binding. |
| T8 | A spoofed agent identity | Agent identity claims are accepted only from an authenticated enforcement point. | An enforcement point configured to represent too many agents. Reduced by scoping at registration. |
| T9 | Cross-tenant data access | Row Level Security on every tenant table, plus an explicit workspace filter in every server query. | A new table shipped without a policy. Prevented by a mandatory RLS test per table. |
| T10 | Tampering with history | Decisions and outcomes are append only at the application layer, with immutable request and policy snapshots. | Database administrator access. Cryptographic evidence is `LATER`. |
| T11 | A control plane outage used as a bypass | Fail closed, with no fail-open mode in the MVP. | Availability becomes a business dependency. Accepted and documented. |
| T12 | Sensitive data leaking into evidence | Metadata only, payload size limits, redaction at ingestion, no screenshots by default. | Poorly chosen custom attribute values. Addressed by documentation and review. |
| T13 | Replay of an authorization decision | Decisions carry identifiers, timestamps, and a validity window. Action-bound single-use permits are `NEXT`. | In the MVP, binding is recorded rather than cryptographically enforced. |
| T14 | A malicious or compromised child agent | Parent and child identity are recorded. Delegation control is `NEXT`. | Delegation is observable before it is controllable. |
| T15 | A supply chain compromise of a Guard binary | Signed binaries, verified updates, pinned dependencies, dependency and secret scanning in continuous integration. | A compromise of the signing pipeline. |
| T16 | An enforcement point rebinds parameters between authorization and execution | The parameters authorized must be the parameters executed. Asserted in integration tests. | A customer-authored enforcement point that does not follow the contract. |

---

## 4. What this design does not defend against

Stated plainly, because an overclaimed boundary is itself a risk:

- A human insider with legitimate access to the target system.
- An operating system compromise at or above the privilege of the native helper.
- A target system that accepts changes through a path with no enforcement point.
- Business-logic harm from an action that policy legitimately permits.
- Model behaviour inside the model. AuthBlade governs actions, not reasoning.

---

## 5. Credential handling

### 5.1 The core rule

The agent receives a business capability, not the credential behind it.

The agent must never receive production API keys, passwords, OAuth refresh tokens, session cookies, private keys, service-account credentials, or any other reusable downstream credential.

### 5.2 Where credentials live

| Credential | Location | Never |
| --- | --- | --- |
| Target system credentials | Inside the trusted MCP Guard or the customer's secret store | In the model context, in the AuthBlade SaaS, or in any event record |
| Enforcement-point credential | On the enforcement-point host, in the native helper for Desktop Guard | In an Electron renderer, in the browser, or in a log |
| API keys for the control plane | Customer side; only a hash is stored by AuthBlade | Stored in plaintext or returned after issue |
| Supabase service role key | Server side in the API only | In any client, including the React application |

### 5.3 Credential lifecycle

1. Registration issues a credential exactly once and displays it once. Only a hash plus a non-secret lookup prefix is stored.
2. Credentials are scoped to a workspace, to an enforcement-point type, and optionally to a registered device.
3. Desktop Guard credentials are short lived and refreshed by the native helper, never by the renderer.
4. Rotation and revocation are first-class operations. Revocation takes effect on the next authorization call, with no grace period for protected actions.
5. Every credential use is attributable in the decision record.

### 5.4 Tool design as a credential control

Tool shape is a security control, not an ergonomics choice. A tool that returns a secret, or that accepts an arbitrary command, defeats every other control in this document.

Safe:

```
create_purchase_requisition(company_code, supplier_id, amount, currency, description)
```

Prohibited in a governed deployment:

```
get_sap_password()
get_access_token()
execute_arbitrary_http_request()
execute_arbitrary_sap_request()
run_arbitrary_shell_command()
```

---

## 6. Deterministic decisions

| Property | Requirement |
| --- | --- |
| Default DENY | Anything unmatched is denied. |
| Explicit DENY precedence | A matching DENY overrides any matching ALLOW. |
| Inactive agents | Denied. |
| Invalid requests | Denied. |
| Errors and timeouts | Denied, and recorded with a specific reason code. |
| No model in the decision path | A large language model never makes the final decision. It may help author or explain policy. |
| Reproducibility | Identical input plus identical policy version produces an identical decision. |

Determinism excludes hidden inputs. Time is captured once at request ingress, written into the snapshot, and passed into evaluation as a value. The engine performs no wall-clock reads, no network calls, and no database reads of its own.

The MVP operator set is deliberately small: `equals`, `not_equals`, `in`, `not_in`, `less_than`, `less_than_or_equal`, `greater_than`, `greater_than_or_equal`, `exists`. There is no arithmetic, no string manipulation, no regular expressions, no loops, and no user-supplied code. This is what makes the engine provably terminating, reviewable by an auditor, and safe to run against historical requests for simulation.

---

## 7. Fail-closed behaviour

| Situation | Behaviour | Reason code |
| --- | --- | --- |
| Control plane unreachable, protected write | No execution | `CONTROL_PLANE_UNREACHABLE` |
| Authorization timeout | DENY | `EVALUATION_TIMEOUT` |
| Internal evaluation error | DENY | `EVALUATION_ERROR` |
| Invalid or oversized payload | DENY | `INVALID_REQUEST` |
| Unknown agent | DENY | `AGENT_UNKNOWN` |
| Inactive agent | DENY | `AGENT_INACTIVE` |
| Enforcement point not permitted for this agent or channel | DENY | `PEP_NOT_AUTHORIZED_FOR_AGENT` |
| Session policy expired | Protected actions blocked until refreshed | `SESSION_POLICY_EXPIRED` |
| Rate limit exceeded | Explicit error, never a silent ALLOW | `RATE_LIMITED` |

There is no fail-open mode in the MVP. An operator switch that flips authorization to fail open would remove the guarantee the product exists to provide. The consequence, that control plane availability becomes a business dependency, is accepted, documented in deployment guidance, and addressed on the roadmap by a local decision point.

Denials and failures are themselves recorded. A blocked action is evidence, and losing it would be as damaging as losing a successful one.

---

## 8. Local decisions and cache safety

Desktop Guard may evaluate low-risk interaction-level events locally against a signed, expiring session policy issued at session start.

Constraints:

- The session policy is a restricted subset: application allow and deny lists, window and control scopes, and an explicit list of action types that must always go to the control plane.
- Anything classified as a business action, or as a business-relevant operation, requires central evaluation.
- The signature is verified by the native helper, not by the renderer.
- The session policy expires. On expiry, protected actions fail closed.
- Revocation is honoured at the next central call, and the session policy lifetime bounds the revocation window. That bound is a documented configuration value, not an implementation detail.
- Caches hold policy definitions and session policies. They never hold decisions for protected actions.

---

## 9. Electron security

Electron is required for Desktop Guard because a local component must govern and observe desktop execution and ship as a managed, signed, updatable desktop application.

**Electron alone is not the security boundary.** An ordinary Electron renderer cannot block a Windows process, and no product material may claim it can. The boundary is the combination of the Electron main process, a native Windows helper or service running under a separate account, and operating system and environment controls.

### 9.1 Hardening requirements

Each item is a build-time or test-time assertion, not a guideline:

- `nodeIntegration` disabled.
- `contextIsolation` enabled.
- `sandbox` enabled where possible.
- Strict Content Security Policy, no inline script, no remote origins.
- `webSecurity` enabled.
- No remote module.
- Minimal preload bridge with an explicitly enumerated surface. No generic invoke passthrough.
- Explicit IPC allowlist. Unknown channels are rejected and logged.
- Every IPC message validated against a schema.
- No generic command execution.
- No generic process launch.
- No arbitrary PowerShell.
- No arbitrary file access.
- No secrets in the renderer.
- `will-navigate` and `setWindowOpenHandler` deny all external navigation. The renderer loads only local files.
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
- A local event queue for temporary outages, encrypted at rest.

### 9.2 Privilege separation

| Component | Privilege | Holds credentials | Can enforce |
| --- | --- | --- | --- |
| Renderer | Lowest | No | No |
| Preload | Lowest | No | No |
| Main process | Standard user | Short-lived tokens only, in memory | Indirectly, by refusing to relay |
| Native helper or service | Elevated, separate account | Yes | Yes |

The renderer never talks to the helper. Every request travels renderer to preload to main to helper, validated at each hop. A compromise of the renderer yields the operator interface, not enforcement authority.

---

## 10. MCP limitations

- MCP Guard governs what passes through it. An agent with another route to the same target system is not governed by it.
- Tool design determines the ceiling. A broad tool cannot be narrowed by policy alone.
- Parameter-level authorization is only as good as the parameter-to-attribute mapping, which is configuration and therefore subject to review.
- Outcome evidence is `TARGET_CONFIRMED` only when the target returns a durable reference. Otherwise it is `ENFORCEMENT_OBSERVED`, and the interface shows that difference.

---

## 11. Desktop limitations

Stated directly, because this is the area where overclaiming is easiest and most damaging:

- Desktop Guard complements, and does not replace, Windows App Control, AppLocker, account separation, Citrix policies, VM isolation, endpoint management, network restrictions, mailbox entitlements, and Microsoft Graph permissions.
- AuthBlade alone does not prevent every Windows action without supporting operating system and environment controls.
- The initial implementation covers device and session registration, process and application identification, application allow and deny, event logging, and timeline integration. It does not yet cover deep UI Automation, business-action recognition, SAP adapters, screen-state verification, consequential-button interception, advanced local decisions, cryptographic evidence, Citrix integration, or advanced tamper resistance.
- Deployment guidance must state that the agent account is expected to be a restricted account and that application control is expected to be configured at the operating system level. Desktop Guard adds agent-aware authorization and evidence on top of that foundation.
- Within a Citrix or virtual desktop session, enforcement depends on where the Guard runs relative to the session. Guidance covers the supported topologies explicitly rather than implying universal coverage.

---

## 12. Tenant isolation

| Control | Description |
| --- | --- |
| `workspace_id` on every tenant record | No tenant table exists without it. |
| Row Level Security on every tenant table | Enabled without exception. A table without a policy fails the build. |
| No frontend filtering for isolation | The browser never determines what a user may see. |
| Explicit workspace filter in server queries | A second independent mechanism alongside RLS, so a single mistake is not sufficient to cross tenants. |
| Machine callers never hold a database credential | They authenticate to the Node API, which resolves the workspace from the credential rather than from the payload. |
| Mandatory isolation tests | For each tenant table, a test proves that a member of workspace A cannot read, write, or delete a row in workspace B, run against real PostgreSQL. |

The tenant isolation suite is a release blocker. So is the fail-closed suite.

---

## 13. Privacy and data minimization

<a id="privacy-and-data-minimization"></a>

### 13.1 Principles

- Structured metadata rather than full content.
- No credentials, in any record, ever.
- No hidden reasoning, no chain-of-thought, no full prompts.
- No screenshots by default.
- Payload size limits on every free-form field.
- Redaction at ingestion, with a deny list for common secret shapes and a per-action-type field allowlist.
- Configurable retention `NEXT`.
- A documented workspace deletion process.
- Immutable application history combined with a necessary administrative deletion capability, so a lawful deletion request can be honoured without pretending records were never written.

### 13.2 Where personal data appears

| Location | Data | Minimization |
| --- | --- | --- |
| Delegation records | Delegating user identifier | An opaque identifier by default, not a name, unless the customer chooses otherwise. |
| Devices and sessions | Device identifier, session times, application usage | Retained for the correlation window. Interaction-level detail stays local and aggregated. |
| Control plane accounts | Names and email addresses of platform users | Standard account data, managed through Supabase Auth. |

Desktop Guard is not a workforce monitoring tool. The interaction-level data that would make it one is deliberately kept local and aggregated rather than shipped to the control plane. Where a human shares a desktop with an agent, deployment guidance must cover worker consultation and notice obligations, which vary by jurisdiction and are the customer's responsibility.

### 13.3 Future privacy capabilities `LATER`

Data residency options, customer-managed encryption keys, and local evidence processing where evidence never leaves the customer environment.

---

## 14. Secure development

| Practice | Requirement |
| --- | --- |
| Input validation | Zod schemas on every API boundary. Unknown fields rejected, not ignored. |
| Dependency management | Pinned versions, automated scanning, review for anything in the decision or credential path. |
| Secret scanning | In continuous integration, blocking on detection. |
| Redaction testing | A corpus of realistic secret shapes asserted absent from stored events. |
| Bypass testing | Attempts to execute without a decision, after a DENY, with an expired session policy, and with a mismatched enforcement point. |
| Electron assertions | Automated checks of every hardening item in section 9.1. |
| Fuzzing | On the authorization payload. |
| Configuration validation | A missing or malformed environment variable stops the process. A silently defaulted authorization setting is a security defect. |

---

## 15. Terms placeholder

<a id="terms-placeholder"></a>

Terms of service and a privacy notice are not published in this repository. The footer links here so that the landing page contains no fabricated legal pages.

Before a public launch, the following must be published as real documents: terms of service, a privacy notice covering the data categories in section 13, a data processing agreement with sub-processor disclosure, a security overview, and a vulnerability disclosure policy with a contact address and a response commitment.

No certification or legal compliance is claimed on the landing page or in this documentation set. Any future certification statement must reference an actual audit with a scope and a date.
