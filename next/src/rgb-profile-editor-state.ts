import { useCallback, useEffect, useState } from "react";

import type {
  RgbProfileEditorController,
  RgbProfileValue,
} from "./device/rgb-profile-editor-controller.ts";

type ProfileField =
  | "mode"
  | "hue"
  | "saturation"
  | "brightness"
  | "speed";

interface ProfileLoadState {
  readonly errorMessage: string | null;
  readonly loading: boolean;
  readonly profile: RgbProfileValue | null;
}

interface OperationExecutorState {
  readonly busy: boolean;
  readonly errorMessage: string | null;
  readonly execute: (
    operation: Promise<void>,
    successMessage: string,
  ) => Promise<void>;
  readonly statusMessage: string | null;
}

interface RgbProfileEditorState {
  readonly busy: boolean;
  readonly errorMessage: string | null;
  readonly onApply: () => Promise<void>;
  readonly onCancelPreview: () => Promise<void>;
  readonly onChange: (field: ProfileField, value: number) => void;
  readonly onPreview: () => Promise<void>;
  readonly onSave: () => Promise<void>;
  readonly profile: RgbProfileValue;
  readonly statusMessage: string | null;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "The RGB profile operation failed.";
}

function useRgbProfileLoader(
  controller: RgbProfileEditorController,
): ProfileLoadState {
  const [profile, setProfile] = useState<RgbProfileValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(
    function loadProfileEffect(): () => void {
      let active = true;

      function receiveProfile(value: RgbProfileValue): void {
        if (active) {
          setProfile(value);
        }
      }

      function receiveError(error: unknown): void {
        if (active) {
          setErrorMessage(describeError(error));
        }
      }

      function finishLoad(): void {
        if (active) {
          setLoading(false);
        }
      }

      setLoading(true);
      setErrorMessage(null);
      controller.load().then(receiveProfile).catch(receiveError).finally(finishLoad);

      return function cancelLoad(): void {
        active = false;
      };
    },
    [controller],
  );

  return { errorMessage, loading, profile };
}

function useOperationExecutor(): OperationExecutorState {
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const execute: OperationExecutorState["execute"] = useCallback(
    async function executePromise(
      operation: Promise<void>,
      successMessage: string,
    ): Promise<void> {
      setBusy(true);
      setStatusMessage(null);
      setErrorMessage(null);
      try {
        await operation;
        setStatusMessage(successMessage);
      } catch (error: unknown) {
        setErrorMessage(describeError(error));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  return { busy, errorMessage, execute, statusMessage };
}

function usePreviewAction(
  controller: RgbProfileEditorController,
  profile: RgbProfileValue,
  execute: OperationExecutorState["execute"],
): () => Promise<void> {
  return useCallback(
    async function previewProfile(): Promise<void> {
      await execute(controller.preview(profile), "Preview active temporarily.");
    },
    [controller, execute, profile],
  );
}

function useCancelPreviewAction(
  controller: RgbProfileEditorController,
  execute: OperationExecutorState["execute"],
): () => Promise<void> {
  return useCallback(
    async function cancelProfilePreview(): Promise<void> {
      await execute(controller.cancelPreview(), "Preview cancelled.");
    },
    [controller, execute],
  );
}

function useApplyAction(
  controller: RgbProfileEditorController,
  profile: RgbProfileValue,
  execute: OperationExecutorState["execute"],
): () => Promise<void> {
  return useCallback(
    async function applyProfile(): Promise<void> {
      await execute(
        controller.apply(profile),
        "Profile applied to live keyboard state.",
      );
    },
    [controller, execute, profile],
  );
}

function useSaveAction(
  controller: RgbProfileEditorController,
  profile: RgbProfileValue,
  execute: OperationExecutorState["execute"],
): () => Promise<void> {
  return useCallback(
    async function saveProfile(): Promise<void> {
      await execute(controller.save(profile), "Profile saved to keyboard.");
    },
    [controller, execute, profile],
  );
}

function useRgbProfileEditorState(
  controller: RgbProfileEditorController,
  initialProfile: RgbProfileValue,
): RgbProfileEditorState {
  const [profile, setProfile] = useState<RgbProfileValue>(initialProfile);
  const operation = useOperationExecutor();

  const onChange: RgbProfileEditorState["onChange"] = useCallback(
    function changeProfileField(field: ProfileField, value: number): void {
      setProfile({ ...profile, [field]: value });
    },
    [profile],
  );

  return {
    busy: operation.busy,
    errorMessage: operation.errorMessage,
    onApply: useApplyAction(controller, profile, operation.execute),
    onCancelPreview: useCancelPreviewAction(controller, operation.execute),
    onChange,
    onPreview: usePreviewAction(controller, profile, operation.execute),
    onSave: useSaveAction(controller, profile, operation.execute),
    profile,
    statusMessage: operation.statusMessage,
  };
}

export { useRgbProfileEditorState, useRgbProfileLoader };
export type { ProfileField, ProfileLoadState, RgbProfileEditorState };
