import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { PortalSkeleton } from './SkeletonLoader.jsx';

function RedirectNotice({ to, message }) {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => navigate(to, { replace: true }), 350);
    return () => clearTimeout(timer);
  }, [navigate, to]);

  return (
    <div className="page-shell">
      <div className="page-shell-card">
        <p>{message}</p>
        <small>Redirecting you to the login page...</small>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <PortalSkeleton message="Authenticating & verifying permissions..." />;
  }

  if (!user) {
    return (
      <RedirectNotice
        to="/login"
        message="You must be signed in to view this page."
      />
    );
  }

  const userRole = String(user?.role || '').toLowerCase();
  const isSuper = !!user?.isSuperAdmin;

  // Super Admin & Admin access bypass to all panels
  if (isSuper || userRole === 'admin') {
    return children;
  }

  // Principal access to principal, teacher, and student panels
  if (userRole === 'principal' && Array.isArray(allowedRoles) && (allowedRoles.includes('principal') || allowedRoles.includes('teacher') || allowedRoles.includes('student'))) {
    return children;
  }

  // Standard role check
  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return (
      <RedirectNotice
        to="/login"
        message="You must be signed in with the correct role to view this page."
      />
    );
  }

  return children;
}
