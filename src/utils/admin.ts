/**
 * Admin configuration and access control utilities
 */

export const ADMIN_EMAILS = [
  'gcrtech.raja@gmail.com',
  'mrraavana07@gmail.com',
] as const;

/**
 * Checks whether the given email belongs to an authorized platform administrator.
 */
export const isAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (
    normalized === 'gcrtech.raja@gmail.com' ||
    normalized === 'mrraavana07@gmail.com'
  );
};

/**
 * Evaluates whether a user has administrative privileges based on role, flag, or email.
 */
export const isUserAdmin = (user?: {
  role?: string | null;
  is_admin?: boolean | null;
  isAdmin?: boolean | null;
  email?: string | null;
} | null): boolean => {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'owner') return true;
  if (user.is_admin === true || user.isAdmin === true) return true;
  if (isAdminEmail(user.email)) return true;
  return false;
};
