import fc from 'fast-check';
import { hashPassword, generateToken, verifyToken } from '../utils/security';
import jwt from 'jsonwebtoken';

describe('Security Property Tests', () => {
  // Property 35: Password Hashing
  it('Property 35: Verify all stored passwords use bcrypt with 12+ salt rounds', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 100 }), async (password) => {
        const hash = await hashPassword(password);
        // bcrypt hashes with 12 rounds start with $2a$12$ or $2b$12$
        expect(hash).toMatch(/^\$2[aby]\$12\$/);
      }),
      { numRuns: 10 }
    );
  }, 30000);

  // Property 36: JWT Expiration
  it('Property 36: Verify all issued JWTs expire 7 days after issuance', () => {
    fc.assert(
      fc.property(fc.uuid(), (userId) => {
        const token = generateToken(userId);
        const decoded = jwt.decode(token) as jwt.JwtPayload;
        
        expect(decoded).not.toBeNull();
        expect(decoded.exp).toBeDefined();
        expect(decoded.iat).toBeDefined();
        
        // 7 days = 7 * 24 * 60 * 60 = 604800 seconds
        const expirationDiff = decoded.exp! - decoded.iat!;
        expect(expirationDiff).toBe(604800);
      })
    );
  });

  // Property 40: JWT Validation
  it('Property 40: Verify invalid tokens are rejected', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 10 }), (invalidToken) => {
        expect(() => verifyToken(invalidToken)).toThrow();
      })
    );
  });
});
