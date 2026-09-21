# vial-web

## Building

```
git clone https://github.com/vial-kb/vial-web.git
cd vial-web
git clone https://github.com/vial-kb/vial-gui.git
git clone https://github.com/vial-kb/via-keymap-precompiled.git
./fetch-emsdk.sh
./fetch-deps.sh
./build-deps.sh
cd src
./build.sh
```

## Web-native migration

The current build remains the production baseline. The additive migration toward a browser-native client is tracked in [issue #10](https://github.com/xtreemze/vial-web/issues/10) and documented in [docs/WEB_NATIVE_ARCHITECTURE.md](docs/WEB_NATIVE_ARCHITECTURE.md). Early transport/domain boundaries live under [next/](next/).
