import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import type { GoogleAccountProfile } from '../types/nextube';

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

export const YOUTUBE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
];

function createGoogleProvider(forceSelectAccount = true): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  for (const scope of YOUTUBE_OAUTH_SCOPES) {
    provider.addScope(scope);
  }
  if (forceSelectAccount) {
    provider.setCustomParameters({ prompt: 'select_account' });
  }
  return provider;
}

// Strict in-memory token cache (never persisted to localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export function initAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthCleared?: () => void
) {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user && cachedAccessToken) {
      onAuthSuccess?.(user, cachedAccessToken);
    } else if (!isSigningIn) {
      if (!user) {
        cachedAccessToken = null;
      }
      onAuthCleared?.();
    }
  });
}

export async function signInWithGoogleAccount(
  forceAccountPicker = true
): Promise<{ profile: GoogleAccountProfile; accessToken: string }> {
  try {
    isSigningIn = true;
    const provider = createGoogleProvider(forceAccountPicker);
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) {
      throw new Error('Could not obtain Google OAuth access token.');
    }

    cachedAccessToken = credential.accessToken;
    const u = result.user;

    const profile: GoogleAccountProfile = {
      uid: u.uid,
      email: u.email || 'youtube.user@gmail.com',
      displayName: u.displayName || 'YouTube Creator',
      photoURL: u.photoURL,
      channelHandle: `@${(u.email || 'user').split('@')[0]}`,
      isIncognito: false,
    };

    return { profile, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export function getAccessToken(): string | null {
  return cachedAccessToken;
}

export async function logoutGoogleAccount(): Promise<void> {
  cachedAccessToken = null;
  await signOut(auth);
}
