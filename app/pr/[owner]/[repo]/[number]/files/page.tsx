import { FilesChanged } from "@/components/diff/files-changed";
import { getFilePatches, getPullRequest, type PrFile } from "@/lib/github/pull-request";
import { isLargeFile, isNoisePath } from "@/lib/noise";

type Params = Promise<{ owner: string; repo: string; number: string }>;

export default async function FilesPage({ params }: { params: Params }) {
  const { owner, repo, number } = await params;
  const n = Number(number);
  const [pr, patches] = await Promise.all([getPullRequest(owner, repo, n), getFilePatches(owner, repo, n)]);
  const viewed = new Map<string, PrFile>(pr!.files.map((f) => [f.path, f]));
  const files = patches.map((p) => ({
    ...p,
    viewed: viewed.get(p.path)?.viewed === "VIEWED",
    noise: isNoisePath(p.path),
    large: isLargeFile(p.changes),
  }));
  return <FilesChanged prId={pr!.id} repo={pr!.repo} number={pr!.number} files={files} canMarkViewed={!!viewed.size} />;
}
