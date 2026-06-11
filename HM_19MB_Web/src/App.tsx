import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import AppLayout from './components/Layout';
import { DashboardRunProvider } from './contexts/DashboardRunContext';
import { SessionProvider } from './contexts/SessionContext';
import Calibration from './pages/Calibration';
import Dashboard from './pages/Dashboard';
import Sessions from './pages/Sessions';

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <SessionProvider>
        <DashboardRunProvider>
          <AppLayout />
        </DashboardRunProvider>
      </SessionProvider>
    ),
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'sessions',
        element: <Sessions />,
      },
      {
        path: 'sessions/:id/calibration',
        element: <Calibration />,
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
