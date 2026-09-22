import type { ReactNode } from "react";

import type { RgbProfileEditorController } from "./device/rgb-profile-editor-controller.ts";
import {
  useRgbProfileEditorState,
  useRgbProfileLoader,
} from "./rgb-profile-editor-state.ts";
import { RgbProfileEditorView } from "./rgb-profile-editor-view.tsx";

interface RgbProfileEditorProps {
  readonly controller: RgbProfileEditorController;
}

export function RgbProfileEditor(props: RgbProfileEditorProps): ReactNode {
  const loadState = useRgbProfileLoader(props.controller);

  if (loadState.loading) {
    return (
      <section className="editor-card" aria-busy="true">
        <p className="label">Global RGB profile · 0xF0</p>
        <p className="muted">Reading current profile…</p>
      </section>
    );
  }

  if (loadState.profile === null) {
    return (
      <section className="editor-card">
        <p className="label">Global RGB profile · 0xF0</p>
        <p className="error-message" role="alert">
          {loadState.errorMessage ?? "The current RGB profile could not be read."}
        </p>
      </section>
    );
  }

  return (
    <LoadedRgbProfileEditor
      controller={props.controller}
      initialProfile={loadState.profile}
    />
  );
}

interface LoadedEditorProps {
  readonly controller: RgbProfileEditorController;
  readonly initialProfile: NonNullable<
    ReturnType<typeof useRgbProfileLoader>["profile"]
  >;
}

function LoadedRgbProfileEditor(props: LoadedEditorProps): ReactNode {
  const state = useRgbProfileEditorState(
    props.controller,
    props.initialProfile,
  );
  return <RgbProfileEditorView controller={props.controller} state={state} />;
}
