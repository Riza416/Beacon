export type SubmitResult =
  | { ok: true }
  | {
      ok: false;
      kind: "hard" | "soft";
      missing: { id: string; label: string }[];
    };
