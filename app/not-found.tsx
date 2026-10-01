import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="wide text-3xl font-bold">Nothing here</h1>
      <p className="mt-2 text-muted">This trip doesn't exist, or the link was turned off.</p>
      <Link href="/" className="btn mt-6">Go to your trips</Link>
    </main>
  );
}
