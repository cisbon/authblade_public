# AuthBlade

**Control what AI agents can do before they do it.**

Authorize every consequential action. Observe what actually happened.

AuthBlade is a cross-channel runtime authority and observability platform. It evaluates proposed AI agent actions against deterministic policies, enforces decisions through trusted enforcement points, and records the chain from assigned task and authorization decision to actual execution and business outcome.

For developers: add deterministic authorization and action tracing to AI agents across MCP, APIs, browsers, and desktop environments.

---

## What this repository contains

Two deliverables:

1. **A static landing page** for authblade.com. Plain HTML, CSS, and minimal vanilla JavaScript. No build step, no framework, no server, no database.
2. **An implementation concept** describing how to build the platform with Node.js, React, Electron, and Supabase.

The platform itself is **not** implemented here. This repository is the public landing page plus the architecture documentation a development team needs to start building.

---

## Operating principle

```
The agent proposes.
AuthBlade decides.
A trusted enforcement point enforces.
The target system executes.
AuthBlade records the outcome.
```

AuthBlade is the Policy Decision Point. MCP Guard, Desktop Guard, Browser Guard, Code Guard, gateways, and brokers are Policy Enforcement Points. AuthBlade is preventive only where the agent cannot bypass the enforcement point.

---

## File structure

```
/
  index.html                        Landing page
  styles.css                        All styling
  script.js                         Mobile navigation and footer year
  favicon.svg                       Inline SVG icon
  .nojekyll                         Serves files GitHub Pages would otherwise skip
  README.md                         This file
  docs/
    implementation-concept.md       Full implementation concept, 29 sections
    architecture.md                 Components, flows, trust boundaries
    security-model.md               Threats, credentials, fail-closed, Electron, isolation
    data-model.md                   Entities, relationships, indexes, RLS, correlation
    roadmap.md                      Phases from landing page to enterprise deployment
```

There is no `assets/` directory. All visuals are CSS and inline SVG, and the fonts are system fonts.

---

## Viewing the page locally

No build step and no dependencies.

**Option 1, open the file directly:**

```bash
git clone https://github.com/cisbon/authblade_public.git
cd authblade_public
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows
```

**Option 2, serve it over HTTP** (closer to how GitHub Pages serves it):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Both work. Every path in the page is relative, so the page functions from the filesystem, from a domain root, and from a repository subdirectory.

---

## Deploying to GitHub Pages

1. Push this repository to GitHub.
2. Open **Settings** then **Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose the branch (`main`) and the folder `/ (root)`.
5. Save.

The site publishes at `https://<owner>.github.io/<repository>/`. Because every asset path is relative, no `base` configuration is needed and the page also works when served from a custom domain root such as `https://authblade.com/`.

For a custom domain, add a `CNAME` file containing the domain and configure DNS as GitHub Pages instructs.

The `.nojekyll` file is present so GitHub Pages serves all files as they are, rather than running them through Jekyll.

---

## Documentation

| Document | Contents |
| --- | --- |
| [docs/implementation-concept.md](docs/implementation-concept.md) | Executive summary, non-goals, customers, agent taxonomy, Control and Observe and Assure, trust and threat models, canonical action model, identity, authorization architecture, observability architecture, correlation and evidence, MCP Guard, Desktop Guard and secure Electron, Browser and Code Guard, Supabase and RLS, APIs and policy model, failure behaviour, privacy, deployment, monorepo, testing, development setup, MVP phases, approval architecture, semantic adapters, simulation and replay, packaging, risks, next step. |
| [docs/architecture.md](docs/architecture.md) | Component map, trust zones, control plane layers, authorization flow, enforcement components, action levels, correlation, technology architecture, extension interfaces, failure architecture, a cross-channel worked example. |
| [docs/security-model.md](docs/security-model.md) | Security objectives, trust zones, a sixteen-entry threat model, what the design does not defend against, credential handling, determinism, fail-closed behaviour, local decision safety, Electron hardening, MCP and desktop limitations, tenant isolation, privacy and data minimization. |
| [docs/data-model.md](docs/data-model.md) | Correlation spine, twenty entities with fields, relationships, enumerations, indexes, RLS patterns, immutability rules, schema-level data minimization, demo seed data. |
| [docs/roadmap.md](docs/roadmap.md) | Phase 0 through Phase 10, Desktop Guard scope, sequencing rationale, and the immediate next step. |

