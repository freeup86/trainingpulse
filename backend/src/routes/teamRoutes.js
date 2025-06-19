const express = require('express');
const teamController = require('../controllers/teamController');
const { authorize } = require('../middleware/authenticate');

const router = express.Router();

// Team CRUD operations
router.get('/', teamController.getTeams);
router.get('/:id', teamController.getTeamById);
router.post('/', authorize(['admin']), teamController.createTeam);
router.put('/:id', authorize(['admin', 'manager']), teamController.updateTeam);

// Team member management
router.post('/:id/members', authorize(['admin', 'manager']), teamController.addTeamMember);
router.delete('/:id/members/:userId', authorize(['admin', 'manager']), teamController.removeTeamMember);

// Team analytics
router.get('/:id/performance', teamController.getTeamPerformance);

module.exports = router;