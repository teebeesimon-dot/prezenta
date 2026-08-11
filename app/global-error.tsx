"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ro">
      <body className="flex min-h-screen items-center justify-center bg-background px-4 font-sans text-foreground">
        <main className="max-w-md text-center">
          <h1 className="text-2xl font-bold tracking-tight">prezenta</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Aplicația a întâmpinat o eroare critică.
          </p>
          {process.env.NODE_ENV === "development" && (
            <pre className="mt-4 overflow-auto rounded-lg bg-muted p-3 text-left text-xs text-destructive">
              {error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={reset}
            className="mt-8 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover"
          >
            Reîncarcă aplicația
          </button>
        </main>
      </body>
    </html>
  );
}
