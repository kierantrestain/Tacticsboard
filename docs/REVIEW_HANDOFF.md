# Studio 6 review checkpoint

App 6.0.1 / control protocol 4. Review branch: `codex/bang-on-football-studio-v6-review`. The Hub's `BUILD-INFO.json` records the exact packaged source commit. The original v5.2 checkpoint remains an ancestor; the continuation preserves the A–C commits through remote-main base `2f5dd2bfdb2398ba8e7730f8d0c380fa698cdb29`.

Read [the operator guide](OPERATOR_V6.md), [the requirements status](PRODUCTION_PLAN.md) and [the actual evidence](PRODUCTION_EVIDENCE.md). The package is for controlled review/rehearsal. Review the unresolved download, encoder, host-control, duration and physical-studio checks before recording.

## Recover the unpublished source

The accompanying `Bang_On_Football_Studio_v6_Review.bundle` contains the unpublished review-branch commits after the base above. It needs an existing clone containing that base. It does not include private footage, browser projects, dependencies or temporary pairing credentials.

In that clone, use the actual absolute path of the supplied bundle:

```bash
git bundle verify /absolute/path/Bang_On_Football_Studio_v6_Review.bundle
git fetch /absolute/path/Bang_On_Football_Studio_v6_Review.bundle codex/bang-on-football-studio-v6-review
git switch -c review/bang-on-football-studio-v6 FETCH_HEAD
npm ci
npm test
npm run build
npm run studio
```

Use an unused local branch name if that example already exists. The runnable Hub ZIP needs Node.js 22+ and no dependency installation; follow `READ-ME.txt` inside it.

## Review publication status

No push completed, no PR was created and no deployment was made. Automatic approval review rejected both the attempted main push and subsequent isolated review-branch push to `kierantrestain/Tacticsboard`, describing the external repository destination/publication as insufficiently authorised. The review branch also disables Git-triggered deployment; main's existing false guard is preserved. Do not use a different transport to bypass those rejections.

Renewed protocol-4 host-control enabling was separately rejected as an access grant. The two temporary agent-created preview host tabs were last observed connected with controls disabled; recheck those exact sessions before enabling them. The fast-filter merge repair passes regression tests; its post-repair shared-control browser retest and the full two-host rehearsal still need explicit authorisation for those test tabs. Physical tablet/capture checks additionally need the studio equipment.

## Prepared draft PR

Title: **Complete Bang On Football Studio 6 event analysis and episode recovery**

Prepared episodes can now retain source-backed event maps, independent-cohort radars and full five-way comparisons alongside footage and tactical explanations. The existing episode/resource stores, comparison engine and host protocol carry frozen source/cohort snapshots, private notes, analyst clock alignment and explicit source corrections. Complete backups use checked bounded volumes for large media and resources.

The review includes a CC BY 4.0 historical PL 2017/18 archive, clear missing/partial data, real event identities and orientation, unlimited selected statistics, held clean output and protocol-4 ownership/context fences. Final validation and remaining acceptance limits are recorded in the production evidence. Production deployment and changes to the intended audience are outside this review.
