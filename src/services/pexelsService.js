const https = require('https');
const { logger } = require('../utils/logger');

const PEXELS_BASE_URL = 'https://api.pexels.com/v1';

class PexelsService {
    constructor() {
        this.apiKey = process.env.PEXELS_API_KEY;
        this.isConfigured = Boolean(this.apiKey);
        if (!this.isConfigured) {
            logger.warn('PexelsService: PEXELS_API_KEY nicht gesetzt');
        }
    }

    _request(path) {
        return new Promise((resolve, reject) => {
            const url = new URL(PEXELS_BASE_URL + path);
            const options = {
                hostname: url.hostname,
                path: url.pathname + url.search,
                method: 'GET',
                headers: {
                    Authorization: this.apiKey,
                    'User-Agent': 'wpma.io/1.0',
                },
                timeout: 10000,
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(JSON.parse(data));
                        } else {
                            reject(new Error(`Pexels API ${res.statusCode}: ${data}`));
                        }
                    } catch (e) {
                        reject(new Error(`Pexels parse error: ${e.message}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Pexels request timeout')); });
            req.end();
        });
    }

    _normalizePhoto(photo) {
        return {
            pexels_id: String(photo.id),
            url: photo.src?.large2x || photo.src?.large || photo.src?.original,
            thumbnail_url: photo.src?.medium || photo.src?.small,
            alt_text: photo.alt || '',
            photographer: photo.photographer,
            photographer_url: photo.photographer_url,
            width: photo.width,
            height: photo.height,
        };
    }

    // Bilder nach Keyword suchen
    async searchPhotos(query, { perPage = 15, page = 1, orientation = 'landscape' } = {}) {
        if (!this.isConfigured) {
            return { success: false, error: 'Pexels API Key nicht konfiguriert' };
        }

        try {
            const params = new URLSearchParams({
                query,
                per_page: Math.min(perPage, 80),
                page,
                ...(orientation && { orientation }),
            });

            const data = await this._request(`/search?${params}`);

            return {
                success: true,
                data: {
                    photos: (data.photos || []).map(p => this._normalizePhoto(p)),
                    total_results: data.total_results,
                    page: data.page,
                    per_page: data.per_page,
                    next_page: data.next_page || null,
                },
            };
        } catch (error) {
            logger.error('Pexels search error', { query, error: error.message });
            return { success: false, error: error.message };
        }
    }

    // Kuratierte Fotos (Trending)
    async getCuratedPhotos({ perPage = 15, page = 1 } = {}) {
        if (!this.isConfigured) {
            return { success: false, error: 'Pexels API Key nicht konfiguriert' };
        }

        try {
            const params = new URLSearchParams({ per_page: Math.min(perPage, 80), page });
            const data = await this._request(`/curated?${params}`);

            return {
                success: true,
                data: {
                    photos: (data.photos || []).map(p => this._normalizePhoto(p)),
                    page: data.page,
                    per_page: data.per_page,
                },
            };
        } catch (error) {
            logger.error('Pexels curated error', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    // Einzelnes Foto per ID
    async getPhoto(pexelsId) {
        if (!this.isConfigured) {
            return { success: false, error: 'Pexels API Key nicht konfiguriert' };
        }

        try {
            const data = await this._request(`/photos/${pexelsId}`);
            return { success: true, data: this._normalizePhoto(data) };
        } catch (error) {
            logger.error('Pexels getPhoto error', { pexelsId, error: error.message });
            return { success: false, error: error.message };
        }
    }
}

module.exports = new PexelsService();
