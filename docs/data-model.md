# AuthBlade Data Model

Entities, relationships, indexes, Row Level Security, and correlation.

Companion documents: [implementation-concept.md](implementation-concept.md), [architecture.md](architecture.md), [security-model.md](security-model.md), [roadmap.md](roadmap.md).

Platform: Supabase PostgreSQL. No graph database in the MVP. Correlation identifiers plus indexes are sufficient for the modelled depth, and revisiting that choice requires evidence from real query patterns.

Status labels: `MVP` first implementable release, `NEXT` next phase, `LATER` long-term roadmap.

---

## 1. Correlation spine

```
Task
 └─ Session
     └─ Trace
         └─ Decision
             └─ Action
                 └─ Outcome
```

A task may contain multiple sessions, traces, decisions, actions, retries, parallel branches, and child tasks. The hierarchy is a containment convention rather than a strict storage tree, so a partially reported chain remains queryable instead of being rejected.

Shared identifiers carried on events:

`workspace_id`, `agent_id`, `enforcement_point_id`, `task_id`, `session_id`, `trace_id`, `decision_id`, `action_id`, `outcome_id`, `parent_action_id`.

Every event carries `workspace_id` and as many others as are known. An event missing a correlation identifier is stored and reported as partially correlated, never silently dropped.

---

## 2. Entity overview

| Table | Purpose | Tenant scoped | Phase |
| --- | --- | --- | --- |
| `users` | Control plane user accounts, backed by Supabase Auth | No, global | `MVP` |
| `workspaces` | Tenant boundary | Root | `MVP` |
| `workspace_members` | User membership and role in a workspace | Yes | `MVP` |
| `agents` | Agent Registry | Yes | `MVP` |
| `agent_attributes` | Extended attributes for policy evaluation | Yes | `NEXT`, inline JSONB in the MVP |
| `enforcement_points` | Enforcement-point Registry | Yes | `MVP` |
| `enforcement_point_credentials` | Hashed credentials for enforcement points | Yes | `MVP` |
| `policies` | Stable policy identity | Yes | `MVP` |
| `policy_versions` | Immutable published policy versions | Yes | `MVP` |
| `tasks` | Assigned work | Yes | `MVP` |
| `sessions` | Bounded execution context | Yes | `MVP` |
| `traces` | Correlated unit of work inside a session | Yes | `NEXT`, `trace_id` recorded inline in the MVP |
| `authorization_decisions` | Immutable decision records | Yes | `MVP` |
| `actions` | Attempted or executed actions | Yes | `MVP` |
| `execution_outcomes` | Results of actions | Yes | `MVP` |
| `evidence_references` | Pointers to external evidence | Yes | `NEXT` |
| `approval_requests` | Pending human approvals | Yes | `NEXT` |
| `approval_decisions` | Approval results | Yes | `NEXT` |
| `devices` | Registered devices for Desktop Guard | Yes | `MVP` |
| `api_keys` | Hashed API keys for machine callers | Yes | `MVP` |

Minimum MVP set: `workspaces`, `workspace_members`, `agents`, `enforcement_points`, `policies`, `policy_versions`, `tasks`, `sessions`, `authorization_decisions`, `actions`, `execution_outcomes`, `api_keys`.

---

## 3. Relationships

```
workspaces 1─┬─* workspace_members *─1 users
             ├─* agents ─────────────┬─* agent_attributes
             │                       └─* tasks
             ├─* enforcement_points ─* enforcement_point_credentials
             ├─* devices ────────────* sessions
             ├─* policies ───────────* policy_versions
             ├─* tasks ──────────────* sessions ──* traces
             ├─* authorization_decisions ─┬─* actions ──* execution_outcomes
             │                            └─* approval_requests ──* approval_decisions
             └─* api_keys

actions.parent_action_id  ──> actions.id          (self reference, nested actions)
tasks.parent_task_id      ──> tasks.id            (self reference, child tasks)
agents.parent_agent_id    ──> agents.id           (self reference, delegation)
authorization_decisions.policy_version_id ──> policy_versions.id
```

---

## 4. Table definitions

Types are given as PostgreSQL types. All identifier columns are `uuid` unless the value is a customer-supplied external key, in which case it is `text` and a separate internal `uuid` primary key exists.

