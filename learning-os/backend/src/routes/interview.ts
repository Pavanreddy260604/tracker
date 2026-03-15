import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { rateLimits } from '../middleware/advancedRateLimiter.js';
import * as ctrl from '../controllers/interview.controller.new.js';

const router = express.Router();

// ─── Interview Lifecycle ─────────────────────────────────────────────────────
router.post('/start', authenticate, rateLimits.interviewStart, ctrl.startInterview);
router.post('/:id/next-section', authenticate, rateLimits.write, ctrl.nextSection);
router.post('/:id/submit-section', authenticate, rateLimits.write, ctrl.submitSection);
router.post('/submit', authenticate, rateLimits.write, ctrl.submitCode);
router.post('/run', authenticate, rateLimits.codeExecution, ctrl.runCodeHandler);
router.post('/end', authenticate, rateLimits.write, ctrl.endInterview);

// ─── Draft Auto-Save ─────────────────────────────────────────────────────────
router.post('/:id/draft', authenticate, rateLimits.write, ctrl.updateDraft);

// ─── Proctoring ──────────────────────────────────────────────────────────────
router.post('/:id/proctoring', authenticate, rateLimits.proctoring, ctrl.updateProctoring);

// ─── AI Chat ─────────────────────────────────────────────────────────────────
router.post('/chat', authenticate, rateLimits.aiChat, ctrl.chatWithAI);

// ─── Analytics & History ─────────────────────────────────────────────────────
router.get('/:id/analytics', authenticate, rateLimits.api, ctrl.getAnalytics);
router.get('/history', authenticate, rateLimits.api, ctrl.getHistory);
router.get('/:id', authenticate, rateLimits.api, ctrl.getSession);

// ─── Deletion ────────────────────────────────────────────────────────────────
router.delete('/:id([0-9a-fA-F]{24})', authenticate, rateLimits.write, ctrl.deleteSession);
router.delete('/history/clear', authenticate, rateLimits.write, ctrl.clearHistory);

export default router;
