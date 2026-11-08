# Hold stable release of 0.15.0

The source code, mobile UI, and Android Auto integration may merge into `main` as a
**beta**. Do **not** publish a signed stable APK automatically or manually until:

1. Physical Android Auto acceptance on Honor V2 / Android 16 and the car host
   demonstrates actual Yandex Tiles API delivery with the user's key.
2. The logo/attribution is checked against Yandex's official Tiles API assets,
   stays legible within the host safe area, and the required link works.
3. GPS Follow, OSM fallback, Wikimapia contours and the mobile settings UI
   are tested on physical hardware.

CI covers program behavior and build integrity but is not a physical host test.
See issues #42 and #51.

**Unlock:** remove this file after acceptance, bump the version (or manually
dispatch a signed release from `main`) and verify the official signing pipeline.
Normal future releases without this marker remain automatic.
