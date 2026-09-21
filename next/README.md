# Native web client foundation

This directory is reserved for the browser-native Vial client tracked by issue #10.

The initial files define transport and device-lifecycle boundaries only. They deliberately do not alter the existing Qt/Python/Emscripten build or GitHub Pages deployment.

Before adding framework/build dependencies here:

1. keep the transport API independent from WebHID-specific objects;
2. keep packet encoding/decoding out of React components;
3. consume the firmware protocol contract from `xtreemze/qmk_userspace#74`;
4. add tests with the first protocol implementation rather than growing unverified adapters;
5. keep this directory independently removable until the new path demonstrates parity.

See [the architecture note](../docs/WEB_NATIVE_ARCHITECTURE.md).
