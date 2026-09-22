import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
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

interface ProfileRangeFieldProps {
  readonly disabled: boolean;
  readonly field: ProfileField;
  readonly label: string;
  readonly maximum: number;
  readonly onChange: (field: ProfileField, value: number) => void;
  readonly value: number;
}

interface OperationFeedbackProps {
  readonly errorMessage: string | null;
  readonly statusMessage: string | null;
}

interface EditorActionsProps {
  readonly busy: boolean;
  readonly onApply: () => Promise<void>;
  readonly onCancelPreview: () => Promise<void>;
  readonly onPreview: () => Promise<void>;
  readonly onSave: () => Promise<void>;
}

interface ProfileControlsProps {
  readonly busy: boolean;
  readonly controller: RgbProfileEditorController;
  readonly onChange: (field: ProfileField, value: number) => void;
  readonly profile: RgbProfileValue;
}

interface EditorViewProps extends ProfileControlsProps, EditorActionsProps {
  readonly errorMessage: string | null;
  readonly statusMessage: string | null;
}

interface LoadedEditorProps {
  readonly controller: RgbProfileEditorController;
  readonly initialProfile: RgbProfileValue;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "The RGB profile operation failed.";
}

function ProfileRangeField(props: ProfileRangeFieldProps): ReactNode {
  const handleChange: (event: ChangeEvent<HTMLInputElement>) => void =
    useCallback(
      function handleChange(event: ChangeEvent<HTMLInputElement>): void {
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

function OperationFeedback(props: OperationFeedbackProps): ReactNode {
  if (props.statusMessage !== null && props.errorMessage !== null) {
    return (
      <div className="operation-feedback" aria-live="polite">
        <p>{props.statusMessage}</p>
        <p className="error-message" role="alert">
          {props.errorMessage}
        </p>
      </div>
    );
  }
  if (props.errorMessage !== null) {
    return (
      <div className="operation-feedback" aria-live="polite">
        <p className="error-message" role="alert">
          {props.errorMessage}
        </p>
      </div>
    );
  }
  if (props.statusMessage !== null) {
    return (
      <div className="operation-feedback" aria-live="polite">
        <p>{props.statusMessage}</p>
      </div>
    );
  }
  return <div className="operation-feedback" aria-live="polite" />;
}

function EditorActions(props: EditorActionsProps): ReactNode {
  return (
    <div className="editor-actions">
      <button type="button" disabled={props.busy} onClick={props.onPreview}>
        Preview
      </button>
      <button
        type="button"
        disabled={props.busy}
        onClick={props.onCancelPreview}
      >
        Cancel preview
      </button>
      <button type="button" disabled={props.busy} onClick={props.onApply}>
        Apply
      </button>
      <button type="button" disabled={props.busy} onClick={props.onSave}>
        Save to keyboard
      </button>
    </div>
  );
}

function ProfileControls(props: ProfileControlsProps): ReactNode {
  return (
    <div className="range-grid">
      <ProfileRangeField
        field="mode"
        label="Effect mode"
        maximum={props.controller.capabilities.maximumMode}
        value={props.profile.mode}
        disabled={props.busy}
        onChange={props.onChange}
      />
      <ProfileRangeField
        field="hue"
        label="Hue"
        maximum={255}
        value={props.profile.hue}
        disabled={props.busy}
        onChange={props.onChange}
      />
      <ProfileRangeField
        field="saturation"
        label="Saturation"
        maximum={255}
        value={props.profile.saturation}
        disabled={props.busy}
        onChange={props.onChange}
      />
      <ProfileRangeField
        field="brightness"
        label="Brightness"
        maximum={props.controller.capabilities.maximumBrightness}
        value={props.profile.brightness}
        disabled={props.busy}
        onChange={props.onChange}
      />
      <ProfileRangeField
        field="speed"
        label="Speed"
        maximum={255}
        value={props.profile.speed}
        disabled={props.busy}
        onChange={props.onChange}
      />
    </div>
  );
}

function EditorView(props: EditorViewProps): ReactNode {
  const titleId = useId();

  return (
    <section className="editor-card" aria-labelledby={titleId}>
      <div className="editor-heading">
        <div>
          <p className="label">Global RGB profile · 0xF0</p>
          <h2 id={titleId}>Lighting profile</h2>
          <p className="muted">
            Preview is temporary. Apply changes runtime state. Save persists the
            current values to keyboard storage.
          </p>
        </div>
      </div>
      <ProfileControls
        busy={props.busy}
        controller={props.controller}
        profile={props.profile}
        onChange={props.onChange}
      />
      <EditorActions
        busy={props.busy}
        onPreview={props.onPreview}
        onCancelPreview={props.onCancelPreview}
        onApply={props.onApply}
        onSave={props.onSave}
      />
      <OperationFeedback
        statusMessage={props.statusMessage}
        errorMessage={props.errorMessage}
      />
    </section>
  );
}

function LoadedRgbProfileEditor(props: LoadedEditorProps): ReactNode {
  const [profile, setProfile] = useState<RgbProfileValue>(props.initialProfile);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const execute: (
    operation: Promise<void>,
    success: string,
  ) => Promise<void> = useCallback(
    async function execute(
      operation: Promise<void>,
      success: string,
    ): Promise<void> {
      setBusy(true);
      setStatusMessage(null);
      setErrorMessage(null);
      try {
        await operation;
        setStatusMessage(success);
      } catch (error: unknown) {
        setErrorMessage(describeError(error));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const handleChange: (field: ProfileField, value: number) => void =
    useCallback(
      function handleChange(field: ProfileField, value: number): void {
        setProfile({ ...profile, [field]: value });
      },
      [profile],
    );

  const handlePreview: () => Promise<void> = useCallback(
    async function handlePreview(): Promise<void> {
      await execute(
        props.controller.preview(profile),
        "Preview active temporarily.",
      );
    },
    [execute, profile, props.controller],
  );

  const handleCancelPreview: () => Promise<void> = useCallback(
    async function handleCancelPreview(): Promise<void> {
      await execute(props.controller.cancelPreview(), "Preview cancelled.");
    },
    [execute, props.controller],
  );

  const handleApply: () => Promise<void> = useCallback(
    async function handleApply(): Promise<void> {
      await execute(
        props.controller.apply(profile),
        "Profile applied to live keyboard state.",
      );
    },
    [execute, profile, props.controller],
  );

  const handleSave: () => Promise<void> = useCallback(
    async function handleSave(): Promise<void> {
      await execute(
        props.controller.save(profile),
        "Profile saved to keyboard.",
      );
    },
    [execute, profile, props.controller],
  );

  return (
    <EditorView
      busy={busy}
      controller={props.controller}
      profile={profile}
      statusMessage={statusMessage}
      errorMessage={errorMessage}
      onChange={handleChange}
      onPreview={handlePreview}
      onCancelPreview={handleCancelPreview}
      onApply={handleApply}
      onSave={handleSave}
    />
  );
}

export function RgbProfileEditor(props: RgbProfileEditorProps): ReactNode {
  const [profile, setProfile] = useState<RgbProfileValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(function loadProfileEffect(): () => void {
    let active = true;

    function handleLoaded(value: RgbProfileValue): void {
      if (active) {
        setProfile(value);
      }
    }

    function handleLoadError(error: unknown): void {
      if (active) {
        setErrorMessage(describeError(error));
      }
    }

    function handleLoadFinished(): void {
      if (active) {
        setLoading(false);
      }
    }

    setLoading(true);
    setErrorMessage(null);
    props.controller
      .load()
      .then(handleLoaded)
      .catch(handleLoadError)
      .finally(handleLoadFinished);

    return function cancelLoad(): void {
      active = false;
    };
  }, [props.controller]);

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

  return (
    <LoadedRgbProfileEditor
      controller={props.controller}
      initialProfile={profile}
    />
  );
}
