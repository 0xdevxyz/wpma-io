/**
 * Validierungs-Middleware für Express
 * 
 * Verwendet Joi-Schemas um Request-Daten zu validieren
 * und gibt detaillierte Fehlermeldungen zurück.
 */

/**
 * Erstellt eine Validierungs-Middleware für ein Joi-Schema
 * 
 * @param {Object} schema - Joi Schema
 * @param {string} property - Request-Property ('body', 'query', 'params')
 * @returns {Function} Express Middleware
 */
const validate = (schema, property = 'body') => {
    return (req, res, next) => {
        const dataToValidate = req[property];
        
        const { error, value } = schema.validate(dataToValidate, {
            abortEarly: false,      // Alle Fehler sammeln, nicht beim ersten stoppen
            stripUnknown: true,     // Unbekannte Felder entfernen
            convert: true           // Typ-Konvertierung erlauben (z.B. "5" -> 5)
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                type: detail.type
            }));

            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                errors: errors,
                message: errors.map(e => e.message).join(', ')
            });
        }

        // Validierte und bereinigte Daten zurück in Request schreiben
        req[property] = value;
        next();
    };
};

/**
 * Validiert mehrere Request-Properties gleichzeitig
 * 
 * @param {Object} schemas - { body: schema, query: schema, params: schema }
 * @returns {Function} Express Middleware
 */
const validateMultiple = (schemas) => {
    return (req, res, next) => {
        const allErrors = [];

        for (const [property, schema] of Object.entries(schemas)) {
            if (!schema) continue;
            
            const dataToValidate = req[property];
            const { error, value } = schema.validate(dataToValidate, {
                abortEarly: false,
                stripUnknown: true,
                convert: true
            });

            if (error) {
                const errors = error.details.map(detail => ({
                    field: `${property}.${detail.path.join('.')}`,
                    message: detail.message,
                    type: detail.type
                }));
                allErrors.push(...errors);
            } else {
                req[property] = value;
            }
        }

        if (allErrors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                errors: allErrors,
                message: allErrors.map(e => e.message).join(', ')
            });
        }

        next();
    };
};

/**
 * Sanitize-Middleware für XSS-Schutz
 * Entfernt potenziell gefährliche HTML/Script-Tags
 */
const sanitize = (req, res, next) => {
    const sanitizeValue = (value) => {
        if (typeof value === 'string') {
            // Einfache XSS-Prävention: Script-Tags entfernen
            return value
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<[^>]*>/g, '')
                .trim();
        }
        if (Array.isArray(value)) {
            return value.map(sanitizeValue);
        }
        if (value && typeof value === 'object') {
            const sanitized = {};
            for (const [key, val] of Object.entries(value)) {
                sanitized[key] = sanitizeValue(val);
            }
            return sanitized;
        }
        return value;
    };

    if (req.body) {
        req.body = sanitizeValue(req.body);
    }
    if (req.query) {
        req.query = sanitizeValue(req.query);
    }

    next();
};

module.exports = {
    validate,
    validateMultiple,
    sanitize
};


