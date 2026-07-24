"use client";

import { useTransition } from "react";
import Link from "next/link";
import { LayoutDashboard, LogOut, Shield, User as UserIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { signOut } from "@/lib/auth/actions";

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export function UserMenu({
  user,
  isAdmin = false,
  hasBusiness = false,
}: {
  user: SessionUser | null;
  isAdmin?: boolean;
  hasBusiness?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (!user) {
    return (
      <AuthDialog
        trigger={
          <Button size="sm" variant="default">
            Sign in
          </Button>
        }
      />
    );
  }

  const initials = (user.name ?? user.email ?? "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function handleSignOut() {
    startTransition(() => {
      void signOut();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Avatar className="size-8">
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
            <AvatarFallback>
              {initials || <UserIcon className="size-4" />}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">
          {user.name ?? user.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link href="/admin" className="flex cursor-pointer items-center gap-2">
              <Shield className="size-4" /> Admin portal
            </Link>
          </DropdownMenuItem>
        ) : null}
        {hasBusiness ? (
          <DropdownMenuItem asChild>
            <Link
              href="/business/dashboard"
              className="flex cursor-pointer items-center gap-2"
            >
              <LayoutDashboard className="size-4" /> Business dashboard
            </Link>
          </DropdownMenuItem>
        ) : null}
        {isAdmin || hasBusiness ? <DropdownMenuSeparator /> : null}
        <DropdownMenuItem
          disabled={pending}
          onSelect={(event) => {
            // Prevent the menu from unmounting before the server action runs.
            event.preventDefault();
            handleSignOut();
          }}
          className="cursor-pointer"
        >
          <LogOut className="size-4" />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
