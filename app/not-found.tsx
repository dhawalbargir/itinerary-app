import Link from "next/link";

export default function NotFound() {
  return (
    <main className="hero min-h-dvh">
      <div className="hero-content flex-col text-center">
        <h1 className="wide text-3xl font-extrabold">Nothing here</h1>
        <p className="text-base-content/70">This trip doesn't exist, or its share link was turned off.</p>
        <Link href="/" className="btn btn-primary mt-2">Go to your trips</Link>
      </div>
    </main>
  );
}
