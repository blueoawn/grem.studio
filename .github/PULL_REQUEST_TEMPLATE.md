Closes #<!-- issue number; keep this as the first line -->

## Summary
<!-- What changed and why, in a few sentences. -->

## Changes
<!-- Files or areas touched, one bullet each. -->
- 

## Acceptance criteria
<!-- Copy each criterion from the issue and name the test or check that proves it. -->
| Criterion | Test / evidence |
| --- | --- |
|  |  |

## Verification
<!-- Commands you ran and their result. Say what you could not run and why. -->
```sh

```

## Deployment and data
<!-- Schema/migration effect, new env vars or secrets, deploy.sh changes. Write "None" if none. -->

## Checklist
- [ ] PR description starts with `Closes #<issue>`
- [ ] One issue, one branch (`feat/<issue>-<slug>`), one PR
- [ ] `cargo fmt --check`, `cargo clippy`, `cargo test --locked` pass (if Rust changed)
- [ ] Docs updated, including `docs/agents.md` if tooling or conventions changed
- [ ] No secrets, destructive data resets, or unrelated changes
