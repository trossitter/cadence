import { Auth0Provider } from '@auth0/auth0-react';
import type { ReactNode } from 'react';

interface CadenceAuthProviderProps {
  children: ReactNode;
}

const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN;
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE;

export function CadenceAuthProvider({ children }: CadenceAuthProviderProps) {
  if (!auth0Domain || !auth0ClientId || !auth0Audience) {
    return children;
  }

  return (
    <Auth0Provider
      domain={auth0Domain}
      clientId={auth0ClientId}
      authorizationParams={{
        audience: auth0Audience,
        redirect_uri: window.location.origin,
      }}
      cacheLocation="localstorage"
    >
      {children}
    </Auth0Provider>
  );
}
