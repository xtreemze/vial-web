# Native web client

This directory contains the browser-native Vial migration tracked by issue #10.

The current Qt/Python/Emscripten application remains the production GitHub Pages deployment. This client is additive until the parity and physical-keyboard acceptance gates are complete.

## Toolchain

- React 19.3
- strict TypeScript 7
- Vite 8
- React Aria Components
- Tailwind CSS 4
- Biome
- Vitest + Testing Library
- Playwright
- pnpm on Node.js 24

Versions are pinned in `package.json` and `pnpm-lock.yaml`.

## Local development

From this directory:

```sh
corepack enable
corepack prepare pnpm@12.5.1 --activate
pnpm install --frozen-lockfile
pnpm dev
```

Quality gates:

```sh
pnpm check
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm e2e
```

## Browser support

The shell targets current evergreen browsers for rendering and interaction. Physical keyboard access will use WebHID and therefore requires a browser that exposes the WebHID API; unsupported browsers must receive an explicit capability state rather than a generic connection error.

The desktop application will not depend on browser WebHID. It will reuse the shared UI/domain/protocol layers through a native Tauri/Rust HID adapter.

## Architecture constraints

1. Keep the transport API independent from WebHID-specific objects.
2. Keep packet encoding/decoding out of React components.
3. Consume the firmware protocol contract maintained in `xtreemze/qmk_userspace`.
4. Keep connection/permission/reconnect as an explicit device lifecycle.
5. Use capability probing rather than firmware-name checks.
6. Keep this application independently deployable as static output.
7. Do not replace the production Pages artifact until the migration parity matrix and physical keyboard acceptance are complete.

See [the architecture note](../docs/WEB_NATIVE_ARCHITECTURE.md).
