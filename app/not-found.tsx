import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-bold text-primary">404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
        Pagina nu a fost găsită
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Link-ul poate fi greșit sau pagina a fost mutată.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover"
      >
        Înapoi la prezenta
      </Link>
    </main>
  );
}
