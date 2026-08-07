# Security Rulebook

A pure reference: security-design principles, reduced to *what the principle is* and a
one-line description. No app-specific inventory, no record of what any one project already
does about them — that belongs in that project's own posture doc (e.g. `SECURITY.md`) and
changelog. Drop this file into any project; it costs no tokens beyond what it takes to read
the tables.

Three layers, answering different questions:

| | Section | Question it answers |
| --- | --- | --- |
| **§1** | 7 principles of secure design | *At design time* — how do you shape a system so insecurity is the harder path? |
| **§2** | OWASP foundational security principles | *Underneath §1* — the older, broader vocabulary §1 is built from, plus terms §1 doesn't cover. |
| **§3** | Secure SDLC & production practices | *In the pipeline* — how the principles get enforced mechanically, before and at deploy. |

---

## §1 The 7 principles of secure design

| # | Principle | What it demands |
| --- | --- | --- |
| 1 | **Security as code** | Security policy is version-controlled, tested, and enforced in CI/CD — not a manual checklist run once. |
| 2 | **Secure defaults** | The out-of-the-box configuration is the most secure one the system can ship with; opting *out* of safety takes a deliberate act. |
| 3 | **Least privilege** | Grant only the access a task needs, for only as long as it needs it. |
| 4 | **Separation of duties** | No single actor or credential can complete a sensitive action alone — critical steps need independent approval. |
| 5 | **Minimize attack surface area** | Every endpoint, feature, and open port is a liability. Remove what isn't used; don't build what isn't needed. |
| 6 | **Complete mediation** | Re-check authorization on *every* request for a resource — never cache a permission decision as evergreen. |
| 7 | **Fail securely** | On error, default to the safe state (deny, not permit) — a broken check must not become an open door. |

---

## §2 OWASP foundational security principles

The wider vocabulary §1 draws from. Where a term restates §1, it's marked **†** and kept
short — §1 has the fuller treatment.

| # | Principle | What it means |
| --- | --- | --- |
| 1 | **Security by Design** | Security requirements are gathered and designed for up front, not patched on after the fact. |
| 2 | **Security by Default†** | Same as §1.2 — the default configuration is the safest one. |
| 3 | **No Security Guarantee** | No system is 100% secure. The goal is to raise attacker cost and lower reward, not reach an unreachable "done". |
| 4 | **Defense in Depth** | Layer independent controls so one failure doesn't equal total compromise — each layer is a fallback for the last. |
| 5 | **Fail Safe†** | Same as §1.7 — an error state defaults to denying access, not granting it. |
| 6 | **Least Privilege†** | Same as §1.3. |
| 7 | **Compartmentalize** | Split access on a need-to-know basis rather than all-or-nothing — but not so finely the system becomes unmanageable. |
| 8 | **Separation of Duties†** | Same as §1.4. |
| 9 | **Economy of Mechanism** | Prefer the simplest correct implementation — complexity is where vulnerabilities hide and reviews fail. |
| 10 | **Complete Mediation†** | Same as §1.6. |
| 11 | **Open Design** | Security must not depend on the design being secret — only on keys/credentials staying secret. Security through obscurity is not a control. |
| 12 | **Least Common Mechanism** | Don't share a resource or code path across users/processes at different privilege levels — shared mechanisms are escalation paths. |
| 13 | **Psychological Acceptability** | A control that's too much friction gets worked around. Security must be usable enough that people don't defeat it to get their job done. |
| 14 | **Usability and Manageability** | Configuration and administration of a control should be simple and standard — obscure setup is itself a source of misconfiguration. |
| 15 | **Secure the Weakest Link** | System resilience is bounded by its weakest component. Find it and fix it first — it's where an attacker will start too. |
| 16 | **Leveraging Existing Components** | Reuse vetted, patched, widely-reviewed components over rolling your own — "many eyes" and existing patches beat a novel implementation. |

---

## §3 Secure SDLC & production practices

How §1 and §2 get enforced mechanically — the pipeline and runtime habits that turn a
principle into something that actually happens on every change.

| # | Practice | What it demands |
| --- | --- | --- |
| 1 | **Shift-left scanning** | Run SAST (static analysis) in CI on every commit; run DAST (dynamic/runtime attack simulation) against staging before release. Catch what code review misses. |
| 2 | **Dependency hygiene** | Vet and pin third-party packages; scan for known CVEs in the pipeline, not after an incident. |
| 3 | **Secrets management** | Credentials and keys live in a secrets manager, are rotated regularly, and are never in source control or logs. |
| 4 | **Encryption everywhere** | Encrypt sensitive data at rest and in transit by default — not opt-in per feature. |
| 5 | **Rate limiting & throttling** | Bound abuse and cost at the API boundary; degrade gracefully rather than falling over under load or attack. |
| 6 | **Input validation at the boundary** | Fail fast on malformed, oversized, or malicious input before it reaches business logic. |
| 7 | **Structured, PII-safe logging** | Log enough to reconstruct an incident (correlation IDs, timestamps, actor) without ever logging secrets or personal data. |
| 8 | **Audit trails** | Record who did what, when, for every administrative action and every access to sensitive data. |
| 9 | **Phased rollout** | Ship behind canaries or feature flags with real monitoring, so a bad change is caught at 1% of traffic, not 100%. |
| 10 | **Tested rollback** | A rollback path must be exercised before it's needed — an untested rollback is not a real mitigation. |

---

## §4 When principles conflict

| Conflict | Ruling |
| --- | --- |
| Least privilege (§1.3) wants narrow access; usability (§2.13) wants low friction | **Narrow the grant, not the friction.** Make the *right* access effortless; never widen access to avoid a prompt. |
| Defense in depth (§2.4) wants more layers; economy of mechanism (§2.9) wants the simplest design | **Layer at the boundary, simplify behind it.** Add checks where trust changes (edge, auth), not inside every internal call. |
| Complete mediation (§1.6) wants a check on every request; performance wants caching | **Cache the data, not the decision.** Cache what a permission check reads; never cache the yes/no result past the request that asked it. |
| Fail securely (§1.7) wants to deny on error; availability wants the system to stay up | **Deny the request, not the service.** A failed auth check rejects that one action — it must not take the whole system down. |
| Secure defaults (§1.2) want the safest config; open design (§2.11) says don't rely on secrecy | **Not a real conflict — secure defaults are about behavior, not hidden implementation.** Ship the safe default *and* publish how it works. |
| Minimize attack surface (§1.5) wants fewer features; a real user need wants the feature | **Ship it deliberately, not by omission.** Build it, and delete what it replaces — attack surface grows from what's forgotten, not from what's used. |

**Tiebreaker in every case:** favour whichever reading still holds when the system is under
active attack, not just under normal use. A control that only works when nobody is trying to
break it isn't a control.

---

## How to use this document

1. Find the principles a change touches. Check **all three sections** — a change can satisfy
   §1's design-time principles and still violate an SDLC practice in §3 (e.g. a least-privilege
   API with no dependency scanning behind it).
2. This file is pure reference — *what the principles are*, nothing about how any one project
   already satisfies them. Concrete, enforceable rules and current posture for a specific
   codebase belong in that project's own security doc (e.g. `SECURITY.md`); history of what
   changed and why belongs in its changelog. Keep those two out of this file, or every future
   read pays for content the review doesn't need.
3. When a principle conflicts with velocity, convenience, or cost, favour the principle — §4
   gives the ruling for the recurring conflicts; extend the table when a new one repeats.
4. This file is a checklist for *judgment*, not a compliance certificate. Passing every row
   does not mean a system is secure — §2.3 (No Security Guarantee) applies to this document too.
