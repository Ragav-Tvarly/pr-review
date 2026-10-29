import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { login: string; canPush: boolean };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    login?: string;
    canPush?: boolean;
    accessToken?: string;
  }
}
