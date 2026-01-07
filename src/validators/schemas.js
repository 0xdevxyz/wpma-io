/**
 * Joi Validierungsschemas für WPMA.io API
 * 
 * Diese Schemas validieren alle eingehenden API-Requests
 * und verhindern ungültige oder bösartige Eingaben.
 */

const Joi = require('joi');

// ============================================
// Gemeinsame Schemas
// ============================================

const emailSchema = Joi.string()
    .email({ tlds: { allow: false } })
    .lowercase()
    .trim()
    .max(255)
    .required()
    .messages({
        'string.email': 'Bitte gib eine gültige E-Mail-Adresse ein',
        'string.empty': 'E-Mail ist erforderlich',
        'string.max': 'E-Mail darf maximal 255 Zeichen lang sein'
    });

const passwordSchema = Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
        'string.min': 'Passwort muss mindestens 8 Zeichen lang sein',
        'string.max': 'Passwort darf maximal 128 Zeichen lang sein',
        'string.pattern.base': 'Passwort muss mindestens einen Kleinbuchstaben, einen Großbuchstaben und eine Zahl enthalten',
        'string.empty': 'Passwort ist erforderlich'
    });

const idSchema = Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
        'number.base': 'ID muss eine Zahl sein',
        'number.positive': 'ID muss positiv sein'
    });

const uuidSchema = Joi.string()
    .uuid({ version: 'uuidv4' })
    .messages({
        'string.guid': 'Ungültige UUID'
    });

// ============================================
// Auth Schemas
// ============================================

const authSchemas = {
    register: Joi.object({
        email: emailSchema,
        password: passwordSchema,
        firstName: Joi.string()
            .trim()
            .min(1)
            .max(100)
            .pattern(/^[a-zA-ZäöüÄÖÜß\s-]+$/)
            .required()
            .messages({
                'string.empty': 'Vorname ist erforderlich',
                'string.max': 'Vorname darf maximal 100 Zeichen lang sein',
                'string.pattern.base': 'Vorname darf nur Buchstaben enthalten'
            }),
        lastName: Joi.string()
            .trim()
            .min(1)
            .max(100)
            .pattern(/^[a-zA-ZäöüÄÖÜß\s-]+$/)
            .required()
            .messages({
                'string.empty': 'Nachname ist erforderlich',
                'string.max': 'Nachname darf maximal 100 Zeichen lang sein',
                'string.pattern.base': 'Nachname darf nur Buchstaben enthalten'
            })
    }),

    login: Joi.object({
        email: emailSchema,
        password: Joi.string().required().messages({
            'string.empty': 'Passwort ist erforderlich'
        })
    })
};

// ============================================
// Sites Schemas
// ============================================

const sitesSchemas = {
    create: Joi.object({
        domain: Joi.string()
            .trim()
            .max(255)
            .pattern(/^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/)
            .required()
            .messages({
                'string.empty': 'Domain ist erforderlich',
                'string.pattern.base': 'Ungültige Domain (z.B. example.com)'
            }),
        siteUrl: Joi.string()
            .uri({ scheme: ['http', 'https'] })
            .required()
            .messages({
                'string.uri': 'Ungültige URL (muss mit http:// oder https:// beginnen)'
            }),
        siteName: Joi.string()
            .trim()
            .max(255)
            .optional()
    }),

    update: Joi.object({
        siteName: Joi.string().trim().max(255).optional(),
        siteUrl: Joi.string().uri({ scheme: ['http', 'https'] }).optional(),
        status: Joi.string().valid('active', 'inactive', 'maintenance').optional()
    }),

    params: Joi.object({
        id: idSchema,
        siteId: idSchema.optional()
    })
};

// ============================================
// Performance Schemas
// ============================================

const performanceSchemas = {
    metrics: Joi.object({
        page_load_time: Joi.number().min(0).max(60000).optional(),
        core_web_vitals: Joi.object({
            lcp: Joi.number().min(0).max(60000).optional(),
            fid: Joi.number().min(0).max(10000).optional(),
            cls: Joi.number().min(0).max(10).optional(),
            ttfb: Joi.number().min(0).max(60000).optional(),
            inp: Joi.number().min(0).max(10000).optional()
        }).optional(),
        database_queries: Joi.number().integer().min(0).max(10000).optional(),
        database_size: Joi.number().min(0).optional(),
        cache_hit_ratio: Joi.number().min(0).max(100).optional(),
        memory_usage: Joi.number().min(0).optional()
    }),

    query: Joi.object({
        days: Joi.number().integer().min(1).max(365).default(7),
        limit: Joi.number().integer().min(1).max(1000).default(100)
    })
};

// ============================================
// Security Schemas
// ============================================

const securitySchemas = {
    scan: Joi.object({
        scan_type: Joi.string().valid('full', 'quick', 'automated').default('full'),
        ssl_enabled: Joi.boolean().optional(),
        debug_mode: Joi.boolean().optional(),
        file_edit_disabled: Joi.boolean().optional(),
        admin_username: Joi.string().max(100).optional(),
        failed_logins: Joi.number().integer().min(0).optional(),
        outdated_plugins: Joi.array().items(
            Joi.object({
                name: Joi.string().max(255).required(),
                current_version: Joi.string().max(50).required(),
                latest_version: Joi.string().max(50).optional()
            })
        ).optional(),
        outdated_themes: Joi.array().items(
            Joi.object({
                name: Joi.string().max(255).required(),
                current_version: Joi.string().max(50).required()
            })
        ).optional(),
        file_permissions: Joi.object().optional(),
        security_plugins: Joi.array().items(Joi.string().max(255)).optional(),
        two_factor_enabled: Joi.boolean().optional(),
        scan_duration: Joi.number().min(0).optional()
    }),

    query: Joi.object({
        limit: Joi.number().integer().min(1).max(100).default(10)
    })
};

// ============================================
// Monitoring Schemas
// ============================================

const monitoringSchemas = {
    query: Joi.object({
        hours: Joi.number().integer().min(1).max(8760).default(24),
        limit: Joi.number().integer().min(1).max(1000).default(100)
    })
};

// ============================================
// Backup Schemas
// ============================================

const backupSchemas = {
    create: Joi.object({
        backup_type: Joi.string().valid('full', 'database', 'files').default('full'),
        description: Joi.string().max(500).optional()
    }),

    restore: Joi.object({
        backup_id: idSchema,
        target_site_id: idSchema.optional()
    })
};

// ============================================
// Pagination Schema
// ============================================

const paginationSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().valid('asc', 'desc').default('desc'),
    sortBy: Joi.string().max(50).optional()
});

module.exports = {
    authSchemas,
    sitesSchemas,
    performanceSchemas,
    securitySchemas,
    monitoringSchemas,
    backupSchemas,
    paginationSchema,
    // Einzelne Schemas für Wiederverwendung
    emailSchema,
    passwordSchema,
    idSchema,
    uuidSchema
};


