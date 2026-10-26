import { Link, useRouteError } from 'react-router-dom';
import { ErrorState } from '@/components/data';

export function RouteError() {
  const err = useRouteError();
  const message = err instanceof Error ? err.message : 'Something went wrong on this screen';
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg p-6">
      <ErrorState message={message} onRetry={() => window.location.reload()} />
      <Link to="/overview" className="text-sm text-brand hover:underline">
        Back to overview
      </Link>
    </div>
  );
}
