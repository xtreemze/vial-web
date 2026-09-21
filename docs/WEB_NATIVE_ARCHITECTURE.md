# Web-native migration architecture

This document defines the migration boundary tracked by issue #10. It is intentionally additive: the current Qt/Python/Emscripten application remains the production baseline until the new client reaches measured parity.

## Goals

The next-generation browser client should:

- use a browser-native React + strict TypeScript + Vite application;
- keep UI rendering, keyboard domain logic, protocol codecs, and HID transport separate;
- use WebHID only in the browser transport layer;
- preserve standard Vial behavior and xtreemze protocol compatibility;
- remain deployable as static GitHub Pages output;
- support keyboard, pointer, and touch interaction with explicit accessibility tests.

## Package boundaries

The intended dependency direction is:

```text
UI/components
     |
domain/device lifecycle
     |
protocol codecs
     |
transport interface
     |
WebHID adapter
```

The desktop client should reuse every layer above the final adapter and substitute a native Tauri/Rust HID transport.

## Device lifecycle

Connection state is modeled explicitly. UI components should not infer device state from unrelated booleans.

Required states:

- disconnected
- requesting permission
- opening
- connected
- reconnecting
- error

Disconnect and reconnect events must carry enough identity to decide whether to resume the prior device or return to device selection.

## Protocol compatibility

The new client must not derive custom behavior from keyboard names or repository revisions. Capability probing is authoritative.

Current xtreemze namespaces:

- `0xF0`: RGB profiles v1
- `0xF1`: Halcyon settings/telemetry v1
- `0xF2`: reserved for the TFT configuration protocol being developed with `xtreemze/qmk_userspace#68`

The firmware-side compatibility contract is tracked by `xtreemze/qmk_userspace#73` and PR `xtreemze/qmk_userspace#74`.

## Migration order

1. Establish transport and lifecycle contracts.
2. Implement WebHID discovery/open/close/transact/disconnect.
3. Port device probing and read-only identity/capability surfaces.
4. Port import/export and protocol codecs with golden vectors.
5. Port standard editors incrementally.
6. Port xtreemze Halcyon controls.
7. Add responsive, accessibility, reconnect, and mocked-device E2E coverage.
8. Maintain a parity matrix against the current Qt/Python client.
9. Replace the production Pages artifact only after the matrix is complete and physical keyboard acceptance is recorded.

## Non-goals for the foundation PR

- replacing the current Pages deployment;
- changing firmware payloads or EEPROM schemas;
- duplicating the Python UI feature-for-feature immediately;
- introducing a second bespoke protocol for the new frontend.
