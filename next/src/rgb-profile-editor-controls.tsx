import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
} from "react";

import type { RgbProfileEditorController } from "./device/rgb-profile-editor-controller.ts";
import type {
  ProfileField,
  RgbProfileEditorState,
} from "./rgb-profile-editor-state.ts";

interface ProfileRangeFieldProps {
  readonly disabled: boolean;
  readonly field: ProfileField;
  readonly label: string;
  readonly maximum: number;
  readonly onChange: RgbProfileEditorState["onChange"];
  readonly value: number;
}

interface ProfileControlsProps {
  readonly controller: RgbProfileEditorController;
  readonly state: RgbProfileEditorState;
}

function ProfileRangeField(props: ProfileRangeFieldProps): ReactNode {
  const handleChange: (event: ChangeEvent<HTMLInputElement>) => void =
    useCallback(
      function receiveRangeChange(event: ChangeEvent<HTMLInputElement>): void {
        props.onChange(props.field, Number(event.currentTarget.value));
      },
      [props.field, props.onChange],
    );

  return (
    <label className="range-field">
      <span className="range-field-heading">
        <span>{props.label}</span>
        <output>{props.value}</output>
      </span>
      <input
        type="range"
        min={0}
        max={props.maximum}
        step={1}
        value={props.value}
        disabled={props.disabled}
        onChange={handleChange}
      />
    </label>
  );
}

function ProfileControls(props: ProfileControlsProps): ReactNode {
  return (
    <div className="range-grid">
      <ProfileRangeField
        field="mode"
        label="Effect mode"
        maximum={props.controller.capabilities.maximumMode}
        value={props.state.profile.mode}
        disabled={props.state.busy}
        onChange={props.state.onChange}
      />
      <ProfileRangeField
        field="hue"
        label="Hue"
        maximum={255}
        value={props.state.profile.hue}
        disabled={props.state.busy}
        onChange={props.state.onChange}
      />
      <ProfileRangeField
        field="saturation"
        label="Saturation"
        maximum={255}
        value={props.state.profile.saturation}
        disabled={props.state.busy}
        onChange={props.state.onChange}
      />
      <ProfileRangeField
        field="brightness"
        label="Brightness"
        maximum={props.controller.capabilities.maximumBrightness}
        value={props.state.profile.brightness}
        disabled={props.state.busy}
        onChange={props.state.onChange}
      />
      <ProfileRangeField
        field="speed"
        label="Speed"
        maximum={255}
        value={props.state.profile.speed}
        disabled={props.state.busy}
        onChange={props.state.onChange}
      />
    </div>
  );
}

export { ProfileControls };
