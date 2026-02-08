export const ADMIN_EMAIL = 'bunjes.tjark@gmail.com';

export function isAdmin(email: string | undefined | null): boolean {
  return email?.toLowerCase() === ADMIN_EMAIL;
}
