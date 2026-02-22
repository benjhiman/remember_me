/**
 * Redacts sensitive data from objects to prevent exposure in audit logs
 */
export function redactSensitiveData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(redactSensitiveData);
  }

  const sensitiveKeys = [
    'password',
    'passwordHash',
    'token',
    'accessToken',
    'refreshToken',
    'authorization',
    'authorizationHeader',
    'apiKey',
    'secret',
    'secretKey',
    'privateKey',
    'creditCard',
    'cardNumber',
    'cvv',
    'ssn',
    'socialSecurityNumber',
  ];

  const redacted: any = {};

  for (const [key, value] of Object.entries(data)) {
    const keyLower = key.toLowerCase();

    // Check if key contains sensitive terms
    const isSensitive = sensitiveKeys.some((sensitiveKey) =>
      keyLower.includes(sensitiveKey.toLowerCase()),
    );

    if (isSensitive) {
      redacted[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      // Recursively redact nested objects
      redacted[key] = redactSensitiveData(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}