### 4.1 `workspaces`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `name` | `text` | |
| `slug` | `text` unique | |
| `created_at` | `timestamptz` | |
| `deleted_at` | `timestamptz` null | Soft delete drives the workspace deletion process. |

### 4.2 `workspace_members`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `workspace_id` | `uuid` FK | |
| `user_id` | `uuid` FK to `auth.users` | |
| `role` | `text` | `owner`, `admin`, `editor`, `viewer` |
| `created_at` | `timestamptz` | |

Unique on (`workspace_id`, `user_id`).

### 4.3 `agents`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | AuthBlade agent ID |
| `workspace_id` | `uuid` FK | |
| `external_id` | `text` | Customer-facing identifier such as `procurement-agent-01` |
| `name` | `text` | |
| `agent_type` | `text` | `mcp`, `computer-use`, `browser`, `coding`, `workflow`, `communication`, `transaction`, `infrastructure` |
| `owner` | `text` | Accountable team or person |
| `department` | `text` null | |
| `environment` | `text` | `development`, `test`, `staging`, `production` |
| `risk_rating` | `text` null | |
| `parent_agent_id` | `uuid` null FK | Delegation |
| `attributes` | `jsonb` | Capabilities, limits, permitted systems |
| `is_active` | `boolean` | Inactive agents are denied |
| `created_at`, `updated_at` | `timestamptz` | |

Unique on (`workspace_id`, `external_id`).

### 4.4 `enforcement_points`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `workspace_id` | `uuid` FK | |
| `external_id` | `text` | Such as `desktop-guard-4711` |
| `type` | `text` | `MCP_GUARD`, `DESKTOP_GUARD`, `BROWSER_GUARD`, `CODE_GUARD`, `GATEWAY` |
| `permitted_channels` | `text[]` | Which `environment.channel` values it may assert |
| `permitted_agent_ids` | `uuid[]` null | Null means any agent in the workspace |
| `device_id` | `uuid` null FK | Set for Desktop Guard |
| `version` | `text` | Reported software version |
| `trust_status` | `text` | `trusted`, `degraded`, `revoked` |
| `last_seen_at` | `timestamptz` null | Health reporting |
| `is_active` | `boolean` | |
| `created_at`, `updated_at` | `timestamptz` | |

Unique on (`workspace_id`, `external_id`).

### 4.5 `enforcement_point_credentials`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `workspace_id` | `uuid` FK | |
| `enforcement_point_id` | `uuid` FK | |
| `key_prefix` | `text` | Non-secret lookup prefix |
| `key_hash` | `text` | Hash only. The secret is shown once at issue. |
| `expires_at` | `timestamptz` null | Short lived for Desktop Guard |
| `revoked_at` | `timestamptz` null | Revocation takes effect on the next authorization call |
| `created_at` | `timestamptz` | |

Index on (`key_prefix`).

### 4.6 `api_keys`

Same shape as `enforcement_point_credentials`, scoped to a workspace and a role rather than to an enforcement point. Used for control plane automation, never for enforcement.

### 4.7 `devices`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `workspace_id` | `uuid` FK | |
| `external_id` | `text` | Machine identifier |
| `hostname` | `text` | |
| `os_version` | `text` | |
| `environment_kind` | `text` | `physical`, `vdi`, `citrix`, `cloud_pc` |
| `enrolled_at` | `timestamptz` | |
| `trust_status` | `text` | `trusted`, `degraded`, `revoked` |
| `last_health_at` | `timestamptz` null | Tamper detection and health reporting |

### 4.8 `policies` and `policy_versions`

`policies`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `workspace_id` | `uuid` FK | |
| `external_id` | `text` | Such as `pr-limit-de` |
| `name`, `description` | `text` | |
| `is_active` | `boolean` | |
| `current_version_id` | `uuid` null FK | |
| `created_at`, `updated_at` | `timestamptz` | |

`policy_versions`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `workspace_id` | `uuid` FK | |
| `policy_id` | `uuid` FK | |
| `version` | `integer` | Monotonic per policy |
| `effect` | `text` | `ALLOW`, `DENY`, later `REQUIRE_APPROVAL`, `ALLOW_WITH_OBLIGATIONS` |
| `priority` | `integer` | |
| `definition` | `jsonb` | The full policy document, validated against the JSON Schema |
| `reason_code` | `text` | |
| `published_at` | `timestamptz` | |
| `published_by` | `uuid` FK | |

