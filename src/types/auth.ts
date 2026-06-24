export type UserRole = 'farmer' | 'middleman' | 'industrialist' | 'customer' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  address?: string | null;
  phone?: string | null;
  bank_account?: string | null;
  suspended?: boolean;
  approved?: boolean;
  created_at?: string;
}

export interface UserWalletRow {
  uid: string;
  name?: string;
  role?: string;
  walletBalance?: number;
  approved?: boolean;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: 'farmer' | 'middleman' | 'industrialist' | 'customer';
  address: string;
  phone: string;
  bankAccount?: string;
}

export interface ProfileUpdatePayload {
  name: string;
  phone: string;
  address: string;
  bank_account?: string;
}
