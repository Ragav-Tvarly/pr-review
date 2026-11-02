import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { repoAccess } from "@/lib/github/access";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub({ authorization: { params: { scope: "read:user repo" } } })],
  session: { strategy: "jwt" },
  pages: { signIn: "/signin", error: "/signin" },
  callbacks: {
    async signIn({ account, profile }) {
      if (!account?.access_token) return false;
      if (String(profile?.login ?? "").toLowerCase() === "tvarreview") return false; // the review bot never uses the dashboard
      return (await repoAccess(account.access_token)).repos.length > 0;
    },
    async jwt({ token, account, profile }) {
      if (account?.access_token && profile) {
        token.accessToken = account.access_token;
        token.login = String(profile.login);
      }
      return token;
    },
    // The access token stays in the encrypted cookie only; it is never copied into the session object.
    session({ session, token }) {
      session.user.login = token.login ?? "";
      return session;
    },
  },
});
