export interface Submission {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  region: string;
  organization: string;
  pullUpCount: number;
  actualPullUpCount?: number;
  videoUrl: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  submittedAt: string;
  approvedAt?: string;
  notes?: string;
  adminNotes?: string;
  featured?: boolean;
  socialHandle?: string;
}

export interface LeaderboardFilters {
  gender?: string;
  region?: string;
  club?: string;
  timeframe?: string;
  ageGroup?: string;
  badge?: string;
  pullUpRange?: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  criteria: {
    type: string;
    value: number;
  };
}

export interface FormState {
  step: number;
  fullName: string;
  email: string;
  phone: string;
  age: number;
  gender: "Male" | "Female" | "Other";
  region: string;
  organization: string;
  otherOrganization: string;
  pullUpCount: number;
  videoLink: string;
  videoConfirmed: boolean;
  videoAuthenticity: boolean;
  socialHandle?: string;
  consentChecked: boolean;
  isSubmitting: boolean;
  paymentStatus: "idle" | "processing" | "completed" | "failed";
  errorMessage: string;
  subscriptionType: "monthly" | "annual";
}

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name?: string;
  social_media?: string;
  age?: number;
  gender?: string;
  organization?: string;
  region: string;
  phone?: string;
  club?: string;
  stripe_customer_id?: string;
  is_paid: boolean;
  role: 'user' | 'admin';
  badges: Badge[];
  created_at: string;
  updated_at: string;
  is_profile_completed?: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
}

export interface PaymentHistory {
  id: string;
  userId: string;
  amount: number;
  status: 'succeeded' | 'failed' | 'pending';
  createdAt: string;
}

export interface EventParams {
  category: string;
  action: string;
  label?: string;
  value?: number;
}

export interface AdminStats {
  totalUsers: number;
  paidUsers: number;
  pendingSubmissions: number;
  approvedSubmissions: number;
  rejectedSubmissions: number;
}

export interface SubmitVideoParams {
  videoUrl: string;
  pullUpCount: number;
  userId: string;
  organization?: string;
  region?: string;
  gender?: string;
  age?: number;
}

export interface UseSubmissionsOptions {
  status?: 'Pending' | 'Approved' | 'Rejected' | 'all';
  limit?: number;
}
