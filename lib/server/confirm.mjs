// Verifies a one-time link from an Auth email and signs the user in to the right entry.
import { sessionCookies } from './api.mjs';

const TYPES = new Set(['email', 'signup', 'recovery', 'invite', 'magiclink', 'email_change']);

export async function confirmLink(request, backend) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash') || '', type = url.searchParams.get('type') || '';
  if (!tokenHash || tokenHash.length > 200 || !TYPES.has(type)) return { location: '/?notice=link-invalid', cookies: [] };
  try {
    const verified = await backend.auth.verifyOtp({ tokenHash, type });
    let identity = await backend.identities.get(verified.subject);
    if (!identity) identity = await backend.identities.insert({ subject: verified.subject, email: verified.email || '', kind: 'parent' });
    const role = identity?.kind === 'staff' ? 'staff' : 'parent';
    if (identity?.blocked) return { location: role === 'staff' ? '/staff' : '/', cookies: [] };
    if (role === 'parent') await backend.service.openHousehold(verified.subject, verified.email || '');
    const home = role === 'staff' ? '/staff' : '/';
    const location = type === 'recovery' ? `/reset?role=${role}` : `${home}?notice=confirmed`;
    return { location, cookies: sessionCookies(role, verified.session) };
  } catch {
    return { location: type === 'recovery' ? '/reset?notice=link-invalid' : '/?notice=link-invalid', cookies: [] };
  }
}
