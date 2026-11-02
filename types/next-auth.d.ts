import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { login: string; repos: string[]; pushRepos: string[] };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    login?: string;
    repos?: string[];
    pushRepos?: string[];
    accessToken?: string;
  }
}
