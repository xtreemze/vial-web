# Native web client

This directory contains the browser-native Vial client tracked by issue #10.

The client is intentionally isolated from the existing Qt/Python/Emscripten production build. The current production deployment remains authoritative until the native client reaches documented parity and hardware acceptance.

## Toolchain

- React 19.3
- strict TypeScript 7
- Vite 8
- Tailwind CSS 4.3
- Vitest 5 + Testing Library
- pnpm workspace tooling
- React Aria Components selected as the accessible primitive layer; direct imports are temporarily blocked by #20 while its current declarations fail strict TypeScript 7 library checks

## Commands

From the repository root:

```sh
corepack enable
corepack prepare pnpm@12.5.1 --activate
pnpm install --frozen-lockfile
pnpm --dir next typecheck
pnpm --dir next test
pnpm --dir next build
pnpm --dir next dev
```

The production build is written to `next/dist/` and uses relative asset URLs so it can be hosted from a static subpath.

## Architecture rules

1. Keep the transport API independent from WebHID-specific objects.
2. Keep packet encoding/decoding out of React components.
3. Consume the firmware protocol contract hardened by `xtreemze/qmk_userspace#73/#74`.
4. Capability probing is authoritative; do not infer firmware support from product names.
5. Keep device lifecycle states explicit.
6. Do not weaken TypeScript with `skipLibCheck` or broad `any` escape hatches to accommodate third-party declarations.
7. Tests that use mocked HID state do not count as physical keyboard acceptance.

## Browser support

The current hardware-independent shell can render in modern evergreen browsers.

The upcoming WebHID transport in #13 requires a browser implementation that exposes WebHID. Unsupported browsers must receive an explicit capability state rather than a generic connection error. Browser support and physical-device acceptance will be documented when that transport lands.

See [the architecture note](../docs/WEB_NATIVE_ARCHITECTURE.md).
