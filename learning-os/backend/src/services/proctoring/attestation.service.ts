import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { redis } from '../../infrastructure/redis.js';

export interface ProctoringEvent {
  type:
    | 'tab_switch'
    | 'focus_loss'
    | 'fullscreen_exit'
    | 'mouse_idle'
    | 'key_pattern'
    | 'devtools_detected'
    | 'integrity_violation'
    | 'paste_detected'
    | 'automation_detected'
    | 'unknown';
  timestamp: number;
  sessionId: string;
  clientProof: string;
  sequenceNumber: number;
  mouseTrail?: { x: number; y: number; t: number }[];
  keystrokeDynamics?: { key: string; pressTime: number; releaseTime: number }[];
  screenHash?: string;
  integrityHash?: string;
}

export interface BehavioralProfile {
  userId: string;
  baselineTypingSpeed: number;
  baselineErrorRate: number;
  typicalTabSwitchPattern: 'low' | 'medium' | 'high';
  mouseConsistencyScore: number;
  lastUpdated: Date;
}

export interface ViolationAssessment {
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  reason: string;
  action: 'warn' | 'flag' | 'terminate' | 'review';
}

export class ProctoringAttestationService {
  private readonly HMAC_ALGORITHM = 'sha256';
  private readonly EVENT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_SEQUENCE_GAP = 10;

  /**
   * Generate a session-specific HMAC secret
   * This secret is shared securely with the client via WebSocket
   */
  async generateSessionSecret(sessionId: string): Promise<string> {
    const secret = randomBytes(32).toString('hex');
    
    // Store in Redis with TTL matching session
    await redis.setex(
      `proctoring:secret:${sessionId}`,
      7200, // 2 hours
      secret
    );
    
    return secret;
  }

  /**
   * Verify that a proctoring event is authentic
   * Checks HMAC, sequence number, and timing
   */
  async verifyEvent(event: ProctoringEvent): Promise<boolean> {
    // Get the session secret
    const secret = await redis.get(`proctoring:secret:${event.sessionId}`);
    if (!secret) {
      console.error(`[Proctoring] No secret found for session ${event.sessionId}`);
      return false;
    }

    // Reconstruct the expected HMAC
    const expectedProof = this.generateProof(secret, event);
    
    // Timing-safe comparison to prevent timing attacks
    const eventProofBuffer = Buffer.from(event.clientProof);
    const expectedProofBuffer = Buffer.from(expectedProof);
    
    if (eventProofBuffer.length !== expectedProofBuffer.length) {
      return false;
    }

    const proofValid = timingSafeEqual(eventProofBuffer, expectedProofBuffer);
    
    if (!proofValid) {
      console.error(`[Proctoring] Invalid proof for session ${event.sessionId}`);
      return false;
    }

    // Check sequence number to prevent replay attacks
    const lastSequence = await this.getLastSequenceNumber(event.sessionId);
    
    if (event.sequenceNumber <= lastSequence) {
      console.error(`[Proctoring] Replay attack detected: sequence ${event.sequenceNumber} <= ${lastSequence}`);
      return false;
    }

    if (event.sequenceNumber - lastSequence > this.MAX_SEQUENCE_GAP) {
      console.error(`[Proctoring] Sequence gap too large: ${event.sequenceNumber} - ${lastSequence}`);
      return false;
    }

    // Check timestamp is reasonable (within 5 minutes of server time)
    const serverTime = Date.now();
    const timeDiff = Math.abs(serverTime - event.timestamp);
    
    if (timeDiff > this.EVENT_WINDOW_MS) {
      console.error(`[Proctoring] Stale event: ${timeDiff}ms difference`);
      return false;
    }

    // Update sequence number
    await this.updateSequenceNumber(event.sessionId, event.sequenceNumber);
    
    // Store the verified event
    await this.storeEvent(event);

    return true;
  }

