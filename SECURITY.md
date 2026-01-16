# Security Configuration

## 🔐 Overview

This document describes security configurations, environment variables, and security-related decisions for the Remember Me API.

---

## 🌐 Environment Variables

### CORS Configuration

```env
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,https://yourdomain.com
```

**Description:**
- Comma-separated list of allowed origins for CORS
- Default (if not set): `http://localhost:3000,http://localhost:3001`
- In production, set this to your frontend domain(s)

**Example:**
```env
CORS_ORIGINS=https://app.example.com,https://www.example.com
```

---

### Rate Limiting

Rate limiting is configured globally and per-route. The limits are hardcoded in the application but can be adjusted in the code.

**Global Limit:**
- 100 requests per minute per IP/user

**Route-Specific Limits:**
- `/api/auth/login`: 5 requests per minute per IP
- `/api/auth/register`: 3 requests per minute per IP
- `/api/pricing/compute*`: 50 requests per minute per user (authenticated)
- `/api/sales/*/pay`: 10 requests per minute per user (authenticated)
- `/api/stock/reservations`: 20 requests per minute per user (authenticated)

**How Tracking Works:**
- **Unauthenticated routes** (login, register): Tracked by IP address
  - Uses `X-Forwarded-For` header if behind proxy
  - Falls back to `req.ip` or `req.socket.remoteAddress`
- **Authenticated routes**: Tracked by `userId` (user-based throttling)
  - More accurate for authenticated users
  - Prevents IP-based limits from affecting legitimate users behind shared IPs

**Response Headers:**
When rate limit is exceeded, the API returns:
- HTTP Status: `429 Too Many Requests`
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

### Audit Log Failure Mode

```env
AUDIT_FAIL_MODE=OPEN  # or CLOSED
```

**Description:**
Controls behavior when audit logging fails (implemented in Fase 2).

- **OPEN** (default for dev/test):
  - If audit log fails: log error and continue operation
  - Useful for development where audit is not critical
  - Operations are not blocked if audit service is down

- **CLOSED** (required for prod/compliance):
  - If audit log fails: abort operation (throw error)
  - Guarantees all mutations are audited
  - Required for compliance/regulatory requirements

**Note:** This setting is prepared for Fase 2 implementation. Currently, audit logging is not yet implemented.

---

## 🔒 Security Headers (Helmet)

The API uses `helmet` middleware to set security headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HSTS) - configured by helmet
- `Content-Security-Policy` - configured by helmet

These headers are automatically applied to all responses.

---

## 🚫 Login Lockout Decision

**Status:** NOT IMPLEMENTED in Fase 1

**Decision:**
- Rate limiting (5 req/min per IP) is sufficient for basic brute force protection
- In-memory lockout is NOT implemented (not scalable, doesn't work with multiple instances)

**Future (Fase 3 - P1):**
- Implement persistent lockout with Redis or database table
- Lockout after N failed attempts (e.g., 5 attempts = 15 min lockout)
- Reset lockout after successful login

**Current Protection:**
- Rate limiting: 5 login attempts per minute per IP
- Password hashing: bcrypt with salt rounds

---

## ✅ Input Validation

All input is validated using `class-validator`:

- **Whitelist:** Only properties defined in DTOs are allowed
- **Forbid Non-Whitelisted:** Extra properties are rejected
- **Transform:** Automatic type conversion (strings to numbers, etc.)
- **Error Messages:** Disabled in production (security)

**Example:**
```typescript
class CreateLeadDto {
  @IsString()
  @IsEmail()
  email: string;
  
  @IsString()
  @MinLength(1)
  name: string;
}
```

Invalid requests return `400 Bad Request` with validation errors.

---

## 🔑 Authentication & Authorization

### JWT Tokens

- **Access Token:** 15 minutes (default)
- **Refresh Token:** 7 days (stored in database)
- **Temporary Token:** Used for organization selection

### Roles

- `OWNER`: Full access to organization
- `ADMIN`: Full access (except organization deletion)
- `MANAGER`: Full access to most resources
- `SELLER`: Limited access (read-only in some modules, can create/update own resources)

---

## 📝 Request ID Tracking

All requests include a `X-Request-Id` header:

- **Client-provided:** If `X-Request-Id` header is sent, it's used
- **Server-generated:** If not provided, a UUID v4 is generated
- **Response header:** Always included in response headers

Use this ID for:
- Log correlation
- Debugging
- Error tracking

---

## 🛡️ Security Best Practices

1. **Never commit secrets** to version control
2. **Use environment variables** for all configuration
3. **Enable HTTPS** in production
4. **Keep dependencies updated** (`pnpm audit`)
5. **Use strong passwords** (validated: min 8 chars, uppercase, lowercase, number)
6. **Rate limit sensitive endpoints**
7. **Validate all input** (DTOs with class-validator)
8. **Use parameterized queries** (Prisma handles this automatically)
9. **Log security events** (failed logins, permission denials)
10. **Monitor for anomalies** (unusual request patterns, high error rates)

---

## 🔍 Monitoring

Security-related events to monitor:

- Rate limit violations (429 responses)
- Authentication failures (401 responses)
- Authorization failures (403 responses)
- Validation errors (400 responses)
- Internal server errors (500 responses)

All requests are logged with:
- Request ID
- User ID (if authenticated)
- Organization ID (if applicable)
- IP address
- Duration
- Status code

---

## 📚 References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Helmet Documentation](https://helmetjs.github.io/)
- [NestJS Security](https://docs.nestjs.com/security/authentication)
- [Rate Limiting Best Practices](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)
