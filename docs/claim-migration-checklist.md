# Claim Migration Checklist

## Canonical target
professional_claims is the canonical claim table.

## Legacy table
claims is legacy and should receive no new feature work.

## Remaining legacy references
See docs/audits/legacy-claims-references.txt

## Migration phases
- [ ] Add compatibility columns
- [ ] Add canonical views
- [ ] Convert scripts/tests
- [ ] Convert workflow code
- [ ] Convert claim creation API
- [ ] Convert payments
- [ ] Convert clearinghouse
- [ ] Deprecate legacy claims writes
- [ ] Rename professional_claims to claims only after all references are migrated
