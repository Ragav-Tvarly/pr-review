"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { dismissNotice, listNotifications, markAllNoticesRead, markNoticeRead, type Notice } from "@/lib/github/notifications";
import { timeAgo } from "@/lib/format";
import { prPath } from "@/lib/paths";
import { cn } from "@/lib/utils";

/** The user's GitHub inbox for the enabled repos, linking into the dashboard. Polls every 30 s while visible. */
export function NotificationBell() {
  const [items, setItems] = useState<Notice[] | null>(null);
  const router = useRouter();
  const load = useCallback(() => {
    if (document.visibilityState === "visible") void listNotifications().then(setItems).catch(() => undefined);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    document.addEventListener("visibilitychange", load);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", load);
    };
  }, [load]);

  const unread = items?.filter((n) => n.unread).length ?? 0;
  const open = (n: Notice) => {
    setItems((all) => all?.map((x) => (x.id === n.id ? { ...x, unread: false } : x)) ?? null);
    void markNoticeRead(n.id);
    router.push(prPath(n));
  };
  const dismiss = (n: Notice) => {
    setItems((all) => all?.filter((x) => x.id !== n.id) ?? null);
    void dismissNotice(n.id);
  };
  const readAll = () => {
    setItems((all) => all?.map((x) => ({ ...x, unread: false })) ?? null);
    void markAllNoticesRead();
  };

  return (
    <DropdownMenu onOpenChange={(o) => o && load()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
          <Bell className="h-4 w-4" aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-w-[calc(100vw-2rem)]">
        <div className="flex items-center justify-between pr-1">
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={readAll}>
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-[60vh] overflow-y-auto">
          {items === null ? (
            <DropdownMenuItem disabled>Loading…</DropdownMenuItem>
          ) : items.length === 0 ? (
            <DropdownMenuItem disabled>Nothing in the last two weeks.</DropdownMenuItem>
          ) : (
            items.map((n) => (
              <DropdownMenuItem key={n.id} onSelect={() => open(n)} className="flex items-start gap-2 py-2">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.unread ? "bg-primary" : "bg-transparent")} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm", n.unread && "font-medium")}>{n.text}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {n.title} · {n.repo} · {timeAgo(n.updatedAt)}
                  </span>
                  {n.unread && <span className="sr-only">(unread)</span>}
                </span>
                <button
                  type="button"
                  className="-mr-1 shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  aria-label={`Dismiss: ${n.text}`}
                  title="Dismiss"
                  // keep the click on the button: the menu item would otherwise select (open the PR) on pointer-up
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dismiss(n);
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
