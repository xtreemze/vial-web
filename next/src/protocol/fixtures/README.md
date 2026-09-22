# Configurator protocol golden-vector provenance

`configurator-protocol-v1-vectors.json` is mirrored **unchanged** from:

- repository: `xtreemze/qmk_userspace`
- path: `docs/configurator-protocol-v1-vectors.json`
- source merge commit: `623c0e528813ef9f8a0a5f8287638744e612707b`
- source PR: `xtreemze/qmk_userspace#79`

The firmware repository owns this contract. Do not edit packet values locally to make a client test pass.

To refresh the fixture:

1. update the firmware contract/vectors first and merge them with firmware CI green;
2. copy the JSON file byte-for-byte into this directory;
3. update the source commit above;
4. update codecs if the versioned protocol intentionally changed;
5. run strict lint, TypeScript, Vitest, and the production build.

Normal tests use the checked-in mirror and do not fetch mutable network content.
