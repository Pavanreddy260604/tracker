import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { apiLimiter, interviewWriteLimiter, writeLimiter } from '../middleware/rateLimiter.js';
import * as ctrl from '../controllers/interview.controller.js';

const router = express.Router();

// ─── Interview Lifecycle ─────────────────────────────────────────────────────
router.post('/start', authenticate, interviewWriteLimiter, ctrl.startInterview);
router.post('/:id/next-section', authenticate, interviewWriteLimiter, ctrl.nextSection);
router.post('/:id/submit-section', authenticate, interviewWriteLimiter, ctrl.submitSection);
router.post('/submit', authenticate, interviewWriteLimiter, ctrl.submitCode);
router.post('/run', authenticate, apiLimiter, ctrl.runCodeHandler);
router.post('/end', authenticate, interviewWriteLimiter, ctrl.endInterview);

// ─── Proctoring ──────────────────────────────────────────────────────────────
router.post('/:id/proctoring', authenticate, apiLimiter, ctrl.updateProctoring);

// ─── AI Chat ─────────────────────────────────────────────────────────────────
router.post('/chat', authenticate, ctrl.chatWithAI);

// ─── Analytics & History ─────────────────────────────────────────────────────
router.get('/:id/analytics', authenticate, ctrl.getAnalytics);
router.get('/history', authenticate, ctrl.getHistory);
router.get('/:id', authenticate, ctrl.getSession);

// ─── Deletion ────────────────────────────────────────────────────────────────
router.delete('/:id([0-9a-fA-F]{24})', authenticate, writeLimiter, ctrl.deleteSession);
router.delete('/history/clear', authenticate, writeLimiter, ctrl.clearHistory);

export default router;
