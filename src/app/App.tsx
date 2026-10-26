import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/overlay';
import { Skeleton } from '@/components/data';
import { AppShell } from './AppShell';
import { RouteError } from './RouteError';

const StartPage = lazy(() => import('@/features/upload/StartPage'));
const OverviewPage = lazy(() => import('@/features/overview/OverviewPage'));
const MapPage = lazy(() => import('@/features/map/MapPage'));
const ApplicantsPage = lazy(() => import('@/features/applicants/ApplicantsPage'));
const PipelinePage = lazy(() => import('@/features/pipeline/PipelinePage'));
const TerritoriesPage = lazy(() => import('@/features/territories/TerritoriesPage'));
const TerritoryDetailPage = lazy(() => import('@/features/territories/TerritoryDetailPage'));
const OnboardingPage = lazy(() => import('@/features/onboarding/OnboardingPage'));
const AskPage = lazy(() => import('@/features/whatif/AskPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const GalleryPage = lazy(() => import('@/features/dev/GalleryPage'));
const PartnerPage = lazy(() => import('@/features/partner/PartnerPage'));
const InboxPage = lazy(() => import('@/features/inbox/InboxPage'));
const ChecksPage = lazy(() => import('@/features/checks/ChecksPage'));

function PageFallback() {
  return (
    <div className="space-y-4 p-6" aria-label="Loading">
      <Skeleton className="h-7 w-48" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

const S = (el: ReactNode) => <Suspense fallback={<PageFallback />}>{el}</Suspense>;

const router = createBrowserRouter([
  { path: '/', element: S(<StartPage />), errorElement: <RouteError /> },
  { path: '/partner', element: S(<PartnerPage />), errorElement: <RouteError /> },
  { path: '/partner/:id', element: S(<PartnerPage />), errorElement: <RouteError /> },
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { path: '/overview', element: S(<OverviewPage />) },
      { path: '/map', element: S(<MapPage />) },
      { path: '/applicants', element: S(<ApplicantsPage />) },
      { path: '/pipeline', element: S(<PipelinePage />) },
      { path: '/territories', element: S(<TerritoriesPage />) },
      { path: '/territories/:id', element: S(<TerritoryDetailPage />) },
      { path: '/onboarding', element: S(<OnboardingPage />) },
      { path: '/ask', element: S(<AskPage />) },
      { path: '/inbox', element: S(<InboxPage />) },
      { path: '/checks', element: S(<ChecksPage />) },
      { path: '/settings', element: S(<SettingsPage />) },
      { path: '/dev/components', element: S(<GalleryPage />) },
      { path: '*', element: <Navigate to="/overview" replace /> },
    ],
  },
]);

export function App() {
  return (
    <TooltipProvider delayDuration={150}>
      <RouterProvider router={router} />
    </TooltipProvider>
  );
}
