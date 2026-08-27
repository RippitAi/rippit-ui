export function LoadingState({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-full items-center justify-center"
    >
      <div className="text-center">
        <div
          aria-hidden="true"
          className="mx-auto size-7 animate-spin rounded-full border-2 border-t1 border-t-transparent motion-reduce:animate-none"
        />
        <p className="mt-3 text-[13px] text-t3">{message}</p>
      </div>
    </div>
  );
}
