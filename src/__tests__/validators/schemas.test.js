/**
 * Unit Tests für Validation Schemas
 */

const {
    authSchemas,
    sitesSchemas,
    performanceSchemas,
    securitySchemas
} = require('../../validators/schemas');

describe('Validation Schemas', () => {
    describe('authSchemas.register', () => {
        it('should validate correct registration data', () => {
            const data = {
                email: 'test@example.com',
                password: 'SecurePass123',
                firstName: 'Max',
                lastName: 'Mustermann'
            };

            const { error, value } = authSchemas.register.validate(data);
            
            expect(error).toBeUndefined();
            expect(value.email).toBe('test@example.com');
        });

        it('should reject invalid email', () => {
            const data = {
                email: 'not-an-email',
                password: 'SecurePass123',
                firstName: 'Max',
                lastName: 'Mustermann'
            };

            const { error } = authSchemas.register.validate(data);
            
            expect(error).toBeDefined();
            expect(error.details[0].path).toContain('email');
        });

        it('should reject weak password without uppercase', () => {
            const data = {
                email: 'test@example.com',
                password: 'weakpass123',
                firstName: 'Max',
                lastName: 'Mustermann'
            };

            const { error } = authSchemas.register.validate(data);
            
            expect(error).toBeDefined();
            expect(error.details[0].path).toContain('password');
        });

        it('should reject weak password without number', () => {
            const data = {
                email: 'test@example.com',
                password: 'WeakPassword',
                firstName: 'Max',
                lastName: 'Mustermann'
            };

            const { error } = authSchemas.register.validate(data);
            
            expect(error).toBeDefined();
        });

        it('should reject short password', () => {
            const data = {
                email: 'test@example.com',
                password: 'Pass1',
                firstName: 'Max',
                lastName: 'Mustermann'
            };

            const { error } = authSchemas.register.validate(data);
            
            expect(error).toBeDefined();
        });

        it('should reject missing firstName', () => {
            const data = {
                email: 'test@example.com',
                password: 'SecurePass123',
                lastName: 'Mustermann'
            };

            const { error } = authSchemas.register.validate(data);
            
            expect(error).toBeDefined();
            expect(error.details[0].path).toContain('firstName');
        });

        it('should reject firstName with numbers', () => {
            const data = {
                email: 'test@example.com',
                password: 'SecurePass123',
                firstName: 'Max123',
                lastName: 'Mustermann'
            };

            const { error } = authSchemas.register.validate(data);
            
            expect(error).toBeDefined();
        });

        it('should allow German umlauts in names', () => {
            const data = {
                email: 'test@example.com',
                password: 'SecurePass123',
                firstName: 'Jürgen',
                lastName: 'Müller'
            };

            const { error } = authSchemas.register.validate(data);
            
            expect(error).toBeUndefined();
        });

        it('should trim and lowercase email', () => {
            const data = {
                email: '  TEST@EXAMPLE.COM  ',
                password: 'SecurePass123',
                firstName: 'Max',
                lastName: 'Mustermann'
            };

            const { value } = authSchemas.register.validate(data);
            
            expect(value.email).toBe('test@example.com');
        });
    });

    describe('authSchemas.login', () => {
        it('should validate correct login data', () => {
            const data = {
                email: 'test@example.com',
                password: 'anypassword'
            };

            const { error } = authSchemas.login.validate(data);
            
            expect(error).toBeUndefined();
        });

        it('should reject missing email', () => {
            const data = {
                password: 'anypassword'
            };

            const { error } = authSchemas.login.validate(data);
            
            expect(error).toBeDefined();
        });

        it('should reject missing password', () => {
            const data = {
                email: 'test@example.com'
            };

            const { error } = authSchemas.login.validate(data);
            
            expect(error).toBeDefined();
        });
    });

    describe('sitesSchemas.create', () => {
        it('should validate correct site data', () => {
            const data = {
                domain: 'example.com',
                siteUrl: 'https://example.com',
                siteName: 'My WordPress Site'
            };

            const { error } = sitesSchemas.create.validate(data);
            
            expect(error).toBeUndefined();
        });

        it('should reject invalid domain', () => {
            const data = {
                domain: 'not a domain',
                siteUrl: 'https://example.com'
            };

            const { error } = sitesSchemas.create.validate(data);
            
            expect(error).toBeDefined();
        });

        it('should reject invalid URL', () => {
            const data = {
                domain: 'example.com',
                siteUrl: 'not-a-url'
            };

            const { error } = sitesSchemas.create.validate(data);
            
            expect(error).toBeDefined();
        });

        it('should reject URL without protocol', () => {
            const data = {
                domain: 'example.com',
                siteUrl: 'example.com'
            };

            const { error } = sitesSchemas.create.validate(data);
            
            expect(error).toBeDefined();
        });

        it('should allow subdomains', () => {
            const data = {
                domain: 'blog.example.com',
                siteUrl: 'https://blog.example.com'
            };

            const { error } = sitesSchemas.create.validate(data);
            
            expect(error).toBeUndefined();
        });
    });

    describe('performanceSchemas.metrics', () => {
        it('should validate correct metrics data', () => {
            const data = {
                page_load_time: 1500,
                core_web_vitals: {
                    lcp: 2000,
                    fid: 50,
                    cls: 0.1
                },
                database_queries: 45,
                cache_hit_ratio: 85
            };

            const { error } = performanceSchemas.metrics.validate(data);
            
            expect(error).toBeUndefined();
        });

        it('should reject negative page load time', () => {
            const data = {
                page_load_time: -100
            };

            const { error } = performanceSchemas.metrics.validate(data);
            
            expect(error).toBeDefined();
        });

        it('should reject page load time over 60s', () => {
            const data = {
                page_load_time: 70000
            };

            const { error } = performanceSchemas.metrics.validate(data);
            
            expect(error).toBeDefined();
        });

        it('should reject cache hit ratio over 100', () => {
            const data = {
                cache_hit_ratio: 150
            };

            const { error } = performanceSchemas.metrics.validate(data);
            
            expect(error).toBeDefined();
        });

        it('should allow empty metrics object', () => {
            const data = {};

            const { error } = performanceSchemas.metrics.validate(data);
            
            expect(error).toBeUndefined();
        });
    });

    describe('securitySchemas.scan', () => {
        it('should validate correct scan data', () => {
            const data = {
                scan_type: 'full',
                ssl_enabled: true,
                debug_mode: false,
                outdated_plugins: [
                    { name: 'Plugin1', current_version: '1.0.0' }
                ]
            };

            const { error } = securitySchemas.scan.validate(data);
            
            expect(error).toBeUndefined();
        });

        it('should reject invalid scan type', () => {
            const data = {
                scan_type: 'invalid'
            };

            const { error } = securitySchemas.scan.validate(data);
            
            expect(error).toBeDefined();
        });

        it('should default scan_type to full', () => {
            const data = {};

            const { value } = securitySchemas.scan.validate(data);
            
            expect(value.scan_type).toBe('full');
        });

        it('should validate outdated plugins structure', () => {
            const data = {
                outdated_plugins: [
                    { name: 'Plugin1' } // missing current_version
                ]
            };

            const { error } = securitySchemas.scan.validate(data);
            
            expect(error).toBeDefined();
        });
    });
});


