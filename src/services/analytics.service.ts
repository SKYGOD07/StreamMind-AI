import { db } from '../lib/db';
import { BatchStats } from './pipeline.service';

export interface AnalyticsSummary {
  hypeLevel: 'low' | 'medium' | 'high';
  hypeScore: number;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  toxicityAlert: boolean;
  spamAlert: boolean;
}

// Helper: safe DB write (never crashes the process)
async function safeDbWrite<T>(operation: () => Promise<T>, label: string): Promise<T | null> {
  try {
    return await operation();
  } catch (error: any) {
    console.warn(`[DB WARN] ${label} failed (non-fatal):`, error?.message || error);
    return null;
  }
}

export class AnalyticsService {
  /**
   * Evaluates the hype score (0-100) based on message velocity, caps ratio, and duplicate activity.
   */
  calculateHype(stats: BatchStats): { level: 'low' | 'medium' | 'high'; score: number } {
    // 1. Calculate velocity score (messages per 30-second batch)
    // Max reference speed is 40 messages per 30 seconds
    const velocityScore = Math.min(1.0, stats.messageCount / 40);

    // 2. Caps ratio (0 to 1)
    const capsScore = stats.capsRatio;

    // 3. Duplicate/Emote activity score
    const duplicateScore = stats.messageCount > 0 ? stats.duplicateCount / stats.messageCount : 0;

    // Weighted average
    const rawScore = (velocityScore * 0.4) + (capsScore * 0.3) + (duplicateScore * 0.3);
    const scorePercentage = Math.round(rawScore * 100);

    let level: 'low' | 'medium' | 'high' = 'low';
    if (scorePercentage > 65) {
      level = 'high';
    } else if (scorePercentage > 30) {
      level = 'medium';
    }

    return { level, score: scorePercentage };
  }

  /**
   * Detects and records timeline milestones based on sudden changes in chat dynamics.
   * Compares the current stats against thresholds and saves new events to the DB.
   */
  async detectTimelineEvents(
    sessionId: string,
    stats: BatchStats,
    currentHypeLevel: 'low' | 'medium' | 'high',
    previousHypeLevel: 'low' | 'medium' | 'high'
  ): Promise<any | null> {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    // 1. Hype Spike Alert
    if (currentHypeLevel === 'high' && previousHypeLevel !== 'high') {
      return await safeDbWrite(
        () => db.timelineEvent.create({
          data: {
            sessionId,
            time: timeString,
            type: 'hype',
            description: '🔥 Huge hype spike detected in chat!'
          }
        }),
        'timeline.hype'
      );
    }

    // 2. Spam Flood Alert
    if (stats.messageCount > 5 && stats.spamCount / stats.messageCount > 0.4) {
      // Check if we logged a spam event in the last 2 minutes to prevent spamming timeline
      let recentSpam = null;
      try {
        recentSpam = await db.timelineEvent.findFirst({
          where: {
            sessionId,
            type: 'toxicity_spike',
            timestamp: {
              gt: new Date(Date.now() - 120000)
            }
          }
        });
      } catch {
        // DB read failure, skip duplicate check
      }

      if (!recentSpam) {
        return await safeDbWrite(
          () => db.timelineEvent.create({
            data: {
              sessionId,
              time: timeString,
              type: 'toxicity_spike',
              description: '⚠️ Spam flood: Chat velocity and spam rates spiked.'
            }
          }),
          'timeline.spam'
        );
      }
    }

    // 3. Question Wave Alert
    if (stats.questionCount >= 4) {
      let recentQuestions = null;
      try {
        recentQuestions = await db.timelineEvent.findFirst({
          where: {
            sessionId,
            type: 'question_spike',
            timestamp: {
              gt: new Date(Date.now() - 180000)
            }
          }
        });
      } catch {
        // DB read failure, skip duplicate check
      }

      if (!recentQuestions) {
        return await safeDbWrite(
          () => db.timelineEvent.create({
            data: {
              sessionId,
              time: timeString,
              type: 'question_spike',
              description: `❓ Wave of viewer questions! (${stats.questionCount} unanswered questions).`
            }
          }),
          'timeline.questions'
        );
      }
    }

    // 4. Toxicity Alert
    if (stats.averageToxicity > 0.3) {
      let recentToxicity = null;
      try {
        recentToxicity = await db.timelineEvent.findFirst({
          where: {
            sessionId,
            type: 'toxicity_spike',
            timestamp: {
              gt: new Date(Date.now() - 90000)
            }
          }
        });
      } catch {
        // DB read failure, skip duplicate check
      }

      if (!recentToxicity) {
        return await safeDbWrite(
          () => db.timelineEvent.create({
            data: {
              sessionId,
              time: timeString,
              type: 'toxicity_spike',
              description: '🚨 Moderation: Toxic messages or bad words increasing.'
            }
          }),
          'timeline.toxicity'
        );
      }
    }

    return null;
  }
}

export const analyticsService = new AnalyticsService();
