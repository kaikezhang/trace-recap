import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold tracking-tight">TraceRecap</h1>
        <p className="text-lg text-muted-foreground max-w-md">
          Turn your travel routes into beautiful short videos in under 3
          minutes.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <Link
          href="/editor"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Create Video
        </Link>
        <Link
          href="/editor?demo=true"
          className="inline-flex items-center justify-center rounded-lg border border-border bg-secondary px-8 py-3 text-sm font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-secondary/80"
        >
          Try Demo
        </Link>
      </div>
    </main>
  );
}