---

## Product components

| Component | Role | Status |
| --- | --- | --- |
| Control Plane | Policy Decision Point. Registries, attributes, policies, decisions, tasks, actions, outcomes, evidence. | Specified, MVP scope defined |
| MCP Guard | Enforcement for structured MCP and API actions. Credentials stay in the trusted server. | Specified, MVP scope defined |
| Desktop Guard | Defined product component. Enforcement for computer-use agents on Windows, Citrix, virtual desktops, and Cloud PCs. Initial technical implementation is limited to device and session registration, process and application identification, application allow and deny, event logging, and timeline integration. | Defined component, initial implementation scoped |
| Browser Guard | Domains, uploads, downloads, form submissions, sensitive fields, confirmation actions. | Documented extension, next phase |
| Code Guard | Repositories, commands, packages, pull requests, secrets, deployment targets. | Documented extension, next phase |

---

## Technology for the platform

| Layer | Technology |
| --- | --- |
| Database and auth | Supabase PostgreSQL, Supabase Auth, Row Level Security, SQL migrations |
| Backend | Node.js, TypeScript, a Node HTTP framework, Zod validation |
| Policy engine | A pure TypeScript package with no input or output dependencies |
| Web frontend | React, TypeScript, Vite, Tailwind CSS |
| Desktop Guard | Electron with a React renderer and a TypeScript main process, plus a native Windows helper for privileged functions |
| MCP Guard | Node.js and TypeScript |
| Landing page | HTML, CSS, vanilla JavaScript, no build step |

---

## Limitations

Stated plainly, because overclaiming is itself a risk in a security product.

- **The platform is not implemented in this repository.** Only the landing page and the documentation exist here.
- **AuthBlade is preventive only where the agent cannot bypass the enforcement point.** Where it can, AuthBlade records rather than prevents. This is a deployment property and must be assessed per channel.
- **Desktop Guard complements operating system security, it does not replace it.** Windows App Control, AppLocker, account separation, Citrix policies, VM isolation, endpoint management, network restrictions, mailbox entitlements, and Microsoft Graph permissions remain necessary. AuthBlade alone does not prevent every Windows action without supporting operating system and environment controls.
- **Electron alone is not the security boundary.** An ordinary Electron renderer cannot block a Windows process. Desktop Guard's boundary is the combination of the Electron main process, a native Windows helper running under a separate account, and operating system controls.
- **Evidence is audit-ready, not tamper-proof.** Cryptographic evidence chains are a later roadmap phase, and no stronger claim is made until they exist.
- **Human approval, risk evaluation, semantic matching, simulation, replay, Browser Guard, and Code Guard are designed, not built.** Extension points exist. Behaviour does not.
- **No certification or legal compliance is claimed** anywhere on the landing page or in this documentation.
- **The page contains no customers, testimonials, statistics, logos, or social proof.** Every example is labelled as illustrative, and every planned capability is labelled as planned.
- **Terms, privacy, and contact are placeholders.** The footer links to a placeholder section rather than to fabricated legal pages.

---

## Recommended next step

Build Phase 1 together with the vertical slice of Phase 2 from [docs/roadmap.md](docs/roadmap.md), because tenant isolation and decision determinism are only credible when demonstrated end to end.

The first sprint should produce:

1. The Supabase schema for the minimum MVP table set, with Row Level Security on every tenant table and a passing tenant isolation suite.
2. The `authorization-engine` package with the nine MVP operators, effect combination, and default DENY, validated against a golden decision corpus.
3. `POST /api/v1/authorize` with enforcement-point authentication, validation, immutable decision snapshots, and fail-closed behaviour on every error path.
4. A minimal React view listing decisions with reason code, matching policy version, and latency.

**Exit criterion:** a developer with a fresh workspace registers an agent and an enforcement point, publishes the demo policy set, and receives a correct ALLOW at EUR 2,500 and a correct DENY at EUR 25,000, with both decisions explainable in the user interface, and with the isolation and fail-closed suites green.

---

## License and contact

No license is declared yet. Add one before external contributions are accepted.

For contact, open an issue in this repository. A published contact address will accompany the public site.
