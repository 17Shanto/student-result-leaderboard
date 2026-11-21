import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loading } from './StateViews';

export default function ProtectedRoute({ children }) {
  const { admin, checking } = useAuth();
  const location = useLocation();

  if (checking) return <div className="center-page"><Loading label="Checking session…" /></div>;
  if (!admin) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}
