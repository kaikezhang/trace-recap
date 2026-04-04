## [ERR-20260404-001] gh-pr-merge-base-branch-modified

**Logged**: 2026-04-04T22:24:30Z
**Priority**: medium
**Status**: pending
**Area**: infra

### Summary
Sequential `gh pr merge` calls can fail with `Base branch was modified` after a previous PR lands.

### Error
```
GraphQL: Base branch was modified. Review and try the merge again. (mergePullRequest)
```

### Context
- Command attempted: `gh pr merge 154 --squash --delete-branch` and `gh pr merge 156 --squash --delete-branch`
- Another PR merge in the same batch updated the base branch first
- Repo: trace-recap

### Suggested Fix
After one PR merges, re-run merge-ready checks and retry remaining PRs individually instead of parallel merging.

### Metadata
- Reproducible: yes
- Related Files: .none

---

## [ERR-20260404-002] gh-pr-merge-delete-branch-worktree

**Logged**: 2026-04-04T22:24:30Z
**Priority**: low
**Status**: pending
**Area**: infra

### Summary
`gh pr merge --delete-branch` may merge successfully but fail afterward if the local branch is attached to a worktree.

### Error
```
failed to delete local branch feat/static-map-preview: failed to run git: error: cannot delete branch 'feat/static-map-preview' used by worktree at '/tmp/tr-static-map'
```

### Context
- Command attempted: `gh pr merge 155 --squash --delete-branch`
- PR merged, but post-merge local branch cleanup failed because the branch was checked out in a worktree
- Repo: trace-recap

### Suggested Fix
Use `gh pr merge --delete-branch` only after confirming no local worktree owns the branch, or merge first and clean up worktrees separately.

### Metadata
- Reproducible: yes
- Related Files: .none

---
