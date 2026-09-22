import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useState,
} from "react";

import type {
  RgbProfileEditorController,
  RgbProfileValue,
} from "./device/rgb-profile-editor-controller.ts";

interface RgbProfileEditorProps {
  readonly controller: RgbProfileEditorController;
}

type ProfileField =
  | "mode"
  | "hue"
  | "saturation"
  | "brightness"
  | "speed";

interface RangeFieldProps {
  readonly disabled: boolean;
  readonly label: string;
  readonly maximum: number;
  readonly minimum?: number;
  readonly onChange: (value: number) => void;
  readonly value: number;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "The RGB profile operation failed.";
}

function RangeField({
  disabled,
  label,
  maximum,
  minimum = 0,
  onChange,
  value,
}: RangeFieldProps): ReactNode {
  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    onChange(Number(event.currentTarget.value));
  }

  return (
    <label className="range-field">
      <span className="range-field-heading">
        <span>{label}</span>
        <output>{value}</output>
      </span>
      <input
        type="range"
        min={minimum}
        max={maximum}
        step={1}
        value={value}
        disabled={disabled}
        onChange={handleChange}
      />
    </label>
  );
}

export function RgbProfileEditor({
  controller,
}: RgbProfileEditorProps): ReactNode {
  const [profile, setProfile] = useState<RgbProfileValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMessage(null);

    void controller
      .load()
      .then((value) => {
        if (active) {
          setProfile(value);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setErrorMessage(describeError(error));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return (): void => {
      active = false;
    };
  }, [controller]);

  function updateField(field: ProfileField, value: number): void {
    setProfile((current) => {
      if (current === null) {
        return current;
      }
      return {
        ...current,
        [field]: value,
      };
    });
  }

  async function runOperation(
    operation: "preview" | "cancel-preview" | "apply" | "save",
  ): Promise<void> {
    if (profile === null && operation !== "cancel-preview") {
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      if (operation === "preview" && profile !== null) {
        await controller.preview(profile);
        setStatusMessage("Preview active temporarily.");
      } else if (operation === "cancel-preview") {
        await controller.cancelPreview();
        setStatusMessage("Preview cancelled.");
      } else if (operation === "apply" && profile !== null) {
        await controller.apply(profile);
        setStatusMessage("Profile applied to live keyboard state.");
      } else if (profile !== null) {
        await controller.save(profile);
        setStatusMessage("Profile saved to keyboard.");
      }
    } catch (error: unknown) {
      setErrorMessage(describeError(error));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="editor-card" aria-busy="true">
        <p className="label">Global RGB profile · 0xF0</p>
        <p className="muted">Reading current profile…</p>
      </section>
    );
  }

  if (profile === null) {
    return (
      <section className="editor-card">
        <p className="label">Global RGB profile · 0xF0</p>
        <p className="error-message" role="alert">
          {errorMessage ?? "The current RGB profile could not be read."}
        </p>
      </section>
    );
  }

  const controlsDisabled = busy;

  return (
    <section className="editor-card" aria-labelledby="rgb-profile-title">
      <div className="editor-heading">
        <div>
          <p className="label">Global RGB profile · 0xF0</p>
          <h2 id="rgb-profile-title">Lighting profile</h2>
          <p className="muted">
            Preview is temporary. Apply changes runtime state. Save persists the
            current values to keyboard storage.
          </p>
        </div>
      </div>

      <div className="range-grid">
        <RangeField
          label="Effect mode"
          maximum={controller.capabilities.maximumMode}
          value={profile.mode}
          disabled={controlsDisabled}
          onChange={(value) => updateField("mode", value)}
        />
        <RangeField
          label="Hue"
          maximum={255}
          value={profile.hue}
          disabled={controlsDisabled}
          onChange={(value) => updateField("hue", value)}
        />
        <RangeField
          label="Saturation"
          maximum={255}
          value={profile.saturation}
          disabled={controlsDisabled}
          onChange={(value) => updateField("saturation", value)}
        />
        <RangeField
          label="Brightness"
          maximum={controller.capabilities.maximumBrightness}
          value={profile.brightness}
          disabled={controlsDisabled}
          onChange={(value) => updateField("brightness", value)}
        />
        <RangeField
          label="Speed"
          maximum={255}
          value={profile.speed}
          disabled={controlsDisabled}
          onChange={(value) => updateField("speed", value)}
        />
      </div>

      <div className="editor-actions">
        <button
          type="button"
          disabled={controlsDisabled}
          onClick={() => {
            void runOperation("preview");
          }}
        >
          Preview
        </button>
        <button
          type="button"
          disabled={controlsDisabled}
          onClick={() => {
            void runOperation("cancel-preview");
          }}
        >
          Cancel preview
        </button>
        <button
          type="button"
          disabled={controlsDisabled}
          onClick={() => {
            void runOperation("apply");
          }}
        >
          Apply
        </button>
        <button
          type="button"
          disabled={controlsDisabled}
          onClick={() => {
            void runOperation("save");
          }}
        >
          Save to keyboard
        </button>
      </div>

      <div className="operation-feedback" aria-live="polite">
        {statusMessage === null ? null : <p>{statusMessage}</p>}
        {errorMessage === null ? null : (
          <p className="error-message" role="alert">
            {errorMessage}
          </p>
        )}
      </div>
    </section>
  );
}
