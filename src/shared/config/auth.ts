// src/shared/config/auth.ts
import { makeRedirectUri } from 'expo-auth-session';

export const OAUTH_REDIRECT_URI = makeRedirectUri({
  scheme: 'cosmotell',
  path: 'auth',
});
