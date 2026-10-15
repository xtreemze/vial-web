# Unified Halcyon palette

Connect from the browser-native client in `next/`. The RGB and screen palette
card generates all advertised RGB scopes and corresponding TFT accents.
Generation does not write the device. Assigned RGB overrides are preserved by
default; select “Replace existing assigned profiles” to include them. Copy the
portable JSON to export. To preserve exceptions, remove their entries from the
JSON and validate the import before previewing.

Preview applies runtime values serially, verifies readback, and attempts every
rollback target on failure. Cancel stops subsequent writes and rolls back.
Restore reverses a successful preview. Save verifies again, then saves RGB and
TFT sequentially. A failure after the first save can leave mixed durable state;
restoring runtime values does not undo that first durable save. Reapply the
previous document and explicitly save to repair durable state.

The firmware retains precedence: combo, Ctrl, GUI, Shift, Alt, layer, global.
Combined TFT modifier indicators reuse the winning RGB modifier hue; Caps Word
uses the Shift hue. This is generation policy, not a second runtime resolver.
RGB unassigned slots receive an effect when explicitly included. Existing
assigned effect and speed, and TFT backgrounds, remain intact.

Layer TFT foregrounds retain generated hue and adjust saturation/value toward
estimated sRGB contrast of 4.5:1 against the read background. This is not physical
LED/display gamma calibration. Modifier contrast and RGB565 quantization need
visual review. Protocol v1 has no TFT combo foreground slot, so combos receive
RGB profiles only. 0xF2 labels/patterns remain independent.

Import validates version, precedence version, scope/field support, counts,
duplicates, bytes, effect limits and brightness before writes. Ports are scoped
to a single connection. Reconnect requires a new preview and readback.

The same v1 JSON imports in Vial GUI's RGB profile editor. No generator or
runtime resolver is duplicated there. Neither a local save acknowledgement nor
readback proves durability on the other master half: RGB 0xF0 v1 has no split
replication acknowledgement. Keep #40 and firmware #101 open until this and the
physical acceptance matrix are satisfied.
