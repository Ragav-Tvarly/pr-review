export function prPath(pr: { repo: string; number: number }, tab: "" | "commits" | "files" = ""): string {
  return `/pr/${pr.repo}/${pr.number}${tab ? `/${tab}` : ""}`;
}
