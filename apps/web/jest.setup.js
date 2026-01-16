// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Set default env vars for tests
process.env.NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';
process.env.NEXT_PUBLIC_APP_ENV = process.env.NEXT_PUBLIC_APP_ENV || 'dev';