Unique on (`policy_id`, `version`). Rows are immutable after publication, enforced by a trigger that rejects updates.

### 4.9 `tasks`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `workspace_id` | `uuid` FK | |
| `external_id` | `text` null | Such as `task-882` |
| `agent_id` | `uuid` FK | |
| `delegated_user_id` | `text` null | Opaque identifier by default |
| `parent_task_id` | `uuid` null FK | |
| `purpose` | `text` | |
| `description` | `text` null | |
| `constraints` | `jsonb` | Declared limits for the task |
| `environment` | `jsonb` | Channel, production flag, and related context |
| `status` | `text` | `RUNNING`, `COMPLETED`, `FAILED`, `ABORTED` |
| `started_at`, `ended_at` | `timestamptz` | |

### 4.10 `sessions`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `workspace_id` | `uuid` FK | |
| `task_id` | `uuid` null FK | |
| `agent_id` | `uuid` FK | |
| `enforcement_point_id` | `uuid` FK | |
| `device_id` | `uuid` null FK | |
| `channel` | `text` | |
| `session_policy_id` | `text` null | The signed session policy issued at session start |
| `session_policy_expires_at` | `timestamptz` null | Bounds the revocation window |
| `status` | `text` | `OPEN`, `CLOSED`, `EXPIRED` |
| `started_at`, `ended_at` | `timestamptz` | |

### 4.11 `traces` `NEXT`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `workspace_id` | `uuid` FK | |
| `task_id`, `session_id` | `uuid` FK | |
| `external_trace_id` | `text` | Interoperates with existing tracing systems |
| `started_at`, `ended_at` | `timestamptz` | |

In the MVP, `trace_id` is recorded as a column on decisions and actions. Promoting it to a table is a `NEXT` migration that does not change the recorded values.

### 4.12 `authorization_decisions`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | `decision_id` |
| `workspace_id` | `uuid` FK | |
| `task_id`, `session_id` | `uuid` null FK | |
| `trace_id` | `text` null | |
| `agent_id` | `uuid` FK | |
| `delegated_user_id` | `text` null | |
| `enforcement_point_id` | `uuid` FK | |
| `action_type` | `text` | |
| `resource_type`, `resource_id` | `text` null | |
| `request_snapshot` | `jsonb` | The full evaluated request, immutable |
| `resolved_attributes` | `jsonb` | Attributes as resolved at evaluation time, immutable |
| `policies_evaluated` | `jsonb` | Identifiers and versions considered |
| `policy_version_id` | `uuid` null FK | The version that produced the decision |
| `decision` | `text` | `ALLOW`, `DENY`, later `REQUIRE_APPROVAL`, `ALLOW_WITH_OBLIGATIONS` |
| `reason_code` | `text` | |
| `reason` | `text` | |
| `decided_at` | `timestamptz` | |
| `latency_ms` | `integer` | |
| `expires_at` | `timestamptz` null | Validity window for the decision |

Append only at the application layer. A trigger rejects updates and deletes outside the administrative deletion path.

### 4.13 `actions`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | `action_id` |
| `workspace_id` | `uuid` FK | |
| `decision_id` | `uuid` null FK | Null means no decision was recorded, which is itself a finding |
| `parent_action_id` | `uuid` null FK | |
| `task_id`, `session_id` | `uuid` null FK | |
| `trace_id` | `text` null | |
| `agent_id`, `enforcement_point_id` | `uuid` FK | |
| `action_type` | `text` | |
| `action_level` | `text` | `INTERACTION`, `OPERATION`, `BUSINESS_ACTION` |
| `application` | `text` null | Application or target |
| `resource_type`, `resource_id` | `text` null | |
| `input_metadata` | `jsonb` | Safe metadata only. Never payloads, never secrets. |
| `status` | `text` | `STARTED`, `SUCCESS`, `FAILED`, `NOT_EXECUTED`, `BLOCKED` |
| `match_status` | `text` | `MATCHED`, `UNMATCHED`, `NOT_EXECUTED`, `UNKNOWN` |
| `started_at`, `ended_at` | `timestamptz` | |
| `result_reference` | `text` null | External reference such as a document number |
| `error_code`, `error_message` | `text` null | |
| `evidence_source` | `text` | Which component asserted this |
| `evidence_level` | `text` | `AGENT_DECLARED`, `ENFORCEMENT_OBSERVED`, `TARGET_CONFIRMED` |
| `event_key` | `text` | Idempotency key from the enforcement point |

