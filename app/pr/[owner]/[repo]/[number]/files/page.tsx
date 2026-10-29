import { FilesChanged } from "@/components/diff/files-changed";
import { viewer } from "@/lib/github/client";
import { getFilePatches, getPullRequest, getReviewComments, type PrFile } from "@/lib/github/pull-request";
import { isLargeFile, isNoisePath } from "@/lib/noise";

type Params = Promise<{ owner: string; repo: string; number: string }>;

export default async function FilesPage({ params }: { params: Params }) {
  const { owner, repo, number } = await params;
  const n = Number(number);
  const [pr, patches, comments, me] = await Promise.all([getPullRequest(owner, repo, n), getFilePatches(owner, repo, n), getReviewComments(owner, repo, n), viewer()]);
  const viewed = new Map<string, PrFile>(pr!.files.map((f) => [f.path, f]));
  const scores = new Map((pr!.review?.stale ? [] : (pr!.review?.review.files ?? [])).map((f) => [f.path, f]));
  const files = patches.map((p) => {
    const score = scores.get(p.path);
    return {
      ...p,
      viewed: viewed.get(p.path)?.viewed === "VIEWED",
      noise: isNoisePath(p.path) || Boolean(score?.noise),
      large: isLargeFile(p.changes),
      importance: score?.importance,
      severity: score?.severity,
      reason: score?.reason,
    };
  });
  return <FilesChanged prId={pr!.id} repo={pr!.repo} number={pr!.number} files={files} canMarkViewed={!!viewed.size} comments={comments} isAuthor={pr!.author.login === me.login} />;
}
