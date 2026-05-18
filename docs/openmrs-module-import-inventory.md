# OpenMRS ESM Module Import Inventory

**Status**: Phase 3 - Module Compatibility Audit  
**Started**: 2025-05-18  
**Last Updated**: 2025-05-18  

## Overview

This document tracks all 40+ OpenMRS ESM modules being evaluated for integration with TherAssistant EHR. Each module is audited for:

- **Source & Distribution**: npm availability, version, size
- **Architecture**: single-spa compatibility, bundler assumptions
- **Dependencies**: version conflicts with TherAssistant
- **Features**: mapping to TherAssistant routes/functionality
- **Integration**: strategy, effort, risks, blockers
- **Recommendation**: import, adapt, defer, or skip

## Priority Tiers

### Tier 0: CRITICAL (Block entire project if unresolved)

| Module | Context | Status | Strategy | Effort |
|--------|---------|--------|----------|--------|
| esm-home-app | Dashboard, appointments, alerts | **PENDING** | TBD | TBD |
| esm-patient-chart-app | Patient chart, encounters, vitals | **PENDING** | TBD | TBD |
| esm-appointments-app | Appointment scheduling | **PENDING** | TBD | TBD |
| esm-patient-search-app | Patient search, lookup | **PENDING** | TBD | TBD |

### Tier 1: HIGH (Key features for core workflows)

| Module | Context | Status | Strategy | Effort |
|--------|---------|--------|----------|--------|
| esm-patient-attachments-app | Document upload, mailroom | **PENDING** | TBD | TBD |
| esm-form-engine-app | Structured data capture | **PENDING** | TBD | TBD |
| esm-patient-notes-app | Clinical notes, documentation | **PENDING** | TBD | TBD |
| esm-active-visits-app | Session, check-in management | **PENDING** | TBD | TBD |

### Tier 2: MEDIUM (Enhance existing features)

| Module | Context | Status | Strategy | Effort |
|--------|---------|--------|----------|--------|
| esm-patient-conditions-app | Diagnoses, conditions | **PENDING** | TBD | TBD |
| esm-patient-medications-app | Medication management | **PENDING** | TBD | TBD |
| esm-patient-allergies-app | Allergies, adverse reactions | **PENDING** | TBD | TBD |
| esm-provider-app | Provider profiles, credentials | **PENDING** | TBD | TBD |
| esm-notification-app | Alerts, notifications | **PENDING** | TBD | TBD |

### Tier 3: LOW (Nice-to-have, defer unless easy)

| Module | Context | Status | Strategy | Effort |
|--------|---------|--------|----------|--------|
| esm-cohort-app | Cohorts, groups | **DEFER** | skip | — |
| esm-ward-app | Ward management | **DEFER** | skip | — |
| esm-bed-management-app | Bed allocation | **DEFER** | skip | — |
| esm-stock-management-app | Inventory, supplies | **DEFER** | skip | — |
| esm-lab-app | Lab orders, results | **DEFER** | skip | — |

## Full Module List

### Phase 3.1: Audit (Current)

Complete the compatibility review for all Tier 0-1 modules:

- [ ] esm-home-app
- [ ] esm-patient-chart-app
- [ ] esm-appointments-app
- [ ] esm-patient-search-app
- [ ] esm-patient-attachments-app
- [ ] esm-form-engine-app
- [ ] esm-patient-notes-app
- [ ] esm-active-visits-app

### Phase 3.2: Audit (Tier 2)

- [ ] esm-patient-conditions-app
- [ ] esm-patient-medications-app
- [ ] esm-patient-allergies-app
- [ ] esm-provider-app
- [ ] esm-notification-app

### Phase 3.3: Decision (Tier 3+)

- [ ] Defer: Ward, Bed, Stock, Lab modules
- [ ] Review: Cohort, reporting, admin modules
- [ ] Plan: Custom integrations for billing/claims

## Audit Template

For each module, complete this audit:

```markdown
## [Module Name]

**GitHub**: [openmrs/openmrs-esm-*]  
**NPM**: [@openmrs/esm-*@latest]  
**Context**: TherAssistant feature/route this affects

### Source & Distribution
- [ ] Available on npm
- [ ] Version: X.Y.Z
- [ ] Package size: XXX KB
- [ ] Last updated: YYYY-MM-DD
- [ ] Maintenance: [active/stale]

### Architecture
- [ ] Single-spa plugin: YES/NO
- [ ] Module federation: YES/NO
- [ ] Webpack plugin: YES/NO
- [ ] Execution model: single-spa | standalone | iframe

### Dependencies
- React: X.Y.Z (TherAssistant: A.B.C) ✓/✗ CONFLICT
- react-router-dom: X.Y.Z (TherAssistant: A.B.C) ✓/✗ CONFLICT
- [More dependencies...]

### Features
- Feature A → Maps to /route-a
- Feature B → Maps to /route-b
- [More features...]

### Integration Assessment
**Strategy**: direct-import | adapter | api-bridge | defer
**Effort**: low | medium | high | very-high
**Blockers**:
- [List any show-stoppers]

**Risks**:
- [List potential issues]

### Recommendation
**Status**: approved | risk-identified | needs-investigation
**Decision**: IMPORT | ADAPT | API_BRIDGE | DEFER
**Reasoning**: [Justify decision]
**Next Steps**: [If approved, what's next?]

### Full Audit Notes
[Detailed findings, GitHub issues, etc.]
```

## Summary by Strategy

### Direct Import (Ready-to-use from npm)
- Install → Use as-is
- Best for: Isolated features, no conflicts
- Effort: Low

### Adapter (Light customization)
- Create adapter wrapper
- Map OpenMRS data/events to TherAssistant
- Replace some components
- Effort: Medium

### API Bridge (Integration layer)
- Wrap module in iframe or web worker
- Call via REST API
- Heavy transformation
- Effort: High

### Defer (Not needed yet)
- Document decision
- Revisit in Phase X
- Effort: Zero now

## Decision Log

### [2025-05-18]

**Phase 3 Audit Begun**
- Created audit framework (audit-types.ts)
- Planned high-priority module evaluation
- Deferred Tier 3 modules (ward, bed, stock, lab)
- Ready to begin individual module audits

## Next Steps

1. **Audit esm-home-app** - Home dashboard, appointment surface
2. **Audit esm-patient-chart-app** - Patient chart/EHR room
3. **Audit esm-appointments-app** - Calendar/scheduling
4. **Audit esm-patient-search-app** - Client roster/search
5. Compile findings → Phase 3.2 decisions
6. **Phase 4**: Import approved modules
7. **Phase 5**: Replace TherAssistant UI with OpenMRS-adapted components

---

**Contributors**: Copilot Agent  
**Last Review**: 2025-05-18  
**Next Review**: 2025-05-25 (Expected)
