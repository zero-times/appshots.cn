export type UserRole = 'user' | 'admin';
export type MembershipStatus = 'active' | 'expired' | 'revoked' | 'none';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipInfo {
  status: MembershipStatus;
  activatedAt?: string;
  expiresAt?: string | null;
}

export interface SendCodeRequest {
  email: string;
}

export interface SendCodeResponse {
  message: string;
  devCode?: string;
}

export interface VerifyCodeRequest {
  email: string;
  code: string;
}

export interface AuthResponse {
  user: User;
  isNewUser: boolean;
  migratedProjectCount: number;
  membership: MembershipInfo | null;
}

export interface MeResponse {
  user: User | null;
  membership: MembershipInfo | null;
}

export interface LogoutResponse {
  message: string;
}

export interface UsageResponse {
  analysisUsedToday: number;
  dailyLimit: number;
  isMember: boolean;
}
