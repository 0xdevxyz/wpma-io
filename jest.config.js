/**
 * Jest Konfiguration für WPMA.io
 */

module.exports = {
    // Test-Umgebung
    testEnvironment: 'node',

    // Test-Dateien Patterns
    testMatch: [
        '**/src/__tests__/**/*.test.js',
        '**/src/**/*.spec.js'
    ],

    // Dateien ignorieren
    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '/build/'
    ],

    // Coverage-Einstellungen
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/__tests__/**',
        '!src/index.js',
        '!src/config/**'
    ],

    coverageThreshold: {
        global: {
            branches: 50,
            functions: 50,
            lines: 50,
            statements: 50
        }
    },

    coverageReporters: [
        'text',
        'text-summary',
        'lcov',
        'html'
    ],

    coverageDirectory: 'coverage',

    // Verbose Output
    verbose: true,

    // Timeout für Tests
    testTimeout: 10000,

    // Setup-Dateien
    setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.js'],

    // Module Aliases (falls benötigt)
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1'
    },

    // Clear Mocks automatisch
    clearMocks: true,

    // Restore Mocks automatisch
    restoreMocks: true,

    // Fehler bei Console Warnings
    // errorOnDeprecated: true,

    // Force Exit nach Tests (für CI)
    forceExit: true,

    // Detect Open Handles
    detectOpenHandles: true
};


