
export enum PlanType {
  TRIAL = 'TRIAL',
  MENSAL = 'MENSAL',
  TRIMESTRAL = 'TRIMESTRAL',
  ANUAL = 'ANUAL'
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  trialStartDate: number; // Timestamp
  plan: PlanType;
  isBlocked: boolean;
  isAdmin: boolean;
  instagramUrl?: string;
  facebookUrl?: string;
}

export enum PostType {
  TEXT_IMAGE = 'TEXT_IMAGE',
  CAROUSEL = 'CAROUSEL',
  REEL = 'REEL'
}

export interface Post {
  id: string;
  userId: string;
  type: PostType;
  content: {
    text?: string;
    images?: string[]; // Base64 or URLs
    videoUrl?: string;
    script?: string;
  };
  scheduledTime?: number; // Timestamp
  isPosted: boolean;
  createdAt: number;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAdminMode: boolean;
}
