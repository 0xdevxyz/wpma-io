/**
 * Unit Tests für PerformanceService
 */

const PerformanceService = require('../../services/performanceService');

// Mock der Datenbank
jest.mock('../../config/database', () => ({
    query: jest.fn()
}));

const { query } = require('../../config/database');

describe('PerformanceService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('calculatePerformanceScore', () => {
        it('should return 100 for optimal performance', () => {
            const metrics = {
                page_load_time: 500,
                database_queries: 20,
                cache_hit_ratio: 90,
                core_web_vitals: {
                    lcp: 1000,
                    fid: 50,
                    cls: 0.05
                }
            };

            const score = PerformanceService.calculatePerformanceScore(metrics);
            expect(score).toBe(100);
        });

        it('should deduct points for slow page load (>3s)', () => {
            const metrics = {
                page_load_time: 3500,
                database_queries: 20,
                cache_hit_ratio: 90
            };

            const score = PerformanceService.calculatePerformanceScore(metrics);
            expect(score).toBe(70); // -30 for >3s
        });

        it('should deduct points for medium page load (2-3s)', () => {
            const metrics = {
                page_load_time: 2500,
                database_queries: 20,
                cache_hit_ratio: 90
            };

            const score = PerformanceService.calculatePerformanceScore(metrics);
            expect(score).toBe(80); // -20 for >2s
        });

        it('should deduct points for slow page load (1-2s)', () => {
            const metrics = {
                page_load_time: 1500,
                database_queries: 20,
                cache_hit_ratio: 90
            };

            const score = PerformanceService.calculatePerformanceScore(metrics);
            expect(score).toBe(90); // -10 for >1s
        });

        it('should deduct points for high database queries', () => {
            const metrics = {
                page_load_time: 500,
                database_queries: 150,
                cache_hit_ratio: 90
            };

            const score = PerformanceService.calculatePerformanceScore(metrics);
            expect(score).toBe(80); // -20 for >100 queries
        });

        it('should deduct points for low cache hit ratio', () => {
            const metrics = {
                page_load_time: 500,
                database_queries: 20,
                cache_hit_ratio: 40
            };

            const score = PerformanceService.calculatePerformanceScore(metrics);
            expect(score).toBe(80); // -20 for <50%
        });

        it('should deduct points for bad Core Web Vitals LCP', () => {
            const metrics = {
                page_load_time: 500,
                core_web_vitals: {
                    lcp: 5000, // >4s is bad
                    fid: 50,
                    cls: 0.05
                }
            };

            const score = PerformanceService.calculatePerformanceScore(metrics);
            expect(score).toBe(90); // -10 for bad LCP
        });

        it('should deduct points for bad Core Web Vitals FID', () => {
            const metrics = {
                page_load_time: 500,
                core_web_vitals: {
                    lcp: 1000,
                    fid: 400, // >300ms is bad
                    cls: 0.05
                }
            };

            const score = PerformanceService.calculatePerformanceScore(metrics);
            expect(score).toBe(90); // -10 for bad FID
        });

        it('should deduct points for bad Core Web Vitals CLS', () => {
            const metrics = {
                page_load_time: 500,
                core_web_vitals: {
                    lcp: 1000,
                    fid: 50,
                    cls: 0.3 // >0.25 is bad
                }
            };

            const score = PerformanceService.calculatePerformanceScore(metrics);
            expect(score).toBe(90); // -10 for bad CLS
        });

        it('should handle JSON string core_web_vitals', () => {
            const metrics = {
                page_load_time: 500,
                core_web_vitals: JSON.stringify({
                    lcp: 5000,
                    fid: 50,
                    cls: 0.05
                })
            };

            const score = PerformanceService.calculatePerformanceScore(metrics);
            expect(score).toBe(90); // -10 for bad LCP
        });

        it('should never return below 0', () => {
            const metrics = {
                page_load_time: 10000,   // -30
                database_queries: 200,   // -20
                cache_hit_ratio: 10,     // -20
                core_web_vitals: {
                    lcp: 10000,          // -10
                    fid: 1000,           // -10
                    cls: 1.0             // -10
                }
            };

            const score = PerformanceService.calculatePerformanceScore(metrics);
            expect(score).toBe(0);
        });
    });

    describe('saveMetrics', () => {
        it('should save metrics to database', async () => {
            const mockResult = {
                rows: [{
                    id: 1,
                    site_id: 'site-123',
                    page_load_time: 1500,
                    created_at: new Date()
                }]
            };

            query.mockResolvedValueOnce(mockResult);

            const metrics = {
                page_load_time: 1500,
                core_web_vitals: { lcp: 2000 },
                database_queries: 45
            };

            const result = await PerformanceService.saveMetrics('site-123', metrics);

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(query).toHaveBeenCalledTimes(1);
        });

        it('should handle database errors gracefully', async () => {
            query.mockRejectedValueOnce(new Error('Database error'));

            const result = await PerformanceService.saveMetrics('site-123', {});

            expect(result.success).toBe(false);
            expect(result.error).toBe('Database error');
        });
    });

    describe('getCurrentMetrics', () => {
        it('should return current metrics with score', async () => {
            const mockMetrics = {
                id: 1,
                site_id: 'site-123',
                page_load_time: 1500,
                database_queries: 30,
                cache_hit_ratio: 80,
                core_web_vitals: { lcp: 2000 }
            };

            query.mockResolvedValueOnce({ rows: [mockMetrics] });

            const result = await PerformanceService.getCurrentMetrics('site-123');

            expect(result.success).toBe(true);
            expect(result.data.performance_score).toBeDefined();
            expect(result.data.performance_score).toBeGreaterThanOrEqual(0);
            expect(result.data.performance_score).toBeLessThanOrEqual(100);
        });

        it('should return error when no metrics exist', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const result = await PerformanceService.getCurrentMetrics('site-123');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Keine Performance-Daten verfügbar');
        });
    });

    describe('average helper', () => {
        it('should calculate average correctly', () => {
            expect(PerformanceService.average([1, 2, 3, 4, 5])).toBe(3);
            expect(PerformanceService.average([10, 20])).toBe(15);
        });

        it('should return null for empty array', () => {
            expect(PerformanceService.average([])).toBeNull();
        });
    });

    describe('groupMetricsByHour', () => {
        it('should group metrics by hour', () => {
            const now = new Date();
            const metrics = [
                { hour: now, page_load_time: 1000 },
                { hour: now, page_load_time: 2000 }
            ];

            const grouped = PerformanceService.groupMetricsByHour(metrics);

            expect(grouped.length).toBe(1);
            expect(grouped[0].avg_page_load_time).toBe(1500);
        });

        it('should handle empty metrics', () => {
            const grouped = PerformanceService.groupMetricsByHour([]);
            expect(grouped).toEqual([]);
        });
    });
});


