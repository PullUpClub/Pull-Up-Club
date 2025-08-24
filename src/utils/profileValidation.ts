import { Profile } from '../types';

export interface ProfileValidationResult {
  isComplete: boolean;
  missingFields: string[];
  completedFields: string[];
}

/**
 * Validates if a user's profile has all required fields completed
 * Required fields: full_name, age, gender, region
 */
export const validateProfileCompletion = (profile: Profile | null): ProfileValidationResult => {
  const requiredFields = [
    { key: 'full_name', label: 'Full Name' },
    { key: 'age', label: 'Age' },
    { key: 'gender', label: 'Gender' },
    { key: 'region', label: 'Region' }
  ];

  const missingFields: string[] = [];
  const completedFields: string[] = [];

  if (!profile) {
    return {
      isComplete: false,
      missingFields: requiredFields.map(field => field.label),
      completedFields: []
    };
  }

  requiredFields.forEach(field => {
    const value = profile[field.key as keyof Profile];
    
    // Check if field is empty, null, undefined, or 0 (for age)
    const isEmpty = value === null || 
                   value === undefined || 
                   value === '' || 
                   (field.key === 'age' && (typeof value === 'number' && (value === 0 || value < 1)));

    if (isEmpty) {
      missingFields.push(field.label);
    } else {
      completedFields.push(field.label);
    }
  });

  return {
    isComplete: missingFields.length === 0,
    missingFields,
    completedFields
  };
};

/**
 * Returns a human-readable message about profile completion status
 */
export const getProfileCompletionMessage = (validation: ProfileValidationResult): string => {
  if (validation.isComplete) {
    return 'Your profile is complete!';
  }

  const missing = validation.missingFields.join(', ');
  return `Please complete the following profile fields: ${missing}`;
};
