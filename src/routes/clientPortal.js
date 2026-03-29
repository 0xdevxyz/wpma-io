/**
 * Client Portal Routes
 * Agenturen können Kunden-Accounts erstellen, die eine White-Label-Ansicht ihrer Sites bekommen
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/auth');
const {
    login,
    getMe,
    getClientSites,
    listClients,
    createClient,
    updateClient,
    deleteClient,
    getClientSiteAssignments,
    assignSitesToClient,
} = require('../controllers/clientPortalController');

async function authenticateClient(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Nicht autorisiert' });
    }
    try {
        const token = auth.slice(7);
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
        if (payload.type !== 'client') {
            return res.status(401).json({ success: false, error: 'Kein Client-Token' });
        }
        req.clientId = payload.clientId;
        req.agencyUserId = payload.agencyUserId;
        next();
    } catch {
        return res.status(401).json({ success: false, error: 'Token ungültig' });
    }
}

router.post('/login', login);

router.get('/me', authenticateClient, getMe);
router.get('/sites', authenticateClient, getClientSites);

router.use(authenticateToken);

router.get('/', listClients);
router.post('/', createClient);
router.put('/:clientId', updateClient);
router.delete('/:clientId', deleteClient);
router.get('/:clientId/sites', getClientSiteAssignments);
router.post('/:clientId/sites', assignSitesToClient);

module.exports = router;
