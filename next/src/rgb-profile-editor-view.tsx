import { type ReactNode, useId } from "react";

import type { RgbProfileEditorController } from "./device/rgb-profile-editor-controller.ts";
import { ProfileControls } from "./rgb-profile-editor-controls.tsx";
import type { RgbProfileEditorState } from "./rgb-profile-editor-state.ts";

interface OperationFeedbackProps {
  readonly errorMessage: string | null;
  readonly statusMessage: string | null;
}

interface EditorActionsProps {
  readonly state: RgbProfileEditorState;
}

interface EditorViewProps {
  readonly controller: RgbProfileEditorController;
  readonly state: RgbProfileEditorState;
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
      <button
        type="button"
        disabled={props.state.busy}
        onClick={props.state.onPreview}
      >
        Preview
      </button>
      <button
        type="button"
        disabled={props.state.busy}
        onClick={props.state.onCancelPreview}
      >
        Cancel preview
      </button>
      <button
        type="button"
        disabled={props.state.busy}
        onClick={props.state.onApply}
      >
        Apply
      </button>
      <button
        type="button"
        disabled={props.state.busy}
        onClick={props.state.onSave}
      >
        Save to keyboard
      </button>
    </div>
  );
}

function RgbProfileEditorView(props: EditorViewProps): ReactNode {
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
      <ProfileControls controller={props.controller} state={props.state} />
      <EditorActions state={props.state} />
      <OperationFeedback
        statusMessage={props.state.statusMessage}
        errorMessage={props.state.errorMessage}
      />
    </section>
  );
}

export { RgbProfileEditorView };
