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


## Workspace scaffold

The initial web-native workspace uses React 19.3, strict TypeScript 7, Vite 8.1, React Aria Components, Tailwind CSS 4.3, Vitest 5, Playwright, and Biome.

Local commands:

```sh
cd next
pnpm install
pnpm typecheck
pnpm check
pnpm test
pnpm build
pnpm test:e2e
```

The connect control is intentionally disabled in this scaffold. Issue #13 owns WebHID implementation and device lifecycle integration.

The current CI installs the exact package versions declared in `package.json` without a committed lockfile so the scaffold can validate in GitHub Actions. A generated `pnpm-lock.yaml` must be committed before #12 is considered complete; once present, CI must switch to `pnpm install --frozen-lockfile`.
