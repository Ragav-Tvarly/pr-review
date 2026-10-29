import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { primaryRepo } from "@/lib/config";

const GITHUB_API = "https://api.github.com";

/** Repo access check with the user's own token. 200 = collaborator; also tells us whether they can push. */
async function repoAccess(token: string): Promise<{ ok: boolean; canPush: boolean }> {
  const res = await fetch(`${GITHUB_API}/repos/${primaryRepo()}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, canPush: false };
  const json = (await res.json()) as { permissions?: { push?: boolean } };
  return { ok: true, canPush: Boolean(json.permissions?.push) };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub({ authorization: { params: { scope: "read:user repo" } } })],
  session: { strategy: "jwt" },
  pages: { signIn: "/signin", error: "/signin" },
  callbacks: {
    async signIn({ account }) {
      if (!account?.access_token) return false;
      return (await repoAccess(account.access_token)).ok;
    },
    async jwt({ token, account, profile }) {
      if (account?.access_token && profile) {
        token.accessToken = account.access_token;
        token.login = String(profile.login);
        token.canPush = (await repoAccess(account.access_token)).canPush;
      }
      return token;
    },
    // The access token stays in the encrypted cookie only; it is never copied into the session object.
    session({ session, token }) {
      session.user.login = token.login ?? "";
      session.user.canPush = token.canPush ?? false;
      return session;
    },
  },
});