Unique on (`workspace_id`, `event_key`).

### 4.14 `execution_outcomes`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | `outcome_id` |
| `workspace_id` | `uuid` FK | |
| `decision_id` | `uuid` null FK | |
| `action_id` | `uuid` FK | |
| `status` | `text` | `SUCCESS`, `FAILED`, `NOT_EXECUTED`, `BLOCKED` |
| `external_reference` | `text` null | |
| `result_metadata` | `jsonb` | Safe metadata only |
| `executed_at` | `timestamptz` null | When the target executed it |
| `reported_at` | `timestamptz` | When AuthBlade received the report |
| `evidence_source` | `text` | |
| `evidence_level` | `text` | |

Separating `executed_at` from `reported_at` is deliberate. A queued Desktop Guard event replayed after an outage keeps its original execution time while recording honestly when it arrived.

### 4.15 `evidence_references` `NEXT`

Pointers to evidence held outside AuthBlade, such as a target system document, an export bundle, or a signed attestation. Fields: `id`, `workspace_id`, `action_id`, `outcome_id`, `kind`, `locator`, `hash`, `created_at`. Storing a locator and a hash rather than the artefact keeps data minimization intact.

### 4.16 `approval_requests` and `approval_decisions` `NEXT`

`approval_requests`: `id`, `workspace_id`, `decision_id`, `task_id`, `agent_id`, `requested_action` (`jsonb`, the exact bound action), `risk_summary`, `status` (`PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`), `expires_at`, `created_at`.

`approval_decisions`: `id`, `workspace_id`, `approval_request_id`, `approver_user_id`, `decision`, `comment`, `decided_at`.

Exact-action binding means the approval references the full requested action, not just an identifier, so that a material change invalidates it. Single use is enforced by a unique constraint on the consuming action.

---

## 5. Statuses and enumerations

| Enumeration | Values |
| --- | --- |
| Decision | `ALLOW`, `DENY`, `REQUIRE_APPROVAL` `NEXT`, `ALLOW_WITH_OBLIGATIONS` `NEXT` |
| Action level | `INTERACTION`, `OPERATION`, `BUSINESS_ACTION` |
| Action and outcome status | `SUCCESS`, `FAILED`, `NOT_EXECUTED`, `BLOCKED`, plus `STARTED` for in-flight actions |
| Match status | `MATCHED`, `UNMATCHED`, `NOT_EXECUTED`, `UNKNOWN` |
| Evidence level | `AGENT_DECLARED`, `ENFORCEMENT_OBSERVED`, `TARGET_CONFIRMED` |
| Enforcement-point type | `MCP_GUARD`, `DESKTOP_GUARD`, `BROWSER_GUARD`, `CODE_GUARD`, `GATEWAY` |

Enumerations are stored as `text` with a check constraint rather than as PostgreSQL enum types, so that adding a value is a constraint change rather than a type migration.

---

## 6. Indexes

| Table | Index | Purpose |
| --- | --- | --- |
| All tenant tables | `(workspace_id)` leading on every composite index | Tenancy is the first filter in every query. |
| `authorization_decisions` | `(workspace_id, decided_at desc)` | Recent decisions list. |
| `authorization_decisions` | `(workspace_id, task_id, decided_at)` | Timeline assembly. |
| `authorization_decisions` | `(workspace_id, agent_id, decided_at desc)` | Per-agent review. |
| `authorization_decisions` | `(workspace_id, decision, decided_at desc)` | Denial review. |
| `actions` | `(workspace_id, task_id, started_at)` | Timeline assembly. |
| `actions` | `(workspace_id, decision_id)` | Decision-to-action matching. |
| `actions` | `(workspace_id, match_status)` partial where `match_status <> 'MATCHED'` | Exception review, which is the query that matters. |
| `actions` | unique `(workspace_id, event_key)` | Idempotent ingestion. |
| `execution_outcomes` | `(workspace_id, action_id)` | Outcome lookup. |
| `sessions` | `(workspace_id, agent_id, started_at desc)` | Session review. |
| `tasks` | `(workspace_id, status, started_at desc)` | Task list. |
| `policy_versions` | `(workspace_id, policy_id, version desc)` | Version resolution. |
| `enforcement_point_credentials` | `(key_prefix)` | Credential lookup before hash verification. |
| `agents` | unique `(workspace_id, external_id)` | Stable external identity. |

