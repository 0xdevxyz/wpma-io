const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const contentController = require('../controllers/contentController');

router.use(authenticateToken);

router.get('/projects', contentController.listProjects.bind(contentController));
router.post('/projects', contentController.createProject.bind(contentController));
router.get('/projects/:id', contentController.getProject.bind(contentController));
router.put('/projects/:id', contentController.updateProject.bind(contentController));
router.post('/projects/:id/rotate-token', contentController.rotateToken.bind(contentController));
router.delete('/projects/:id', contentController.deleteProject.bind(contentController));

router.post('/generate', contentController.generateContent.bind(contentController));

router.get('/posts', contentController.listPosts.bind(contentController));
router.post('/posts', contentController.createPost.bind(contentController));
router.get('/posts/:id', contentController.getPost.bind(contentController));
router.put('/posts/:id', contentController.updatePost.bind(contentController));
router.delete('/posts/:id', contentController.deletePost.bind(contentController));

router.get('/media/search', contentController.searchMedia.bind(contentController));
router.get('/media/curated', contentController.getCuratedMedia.bind(contentController));
router.post('/posts/:id/media', contentController.attachMedia.bind(contentController));
router.delete('/media/:mediaId', contentController.removeMedia.bind(contentController));

router.post('/publish/:postId', contentController.publishPost.bind(contentController));
router.get('/track', contentController.trackJobs.bind(contentController));
router.get('/stats', contentController.getStats.bind(contentController));

module.exports = router;
