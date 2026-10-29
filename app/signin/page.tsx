import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GitPullRequest } from "lucide-react";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { devToken, primaryRepo } from "@/lib/config";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  AccessDenied: `Your GitHub account does not have access to ${primaryRepo()}. Ask an org owner to add you as a collaborator, then try again.`,
  OAuthCallbackError: "GitHub did not complete the sign-in. Try again.",
  Configuration: "The GitHub OAuth App is not configured on this deployment yet.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string }> }) {
  const { error, callbackUrl } = await searchParams;
  if (devToken() || (await auth())) redirect(callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/");
  const message = error ? (ERRORS[error] ?? "Sign-in failed. Try again.") : null;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <GitPullRequest className="h-6 w-6 text-primary" aria-hidden="true" />
          <h1 className="text-xl font-semibold tracking-tight">tvar review</h1>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">
          Review pull requests for <span className="font-mono text-foreground">{primaryRepo()}</span>. Sign in with the GitHub account that has access to the repo.
        </p>
        {message && (
          <p role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {message}
          </p>
        )}
        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/" });
          }}
        >
          <Button type="submit" className="w-full">
            Sign in with GitHub
          </Button>
        </form>
      </div>
    </main>
  );
}