Partitioning: `authorization_decisions`, `actions`, and `execution_outcomes` are the growth tables. Range partitioning by month on `decided_at`, `started_at`, and `reported_at` is planned at the volume where it becomes necessary, and the schema keeps those columns non-null to keep that option open.

---

## 7. Row Level Security

Every tenant table has RLS enabled. The pattern is uniform:

```sql
alter table public.actions enable row level security;

create policy actions_select on public.actions
  for select
  using (
    workspace_id in (
      select workspace_id
      from public.workspace_members
      where user_id = auth.uid()
    )
  );

create policy actions_insert on public.actions
  for insert
  with check (
    workspace_id in (
      select workspace_id
      from public.workspace_members
      where user_id = auth.uid()
        and role in ('owner', 'admin', 'editor')
    )
  );
```

Rules:

1. RLS is enabled on every tenant table without exception. A new table without an RLS policy and an isolation test fails the build.
2. Frontend filtering is never the isolation mechanism.
3. Machine callers hold no database credential. They authenticate to the Node API, which resolves the workspace from the credential and applies an explicit workspace filter to every query. RLS is the second independent line of defence for user-facing paths.
4. Append-only tables (`authorization_decisions`, `actions`, `execution_outcomes`) grant no update or delete policy to ordinary roles. Administrative deletion runs through a separate, audited service path that exists so that lawful deletion requests can be honoured.
5. `workspaces` is readable only through membership. There is no public listing.

---

## 8. Immutability

| Table | Rule | Mechanism |
| --- | --- | --- |
| `policy_versions` | Immutable after publication | Trigger rejecting update and delete |
| `authorization_decisions` | Append only, snapshots frozen | Trigger plus no update policy |
| `actions` | Status transitions only, through the API | Restricted update path, snapshot fields frozen |
| `execution_outcomes` | Append only | Trigger plus no update policy |

The `request_snapshot` and `resolved_attributes` columns exist so a decision can be re-evaluated later and produce the same result. Simulation and replay depend on this, which is why the columns are populated in the MVP even though the features are `NEXT`.

---

## 9. Data minimization in the schema

| Field | Constraint |
| --- | --- |
| `input_metadata`, `result_metadata` | Safe metadata only. Size limited. Redacted at ingestion. |
| Any credential | Never stored. Only credential hashes exist, and only in credential tables. |
| Prompts and reasoning | No column exists for them. The absence is deliberate and structural. |
| Screenshots | No column exists. Capture is not implemented and would require an explicit opt-in design. |
| `delegated_user_id` | `text`, expected to hold an opaque identifier rather than a name. |

A structural absence is stronger than a policy against writing. There is no column to misuse.

---

## 10. Seed data for the demo

`supabase/seed.sql` creates one workspace with:

- Agent `procurement-agent-01`, type `computer-use`, environment `production`, active.
- Enforcement points `desktop-guard-4711` (type `DESKTOP_GUARD`, channel `desktop`) and `mcp-guard-01` (type `MCP_GUARD`, channel `mcp`).
- Policies:
  1. `desktop-apps-de`, ALLOW `application.launch` where the application is in Excel, Word, or SAP GUI.
  2. `pr-limit-de`, ALLOW `purchase_requisition.create` and `purchase_requisition.submit` where company code is DE01, currency is EUR, and amount is at most 5000.
  3. `supplier-bank-details-deny`, DENY `supplier.bank_details.update` with no conditions.
  4. No catch-all ALLOW. Everything unmatched is denied by the default.

Policy 3 needs no conditions and no priority tuning, because explicit DENY always wins. That is the property being demonstrated.

The demo flow then produces exactly the timeline shown on the landing page: Excel and SAP GUI allowed and started, a EUR 2,500 requisition allowed and confirmed by the target, Outlook denied and blocked with `ENFORCEMENT_OBSERVED` evidence, and a EUR 25,000 request denied and never executed with status `NOT_EXECUTED`.
