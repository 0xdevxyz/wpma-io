# TESTING.md — Testing Structure & Practices

## Framework

- **Jest** ^30.0.4 — test runner
- **Supertest** ^6.3.3 — HTTP integration testing
- Config: `jest.config.js`

## Test Location

```
src/__tests__/
├── setup.js                          # Global setup (Jest setupFilesAfterEnv)
├── validators/
│   └── schemas.test.js               # Joi schema validation tests
└── services/
    ├── securityService.test.js
    └── performanceService.test.js
```

No frontend tests found. No e2e test framework detected (Playwright/Cypress absent from deps).

## Jest Configuration

```js
// jest.config.js
{
    testEnvironment: 'node',
    testMatch: ['**/src/__tests__/**/*.test.js', '**/src/**/*.spec.js'],
    coverageThreshold: {
        global: { branches: 50, functions: 50, lines: 50, statements: 50 }
    },
    setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.js'],
    forceExit: true,
    detectOpenHandles: true,
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 10000
}
```

## Test Scripts

```bash
npm test          # Run all tests
npm run test:api  # Run node test/test.js (manual API test)
```

## Coverage

- Threshold: 50% branches/functions/lines/statements
- Report formats: text, text-summary, lcov, html
- Output directory: `coverage/`
- Excluded: `src/__tests__/**`, `src/index.js`, `src/config/**`

## Mocking

- `clearMocks: true` and `restoreMocks: true` in config — mocks cleared between tests
- No dedicated mock directory found
- Tests likely mock DB (`pg`) and Redis to avoid real connections

## Test Coverage Gaps

- No frontend tests (no Jest/Vitest/Playwright in frontend deps)
- Only 3 test files present for a 35-service codebase
- No integration tests for API routes observed
- Manual test script exists: `node test/test.js` (not in version control test dir)

## Running Tests

```bash
cd /home/clawd/saas/wpma-io
npm test
npm test -- --coverage
npm test -- --testPathPattern=securityService
```
