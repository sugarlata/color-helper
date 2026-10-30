import type { MatcherSettings, TabState } from "./types";

export type RuntimeMessage =
  | { type: "content-ready" }
  | { type: "set-mode"; mode: "idle" | "visual" }
  | { type: "toggle-dial" }
  | { type: "get-state" }
  | { type: "state-update"; state: TabState }
  | { type: "palette-updated" }
  | { type: "settings-updated"; settings: MatcherSettings };

