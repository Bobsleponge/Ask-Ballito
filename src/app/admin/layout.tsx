import { requireAdminOrRedirect } from "@/lib/auth/require-admin";
import { toSessionUser } from "@/lib/auth/session-user";
import { AdminHeader } from "@/components/admin/admin-header";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireAdminOrRedirect();
  const sessionUser = toSessionUser(user)!;

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-zinc-50 dark:bg-background">
      <AdminHeader user={sessionUser} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        {children}
      </main>
    </div>
  );
}
