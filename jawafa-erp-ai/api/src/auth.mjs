import { createRemoteJWKSet, jwtVerify } from 'jose';

const HTTPS = /^https:\/\//i;
const TEST_LOCAL_HTTP = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i;

/** Verify OIDC signatures, issuer, audience and short-lived exp. */
export function createOidcVerifier(config) {
  const { issuer, audience, jwksUrl, allowLocalHttpJwks = false } = config;
  if (!issuer || !audience || !jwksUrl) {
    throw new Error('OIDC_ISSUER_AUDIENCE_AND_JWKS_REQUIRED');
  }
  if (!HTTPS.test(issuer)) throw new Error('OIDC_ISSUER_HTTPS_REQUIRED');
  if (!HTTPS.test(jwksUrl) &&
      !(allowLocalHttpJwks && TEST_LOCAL_HTTP.test(jwksUrl))) {
    throw new Error('OIDC_JWKS_HTTPS_REQUIRED');
  }
  const jwks = createRemoteJWKSet(new URL(jwksUrl), { timeoutDuration: 3000 });
  return async (authorizationHeader) => {
    if (typeof authorizationHeader !== 'string' ||
        !/^Bearer [A-Za-z0-9_\-.]+$/i.test(authorizationHeader)) {
      throw new Error('MISSING_OR_INVALID_BEARER');
    }
    const { payload } = await jwtVerify(authorizationHeader.slice(7), jwks, {
      issuer, audience, algorithms: ['RS256'], clockTolerance: 5,
      requiredClaims: ['sub', 'iat', 'exp'],
    });
    if (typeof payload.sub !== 'string' ||
        payload.sub.length === 0 || payload.sub.length > 255) {
      throw new Error('OIDC_SUBJECT_INVALID');
    }
    return { subject: payload.sub };
  };
}
