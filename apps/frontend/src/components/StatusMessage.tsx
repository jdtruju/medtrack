interface StatusMessageProps {
  message: string;
  tone: 'success' | 'error';
}

export function StatusMessage({ message, tone }: StatusMessageProps) {
  const className =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-rose-200 bg-rose-50 text-rose-800';

  return <p className={`rounded-md border px-3 py-2 text-sm ${className}`}>{message}</p>;
}
