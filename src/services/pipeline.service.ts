export interface RawChatMessage {
  sender: string;
  text: string;
  badge: 'mod' | 'sub' | 'vip' | 'none';
  timestamp: Date;
}

export interface ProcessedChatMessage extends RawChatMessage {
  id: string;
  isSpam: boolean;
  isQuestion: boolean;
  sentiment: 'positive' | 'neutral' | 'negative';
  toxicity: number;
}

export interface BatchStats {
  messageCount: number;
  duplicateCount: number;
  spamCount: number;
  questionCount: number;
  capsRatio: number;
  averageToxicity: number;
  uniqueMessages: Array<{ sender: string; text: string; badge: string; isQuestion: boolean }>;
}

export class PipelineService {
  // Sliding window to track message deduplication (last 10 seconds)
  private messageWindow: Array<{ text: string; sender: string; timestamp: number }> = [];
  private windowDurationMs = 10000; // 10 seconds

  // List of common bad words for rule-based toxicity pre-detection
  private toxicWords = ['scam', 'fuck', 'shit', 'bitch', 'asshole', 'kill yourself', 'kys', 'cheat', 'hack', 'robux hack'];
  
  // Scam link patterns
  private scamLinkRegex = /(free-?skins|free-?robux|win-?iphone|steam-?giveaway|vbucks-?glitch|bit\.ly|tinyurl|discord\.gg\/[\w-]+)/i;

  /**
   * Process a single incoming message, applying rule checks and sliding window deduplication
   */
  processMessage(raw: RawChatMessage): ProcessedChatMessage {
    const now = Date.now();
    const text = raw.text.trim();
    
    // 1. Sliding window cleanup
    this.messageWindow = this.messageWindow.filter(m => now - m.timestamp < this.windowDurationMs);

    // 2. Deduplication check
    const isDuplicate = this.messageWindow.some(m => 
      m.text.toLowerCase() === text.toLowerCase() && 
      (m.sender === raw.sender || now - m.timestamp < 3000) // matches same text within 3s or same user
    );

    // Add to sliding window
    this.messageWindow.push({ text, sender: raw.sender, timestamp: now });

    // 3. Spam checks
    let isSpam = isDuplicate;

    // Check CAPS ratio (e.g. "GG NOOB GO GO GO")
    const alphabeticChars = text.replace(/[^a-zA-Z]/g, '');
    const uppercaseChars = alphabeticChars.replace(/[^A-Z]/g, '');
    const capsRatio = alphabeticChars.length > 4 ? uppercaseChars.length / alphabeticChars.length : 0;
    
    if (capsRatio > 0.75 && text.length > 6) {
      isSpam = true;
    }

    // Check scam links
    if (this.scamLinkRegex.test(text)) {
      isSpam = true;
    }

    // Check repeated word spam (e.g., "win win win win win")
    const words = text.toLowerCase().split(/\s+/);
    if (words.length > 5) {
      const uniqueWords = new Set(words);
      if (uniqueWords.size / words.length < 0.4) {
        isSpam = true;
      }
    }

    // 4. Question check (contains ? or starts with question pronouns)
    const questionWords = ['what', 'why', 'how', 'who', 'when', 'where', 'will', 'can', 'is', 'are', 'do', 'does', 'should'];
    const lowerText = text.toLowerCase();
    const isQuestion = text.includes('?') || questionWords.some(w => lowerText.startsWith(w + ' '));

    // 5. Toxicity rule check
    let toxicity = 0.0;
    const hasToxicWord = this.toxicWords.some(w => lowerText.includes(w));
    if (hasToxicWord) {
      toxicity = 0.75;
    }
    if (this.scamLinkRegex.test(text)) {
      toxicity = 0.90; // High toxicity for links
    }

    // Determine basic sentiment from words (fallback rule before AI)
    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (lowerText.includes('hype') || lowerText.includes('gg') || lowerText.includes('love') || lowerText.includes('pog') || lowerText.includes('w')) {
      sentiment = 'positive';
    } else if (hasToxicWord || lowerText.includes('l ') || lowerText.includes('trash') || lowerText.includes('bad')) {
      sentiment = 'negative';
    }

    return {
      id: Math.random().toString(36).substring(2, 9),
      ...raw,
      isSpam,
      isQuestion: isQuestion && !isSpam, // Questions shouldn't be spam
      sentiment,
      toxicity
    };
  }

  /**
   * Aggregate a list of processed messages into a consolidated context block for the AI.
   * This reduces LLM token consumption by filtering duplicates and selecting high-signal representatives.
   */
  aggregateBatch(messages: ProcessedChatMessage[]): BatchStats {
    const messageCount = messages.length;
    let duplicateCount = 0;
    let spamCount = 0;
    let questionCount = 0;
    let capsTotal = 0;
    let toxicitySum = 0;

    // Filter unique representative messages
    const seenTexts = new Set<string>();
    const uniqueMessages: Array<{ sender: string; text: string; badge: string; isQuestion: boolean }> = [];

    messages.forEach(msg => {
      if (msg.isSpam) {
        spamCount++;
      }
      if (msg.isQuestion) {
        questionCount++;
      }
      
      const alphabetic = msg.text.replace(/[^a-zA-Z]/g, '');
      const caps = alphabetic.replace(/[^A-Z]/g, '');
      capsTotal += alphabetic.length > 0 ? caps.length / alphabetic.length : 0;
      
      toxicitySum += msg.toxicity;

      // Deduplicate representative texts for AI context
      const normalized = msg.text.toLowerCase().trim();
      if (!seenTexts.has(normalized)) {
        seenTexts.add(normalized);
        // Prioritize questions or highly descriptive messages (longer length)
        if (uniqueMessages.length < 25) { // Limit to 25 items to save tokens
          uniqueMessages.push({
            sender: msg.sender,
            text: msg.text,
            badge: msg.badge,
            isQuestion: msg.isQuestion
          });
        }
      } else {
        duplicateCount++;
      }
    });

    const capsRatio = messageCount > 0 ? capsTotal / messageCount : 0;
    const averageToxicity = messageCount > 0 ? toxicitySum / messageCount : 0;

    return {
      messageCount,
      duplicateCount,
      spamCount,
      questionCount,
      capsRatio,
      averageToxicity,
      uniqueMessages
    };
  }
}

export const pipelineService = new PipelineService();