  /**
   * Assess the severity of a violation based on behavioral analysis
   */
  async assessViolation(
    event: ProctoringEvent,
    userId: string,
    recentEvents: ProctoringEvent[]
  ): Promise<ViolationAssessment> {
    // Get user's behavioral baseline
    const profile = await this.getBehavioralProfile(userId);
    
    // Calculate metrics
    const tabSwitchesLast5Min = recentEvents.filter(
      e => e.type === 'tab_switch' && e.timestamp > Date.now() - 5 * 60 * 1000
    ).length;
    
    const fullscreenExits = recentEvents.filter(e => e.type === 'fullscreen_exit').length;
    const devtoolsDetections = recentEvents.filter(e => e.type === 'devtools_detected').length;

    // Critical violations
    if (devtoolsDetections > 0) {
      return {
        severity: 'critical',
        confidence: 0.95,
        reason: 'Developer tools detected - potential inspection/copying',
        action: 'terminate'
      };
    }

    if (fullscreenExits >= 3) {
      return {
        severity: 'high',
        confidence: 0.9,
        reason: 'Multiple fullscreen exits detected',
        action: 'terminate'
      };
    }

    if (tabSwitchesLast5Min > 5) {
      return {
        severity: 'high',
        confidence: 0.85,
        reason: 'Excessive tab switching detected',
        action: 'flag'
      };
    }

    // Medium violations
    if (tabSwitchesLast5Min > 2) {
      return {
        severity: 'medium',
        confidence: 0.7,
        reason: 'Multiple tab switches',
        action: 'warn'
      };
    }

    // Check for anomalies in keystroke dynamics
    if (event.keystrokeDynamics && profile) {
      const anomalyScore = this.analyzeKeystrokeAnomaly(
        event.keystrokeDynamics,
        profile
      );
      
      if (anomalyScore > 0.8) {
        return {
          severity: 'high',
          confidence: anomalyScore,
          reason: 'Keystroke pattern anomaly detected (possible external help)',
          action: 'flag'
        };
      }
    }

    return {
      severity: 'low',
      confidence: 0.5,
      reason: 'Minor proctoring event',
      action: 'warn'
    };
  }

  /**
   * Detect potential cheating patterns
   */
  async detectCheatingPatterns(
    sessionId: string,
    userId: string
  ): Promise<{ isCheating: boolean; evidence: string[] }> {
    const events = await this.getSessionEvents(sessionId);
    const evidence: string[] = [];

    // Pattern 1: Sudden typing speed increase
    const typingSpeedChanges = this.analyzeTypingSpeedChanges(events);
    if (typingSpeedChanges.increase > 200) {
      evidence.push(`Typing speed increased by ${typingSpeedChanges.increase}% (copy-paste suspected)`);
    }

    // Pattern 2: Perfect code after long pause
    const pauseThenPerfect = this.analyzePauseThenSuccess(events);
    if (pauseThenPerfect.found) {
      evidence.push(`Long pause (${pauseThenPerfect.pauseDuration}s) followed by perfect submission`);
    }

    // Pattern 3: Mouse cursor teleportation (automation)
    const automationDetected = this.detectMouseAutomation(events);
    if (automationDetected) {
      evidence.push('Mouse movement patterns suggest automation');
    }

    // Pattern 4: Content inspection patterns
    const inspectionPattern = this.detectInspectionPattern(events);
    if (inspectionPattern) {
      evidence.push('Screen inspection patterns detected');
    }

    return {
      isCheating: evidence.length >= 2,
      evidence
    };
  }

  private generateProof(secret: string, event: Omit<ProctoringEvent, 'clientProof'>): string {
    const data = `${event.sessionId}:${event.type}:${event.timestamp}:${event.sequenceNumber}`;
    return createHmac(this.HMAC_ALGORITHM, secret).update(data).digest('hex');
  }

  private async getLastSequenceNumber(sessionId: string): Promise<number> {
    const seq = await redis.get(`proctoring:seq:${sessionId}`);
    return seq ? parseInt(seq, 10) : 0;
  }

