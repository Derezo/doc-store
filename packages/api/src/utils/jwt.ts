import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { config } from '../config.js';

export interface AccessTokenPayload extends JWTPayload {
  sub: string;
  email: string;
  role: string;
}

const SECRET = new TextEncoder().encode(config.JWT_SECRET);
const ISSUER = 'doc-store';
const ACCESS_TOKEN_EXPIRY = '15m';

/**
 * Sign an access token (JWT) with HS256.
 */
export async function signAccessToken(payload: {
  userId: string;
  email: string;
  role: string;
}): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(SECRET);
}

/**
 * Verify and decode an access token.
 */
export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, SECRET, { issuer: ISSUER });
  return payload as AccessTokenPayload;
}
