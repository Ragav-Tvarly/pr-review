import { unstable_cache } from "next/cache";
import { headers } from "next/headers";
import { getToken } from "next-auth/jwt";
import { devToken, isSenior, repos } from "@/lib/config";
import { repoAccess } from "@/lib/github/access";

const GITHUB_API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

/** `repos`: the enabled repos this user can read (what the dashboard shows); `pushRepos`: those they can push to. */
export type Viewer = { login: string; repos: string[]; pushRepos: string[]; isSenior: boolean };

/** The signed-in user's GitHub token, read server-side from the Auth.js cookie. */
async function userToken(): Promise<string> {
  const dev = devToken();
  if (dev) return dev;
  const token = await getToken({
    req: { headers: await headers() },
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });
  if (!token?.accessToken) throw new GitHubError(401, "Not signed in");
  return token.accessToken;
}

let devViewer: Promise<Viewer> | undefined;

export async function viewer(): Promise<Viewer> {
  if (devToken()) {
    const dev = devToken()!;
    devViewer ??= Promise.all([rest<{ login: string }>("/user"), repoAccess(dev)]).then(([me, access]) => ({ login: me.login, ...access, isSenior: isSenior(me.login) }));
    return devViewer;
  }
  const token = await getToken({
    req: { headers: await headers() },
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });
  if (!token?.login || !token.accessToken) throw new GitHubError(401, "Not signed in");
  // Looked up per user (cached 5 min) rather than frozen in the cookie at sign-in, so newly enabled repos
  // and changed permissions show up without signing out, and older cookies without the list still work.
  const accessToken = token.accessToken;
  const access = await unstable_cache(() => repoAccess(accessToken), ["access", token.login, ...repos()], { revalidate: 300 })();
  return { login: token.login, ...access, isSenior: isSenior(token.login) };
}

/**
 * Cache a GitHub read for a short while, per signed-in user, across requests. The token is resolved
 * here (outside the cache scope) and bound into the function; only the login goes into the cache key.
 * Mutations call revalidateTag(tag) so the next read is fresh.
 */
export async function cachedRead<T>(keyParts: string[], tags: string[], fn: (token: string) => Promise<T>, revalidate = 30): Promise<T> {
  const token = await userToken();
  const { login } = await viewer();
  return unstable_cache(() => fn(token), ["gh", login, ...keyParts], { revalidate, tags })();
}

export async function rest<T>(path: string, init: RequestInit & { accept?: string; token?: string } = {}): Promise<T> {
  const token = init.token ?? (await userToken());
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: init.accept ?? "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) throw new GitHubError(res.status, await errorMessage(res));
  if (res.status === 204) return undefined as T;
  if (init.accept && !init.accept.includes("json")) return (await res.text()) as T;
  return (await res.json()) as T;
}

export async function graphql<T>(query: string, variables: Record<string, unknown> = {}, token?: string): Promise<T> {
  token ??= await userToken();
  const res = await fetch(`${GITHUB_API}/graphql`, {
    method: "POST",
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new GitHubError(res.status, await errorMessage(res));
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new GitHubError(400, json.errors.map((e) => e.message).join("; "));
  if (!json.data) throw new GitHubError(500, "Empty GraphQL response");
  return json.data;
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { message?: string };
    return json.message ?? res.statusText;
  } catch {
    return res.statusText;
  }
}
