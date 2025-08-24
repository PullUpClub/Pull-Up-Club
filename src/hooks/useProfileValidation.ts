import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { validateProfileCompletion, getProfileCompletionMessage } from '../utils/profileValidation';

export const useProfileValidation = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const validation = validateProfileCompletion(profile);

  /**
   * Shows a toast notification directing user to complete their profile
   */
  const showProfileIncompleteToast = useCallback(() => {
    const message = getProfileCompletionMessage(validation);
    
    toast.error(`${message} Go to Profile Settings to complete.`, {
      duration: 5000,
      style: {
        background: '#1f2937',
        color: '#ffffff',
        border: '1px solid #ef4444',
      },
    });
  }, [validation, navigate]);

  /**
   * Checks if profile is complete and shows toast if not
   * Returns true if profile is complete, false otherwise
   */
  const validateAndNotify = useCallback((): boolean => {
    if (!validation.isComplete) {
      showProfileIncompleteToast();
      return false;
    }
    return true;
  }, [validation.isComplete, showProfileIncompleteToast]);

  /**
   * Validates profile completion before allowing an action to proceed
   * If profile is incomplete, shows toast and prevents action
   */
  const requireCompleteProfile = useCallback((action: () => void) => {
    if (validateAndNotify()) {
      action();
    }
  }, [validateAndNotify]);

  return {
    validation,
    isProfileComplete: validation.isComplete,
    missingFields: validation.missingFields,
    completedFields: validation.completedFields,
    showProfileIncompleteToast,
    validateAndNotify,
    requireCompleteProfile
  };
};
