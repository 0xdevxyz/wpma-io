/**
 * Unit Tests für SecurityService
 */

const SecurityService = require('../../services/securityService');

// Mock der Datenbank
jest.mock('../../config/database', () => ({
    query: jest.fn()
}));

const { query } = require('../../config/database');

describe('SecurityService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('calculateThreats', () => {
        it('should return 0 for fully secure configuration', () => {
            const scanData = {
                ssl_enabled: true,
                debug_mode: false,
                file_edit_disabled: true,
                admin_username: 'custom_admin',
                failed_logins: 5,
                outdated_plugins: []
            };

            const threats = SecurityService.calculateThreats(scanData);
            expect(threats).toBe(0);
        });

        it('should count SSL missing as threat', () => {
            const scanData = {
                ssl_enabled: false,
                debug_mode: false,
                file_edit_disabled: true,
                admin_username: 'custom_admin',
                failed_logins: 0
            };

            const threats = SecurityService.calculateThreats(scanData);
            expect(threats).toBe(1);
        });

        it('should count debug mode as threat', () => {
            const scanData = {
                ssl_enabled: true,
                debug_mode: true,
                file_edit_disabled: true,
                admin_username: 'custom_admin',
                failed_logins: 0
            };

            const threats = SecurityService.calculateThreats(scanData);
            expect(threats).toBe(1);
        });

        it('should count admin username as threat', () => {
            const scanData = {
                ssl_enabled: true,
                debug_mode: false,
                file_edit_disabled: true,
                admin_username: 'admin',
                failed_logins: 0
            };

            const threats = SecurityService.calculateThreats(scanData);
            expect(threats).toBe(1);
        });

        it('should count high failed logins as threat', () => {
            const scanData = {
                ssl_enabled: true,
                debug_mode: false,
                file_edit_disabled: true,
                admin_username: 'custom_admin',
                failed_logins: 15
            };

            const threats = SecurityService.calculateThreats(scanData);
            expect(threats).toBe(1);
        });

        it('should count outdated plugins as threats', () => {
            const scanData = {
                ssl_enabled: true,
                debug_mode: false,
                file_edit_disabled: true,
                admin_username: 'custom_admin',
                failed_logins: 0,
                outdated_plugins: [
                    { name: 'Plugin1', current_version: '1.0' },
                    { name: 'Plugin2', current_version: '2.0' }
                ]
            };

            const threats = SecurityService.calculateThreats(scanData);
            expect(threats).toBe(2);
        });

        it('should count all threats cumulatively', () => {
            const scanData = {
                ssl_enabled: false,
                debug_mode: true,
                file_edit_disabled: false,
                admin_username: 'admin',
                failed_logins: 20,
                outdated_plugins: [
                    { name: 'Plugin1', current_version: '1.0' }
                ]
            };

            const threats = SecurityService.calculateThreats(scanData);
            expect(threats).toBe(6); // 1+1+1+1+1+1
        });
    });

    describe('calculateSecurityScore', () => {
        it('should return 100 for perfect security', () => {
            const scanData = {
                ssl_enabled: true,
                debug_mode: false,
                file_edit_disabled: true,
                admin_username: 'custom_admin',
                failed_logins: 0,
                outdated_plugins: []
            };

            const score = SecurityService.calculateSecurityScore(scanData);
            expect(score).toBe(100);
        });

        it('should deduct 20 points for missing SSL', () => {
            const scanData = {
                ssl_enabled: false,
                debug_mode: false,
                file_edit_disabled: true,
                admin_username: 'custom_admin',
                failed_logins: 0
            };

            const score = SecurityService.calculateSecurityScore(scanData);
            expect(score).toBe(80);
        });

        it('should deduct 15 points for debug mode', () => {
            const scanData = {
                ssl_enabled: true,
                debug_mode: true,
                file_edit_disabled: true,
                admin_username: 'custom_admin',
                failed_logins: 0
            };

            const score = SecurityService.calculateSecurityScore(scanData);
            expect(score).toBe(85);
        });

        it('should never return below 0', () => {
            const scanData = {
                ssl_enabled: false,        // -20
                debug_mode: true,          // -15
                file_edit_disabled: false, // -10
                admin_username: 'admin',   // -10
                failed_logins: 100,        // -15
                outdated_plugins: Array(10).fill({ name: 'Plugin' }) // -20 (capped)
            };

            const score = SecurityService.calculateSecurityScore(scanData);
            expect(score).toBe(10); // 100 - 20 - 15 - 10 - 10 - 15 - 20 = 10
        });

        it('should cap outdated plugins penalty at 20', () => {
            const scanData = {
                ssl_enabled: true,
                debug_mode: false,
                file_edit_disabled: true,
                admin_username: 'custom_admin',
                failed_logins: 0,
                outdated_plugins: Array(100).fill({ name: 'Plugin' }) // Would be 500 points
            };

            const score = SecurityService.calculateSecurityScore(scanData);
            expect(score).toBe(80); // Only -20 for plugins
        });
    });

    describe('saveScanResults', () => {
        it('should save scan results to database', async () => {
            const mockResult = {
                rows: [{
                    id: 1,
                    site_id: 'site-123',
                    scan_type: 'full',
                    status: 'completed',
                    threats_found: 2,
                    created_at: new Date()
                }]
            };

            query.mockResolvedValueOnce(mockResult);
            query.mockResolvedValueOnce({ rows: [{ health_score: 50 }] });
            query.mockResolvedValueOnce({ rows: [] });

            const scanData = {
                scan_type: 'full',
                ssl_enabled: true,
                debug_mode: true,
                scan_duration: 1500
            };

            const result = await SecurityService.saveScanResults('site-123', scanData);

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(query).toHaveBeenCalledTimes(3);
        });

        it('should handle database errors gracefully', async () => {
            query.mockRejectedValueOnce(new Error('Database connection failed'));

            const result = await SecurityService.saveScanResults('site-123', {});

            expect(result.success).toBe(false);
            expect(result.error).toBe('Database connection failed');
        });
    });

    describe('getLatestScan', () => {
        it('should return latest scan for site', async () => {
            const mockScan = {
                id: 1,
                site_id: 'site-123',
                scan_type: 'full',
                status: 'completed',
                created_at: new Date()
            };

            query.mockResolvedValueOnce({ rows: [mockScan] });

            const result = await SecurityService.getLatestScan('site-123');

            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockScan);
        });

        it('should return error when no scans exist', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const result = await SecurityService.getLatestScan('site-123');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Keine Security-Scans verfügbar');
        });
    });

    describe('checkSSL', () => {
        it('should detect HTTPS URLs as SSL enabled', async () => {
            const result = await SecurityService.checkSSL('https://example.com');
            
            expect(result.enabled).toBe(true);
            expect(result.valid).toBe(true);
        });

        it('should detect HTTP URLs as SSL disabled', async () => {
            const result = await SecurityService.checkSSL('http://example.com');
            
            expect(result.enabled).toBe(false);
            expect(result.valid).toBe(true);
        });

        it('should handle invalid URLs', async () => {
            const result = await SecurityService.checkSSL('not-a-url');
            
            expect(result.enabled).toBe(false);
            expect(result.valid).toBe(false);
        });
    });
});


