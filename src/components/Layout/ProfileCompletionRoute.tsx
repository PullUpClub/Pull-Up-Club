import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileValidation } from '../../hooks/useProfileValidation';
import { useAuth } from '../../context/AuthContext';

interface ProfileCompletionRouteProps {
  children: React.ReactNode;
}

/**
 * Route wrapper that ensures user has completed their profile before accessing the wrapped component
 * Redirects to profile page with toast notification if profile is incomplete
 */
const ProfileCompletionRoute: React.FC<ProfileCompletionRouteProps> = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isProfileComplete, showProfileIncompleteToast } = useProfileValidation();

  useEffect(() => {
    // Only check profile completion for authenticated users
    if (user && !isProfileComplete) {
      showProfileIncompleteToast();
      navigate('/profile', { replace: true });
    }
  }, [user, isProfileComplete, showProfileIncompleteToast, navigate]);

  // Don't render children if profile is incomplete
  if (user && !isProfileComplete) {
    return null;
  }

  return <>{children}</>;
};

export default ProfileCompletionRoute;