  private async updateSequenceNumber(sessionId: string, seq: number): Promise<void> {
    await redis.setex(`proctoring:seq:${sessionId}`, 7200, seq.toString());
  }

  private async storeEvent(event: ProctoringEvent): Promise<void> {
    const key = `proctoring:events:${event.sessionId}`;
    const eventJson = JSON.stringify(event);
    
    // Store in Redis list with 2 hour TTL
    await redis.lpush(key, eventJson);
    await redis.ltrim(key, 0, 999); // Keep last 1000 events
    await redis.expire(key, 7200);
  }

  private async getSessionEvents(sessionId: string): Promise<ProctoringEvent[]> {
    const key = `proctoring:events:${sessionId}`;
    const events = await redis.lrange(key, 0, -1);
    return events.map(e => JSON.parse(e));
  }

  private async getBehavioralProfile(userId: string): Promise<BehavioralProfile | null> {
    const profile = await redis.get(`behavioral:profile:${userId}`);
    return profile ? JSON.parse(profile) : null;
  }

  private analyzeKeystrokeAnomaly(
    dynamics: { key: string; pressTime: number; releaseTime: number }[],
    profile: BehavioralProfile
  ): number {
    // Guard against empty dynamics or zero baseline
    if (dynamics.length < 2 || profile.baselineTypingSpeed <= 0) {
      return 0;
    }

    // Calculate current typing speed
    const totalTime = dynamics[dynamics.length - 1].releaseTime - dynamics[0].pressTime;
    const charCount = dynamics.length;
    const currentSpeed = charCount / (totalTime / 1000); // chars per second

    // Compare to baseline
    const speedRatio = currentSpeed / profile.baselineTypingSpeed;
    
    // Calculate consistency (coefficient of variation)
    const intervals = [];
    for (let i = 1; i < dynamics.length; i++) {
      intervals.push(dynamics[i].pressTime - dynamics[i - 1].releaseTime);
    }
    
    // Guard against empty intervals
    if (intervals.length === 0) {
      return Math.min((speedRatio - 1) * 0.3, 0.8);
    }
    
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    
    // Guard against zero mean
    if (mean === 0) {
      return speedRatio > 3 ? 0.8 : 0;
    }
    
    const variance = intervals.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intervals.length;
    const cv = Math.sqrt(variance) / mean;

    // High typing speed + low variation = likely copy-paste
    if (speedRatio > 3 && cv < 0.1) {
      return 0.9;
    }

    return Math.min((speedRatio - 1) * 0.3, 0.8);
  }

  private analyzeTypingSpeedChanges(events: ProctoringEvent[]): { increase: number } {
    // Implementation would analyze keystroke dynamics across events
    return { increase: 0 };
  }

  private analyzePauseThenSuccess(events: ProctoringEvent[]): { found: boolean; pauseDuration: number } {
    // Implementation would correlate events with submission times
    return { found: false, pauseDuration: 0 };
  }

  private detectMouseAutomation(events: ProctoringEvent[]): boolean {
    for (const event of events) {
      if (!event.mouseTrail || event.mouseTrail.length < 3) continue;

      // Check for instant moves (teleportation)
      for (let i = 1; i < event.mouseTrail.length; i++) {
        const prev = event.mouseTrail[i - 1];
        const curr = event.mouseTrail[i];
        
        const distance = Math.sqrt(
          Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)
        );
        const timeDiff = curr.t - prev.t;
        
        // If moved >500px in <10ms = impossible for human
        if (distance > 500 && timeDiff < 10) {
          return true;
        }
      }
    }
    return false;
  }

  private detectInspectionPattern(events: ProctoringEvent[]): boolean {
    // Check for systematic inspection patterns
    const screenInspectionEvents = events.filter(e => e.type === 'integrity_violation');
    return screenInspectionEvents.length > 3;
  }
}

export const proctoringAttestationService = new ProctoringAttestationService();
