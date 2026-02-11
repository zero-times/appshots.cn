import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import Landing from './pages/Landing';
import Creator from './pages/Creator';
import Preview from './pages/Preview';
import History from './pages/History';
import Login from './pages/Login';
import Admin from './pages/Admin';

export const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/create', element: <Creator /> },
      { path: '/project/:id', element: <Preview /> },
      { path: '/history', element: <History /> },
      { path: '/login', element: <Login /> },
      { path: '/admin', element: <Admin /> },
    ],
  },
]);
