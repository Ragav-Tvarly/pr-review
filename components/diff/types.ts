import type { FilePatch } from "@/lib/github/pull-request";

export type DiffFileItem = FilePatch & {
  viewed: boolean;
  noise: boolean;
  large: boolean;
  /** Filled by the AI review (P4). */
  importance?: number;
  severity?: "critical" | "warning" | "suggestion" | "none";
  reason?: string;
};

export function fileAnchor(path: string): string {
  return `file-${path.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}
