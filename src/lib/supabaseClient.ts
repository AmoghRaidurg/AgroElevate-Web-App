// // Lightweight Supabase shim for demo mode (no backend). Replace with real client when Supabase is configured.

// type User = { email: string; user_metadata?: Record<string, any> } | null;

// type AuthChangeCallback = (event: string, session: { user: User } | null) => void;

// const listeners: AuthChangeCallback[] = [];

// function getStoredUser(): User {
//   const raw = localStorage.getItem('agronexUser');
//   return raw ? JSON.parse(raw) : null;
// }

// function setStoredUser(user: User) {
//   if (user) localStorage.setItem('agronexUser', JSON.stringify(user));
//   else localStorage.removeItem('agronexUser');
//   listeners.forEach(cb => cb('SIGNED_IN', user ? { user } : null));
// }

// export const supabase = {
//   auth: {
//     async getUser() {
//       return { data: { user: getStoredUser() } as any, error: null };
//     },
//     onAuthStateChange(cb: AuthChangeCallback) {
//       listeners.push(cb);
//       return { data: { subscription: { unsubscribe: () => {
//         const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1);
//       } } } } as any;
//     },
//     async signInWithPassword({ email }: { email: string; password: string; }) {
//       const profileRaw = localStorage.getItem('agronexProfile');
//       const meta = profileRaw ? JSON.parse(profileRaw) : {};
//       setStoredUser({ email, user_metadata: meta });
//       return { data: { user: getStoredUser() }, error: null } as any;
//     },
//     async signUp({ email, options }: { email: string; password: string; options?: { data?: Record<string, any> } }) {
//       const meta = options?.data || {};
//       localStorage.setItem('agronexProfile', JSON.stringify(meta));
//       setStoredUser({ email, user_metadata: meta });
//       return { data: { user: getStoredUser() }, error: null } as any;
//     },
//     async signOut() {
//       setStoredUser(null);
//       return { error: null } as any;
//     }
//   },
//   functions: {
//     async invoke(_name: string, _opts?: any) {
//       // Demo returns a fake order id
//       return { data: { id: 'demo_order_123' }, error: null };
//     }
//   }
// };



import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase Environment Variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);