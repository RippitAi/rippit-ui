import Link from "next/link";

export function ErrorCard({
  title,
  message,
  backHref = "/dashboard",
  backLabel = "Back to dashboard",
  onRetry,
}: {
  title: string;
  message: string;
  backHref?: string;
  backLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <div
        role="alert"
        className="w-full max-w-md rounded-card border border-line bg-panel p-6 text-center backdrop-blur-[14px]"
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-3 flex size-9 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--err)_32%,transparent)] bg-[color-mix(in_srgb,var(--err)_10%,transparent)] text-[15px] font-bold text-err-text"
        >
          !
        </div>
        <h1 className="mb-1.5 text-[14px] font-semibold">{title}</h1>
        <p className="mb-4 text-[12px] text-t2">{message}</p>
        <div className="flex items-center justify-center gap-4">
          {onRetry && (
            <button
              onClick={onRetry}
              className="cursor-pointer text-[12px] font-semibold text-t1 underline-offset-4 hover:underline"
            >
              Try again
            </button>
          )}
          <Link
            href={backHref}
            className="text-[12px] font-semibold text-t1 underline-offset-4 hover:underline"
          >
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
