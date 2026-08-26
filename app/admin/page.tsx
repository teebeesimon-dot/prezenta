import Link from "next/link";
import AdminGroupMembers from "@/components/AdminGroupMembers";
import AdminPanel from "@/components/AdminPanel";
import RequireSuperAdmin from "@/components/RequireSuperAdmin";

export default function AdminPage() {
  return (
    <div className="min-h-full bg-background">
      <RequireSuperAdmin>
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <Link
            href="/"
            className="mb-6 inline-flex items-center text-sm font-medium text-primary transition hover:text-primary-hover"
          >
            ← Înapoi acasă
          </Link>

          <header className="mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Admin</h1>
            <p className="mt-2 text-muted-foreground">
              Gestionează utilizatorii, accesul de organizator și membrii grupurilor.
            </p>
          </header>

          <AdminPanel />
          <AdminGroupMembers />
        </div>
      </RequireSuperAdmin>
    </div>
  );
}
