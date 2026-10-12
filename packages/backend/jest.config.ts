import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@nommable/shared$': '<rootDir>/../shared/src/index',
    '^better-auth$': '<rootDir>/src/__tests__/helpers/better-auth.jest',
    '^better-auth/plugins$': '<rootDir>/src/__tests__/helpers/better-auth.jest',
    '^better-auth/crypto$': '<rootDir>/src/__tests__/helpers/better-auth.jest',
  },
  setupFiles: ['<rootDir>/src/__tests__/envSetup.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 15000,
  verbose: true,
};

export default config;
