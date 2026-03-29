jest.mock('../../config/database', () => ({
    query: jest.fn()
}));

jest.mock('aws-sdk', () => {
    const mockS3 = { deleteObject: jest.fn().mockReturnThis(), promise: jest.fn().mockResolvedValue({}) };
    return { S3: jest.fn(() => mockS3) };
});

const { query } = require('../../config/database');
const backupService = require('../../services/backupService');

describe('BackupService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getBackups', () => {
        it('should return mapped backup list for a valid siteId', async () => {
            const rows = [
                {
                    id: 1,
                    site_id: 'site-1',
                    backup_type: 'full',
                    status: 'completed',
                    file_size: '204800',
                    s3_url: 'https://bucket/backup.zip',
                    error_message: null,
                    provider: 'aws',
                    created_at: new Date('2026-01-01'),
                    completed_at: new Date('2026-01-01')
                }
            ];
            query.mockResolvedValueOnce({ rows });

            const result = await backupService.getBackups('site-1');

            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(1);
            expect(result.data[0].siteId).toBe('site-1');
            expect(result.data[0].fileSize).toBe(204800);
            expect(result.data[0].backupType).toBe('full');
            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE site_id = $1'),
                ['site-1']
            );
        });

        it('should return empty array when no backups exist', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const result = await backupService.getBackups('site-empty');

            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(0);
        });

        it('should handle database errors gracefully', async () => {
            query.mockRejectedValueOnce(new Error('DB unavailable'));

            const result = await backupService.getBackups('site-1');

            expect(result.success).toBe(false);
            expect(result.error).toBe('DB unavailable');
        });
    });

    describe('createBackup', () => {
        it('should return error when bucket is not configured', async () => {
            const originalBucket = process.env.AWS_S3_BUCKET;
            delete process.env.AWS_S3_BUCKET;
            delete process.env.IDRIVE_E2_ACCESS_KEY;
            delete process.env.IDRIVE_E2_BUCKET;

            const result = await backupService.createBackup('site-1', 'full', 'aws', null);

            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Backup-Bucket nicht konfiguriert/);

            process.env.AWS_S3_BUCKET = originalBucket;
        });

        it('should return error when site is not found', async () => {
            process.env.AWS_S3_BUCKET = 'test-bucket';

            query.mockResolvedValueOnce({ rows: [] });

            const result = await backupService.createBackup('nonexistent-site', 'full', 'aws', null);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Site not found');
        });
    });

    describe('enforceQuota', () => {
        it('should delete oldest backups when site limit is exceeded', async () => {
            const quota = {
                user_id: 'user-1',
                max_backups_per_site: 2,
                quota_bytes: 1000000000,
                tier: 'free'
            };

            query
                // getOrCreateQuota
                .mockResolvedValueOnce({ rows: [quota] })
                // siteBackups (3 exist, limit 2 → delete 2)
                .mockResolvedValueOnce({
                    rows: [
                        { id: 10, file_size: 100 },
                        { id: 11, file_size: 100 },
                        { id: 12, file_size: 100 }
                    ]
                })
                // deleteBackup(10) – SELECT
                .mockResolvedValueOnce({ rows: [{ id: 10, file_size: 100, s3_url: null, provider: 'aws' }] })
                // deleteBackup(10) – DELETE
                .mockResolvedValueOnce({ rows: [] })
                // deleteBackup(11) – SELECT
                .mockResolvedValueOnce({ rows: [{ id: 11, file_size: 100, s3_url: null, provider: 'aws' }] })
                // deleteBackup(11) – DELETE
                .mockResolvedValueOnce({ rows: [] })
                // usedResult (total under quota)
                .mockResolvedValueOnce({ rows: [{ total: '100' }] });

            const result = await backupService.enforceQuota('site-1', 'user-1');

            expect(result.success).toBe(true);
            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM backups WHERE id = $1'),
                [10]
            );
        });
    });
});
