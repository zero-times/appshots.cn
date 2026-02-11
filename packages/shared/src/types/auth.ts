export interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
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
}

export interface MeResponse {
  user: User | null;
}

export interface LogoutResponse {
  message: string;
}
