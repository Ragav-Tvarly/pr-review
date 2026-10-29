import { LogOut } from "lucide-react";
import { signOut } from "@/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { devToken } from "@/lib/config";

export function UserMenu({ login }: { login: string }) {
  const dev = Boolean(devToken());
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={`Account menu for ${login}`}>
          <Avatar className="h-7 w-7">
            <AvatarImage src={`https://avatars.githubusercontent.com/${login}?s=56`} alt="" />
            <AvatarFallback>{login.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-xs text-muted-foreground">Signed in as</span>
          <span className="block truncate font-medium">{login}</span>
          {dev && <span className="block text-xs text-amber-600 dark:text-amber-400">dev token session</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {dev ? (
          <DropdownMenuItem disabled>Sign out (not available with dev token)</DropdownMenuItem>
        ) : (
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/signin" });
            }}
          >
            <DropdownMenuItem asChild>
              <button type="submit" className="w-full">
                <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                Sign out
              </button>
            </DropdownMenuItem>
          </form>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
