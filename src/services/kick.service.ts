import { RawChatMessage } from './pipeline.service';

export class KickService {
  private simulationInterval: NodeJS.Timeout | null = null;
  private users = [
    { name: 'GamerPro99', badge: 'sub' },
    { name: 'xX_Sniper_Xx', badge: 'none' },
    { name: 'ModMax', badge: 'mod' },
    { name: 'VipLounge', badge: 'vip' },
    { name: 'SoloQueue', badge: 'none' },
    { name: 'NeonRider', badge: 'sub' },
    { name: 'ChatSpammer', badge: 'none' },
    { name: 'LurkKing', badge: 'none' },
    { name: 'SpponsorBoy', badge: 'vip' },
    { name: 'ScamBot404', badge: 'none' }
  ];

  // Specific pools based on themes
  private valorantPool = [
    "OMG NICE ACACE!! 🔥",
    "gg",
    "what rank is this lobby?",
    "can I play with you in the next game?",
    "what is your sensitivity/dpi?",
    "buy the new skin bundle, it looks so clean!",
    "unlucky round, you've got this next one",
    "are you solo queueing or with a stack?",
    "wanna play together? add me SoloQueue#NA1",
    "Check out this site for free vp: tinyurl.com/free-vp-skins",
    "LMAO toxic teammate in voice chat",
    "POGGERS WHAT A SHOT!",
    "how long have you been playing Valorant?",
    "is this sponsored by NordVPN?",
    "W stream today!",
    "gg gg gg gg",
    "WHAT A WHIFF LMAO 😂",
    "rank check",
    "giveaway time?",
    "what keyboard do you use?"
  ];

  private techPool = [
    "This explanation of Next.js 15 is super clear!",
    "Are we using Prisma SQLite for this project?",
    "Is tailwind v4 faster than v3?",
    "What coding model is best for typescript?",
    "Can you explain explainability in AI confidence scores?",
    "Check out this cool developer discord: discord.gg/dev-hangout",
    "Does Socket.io work fine on serverless?",
    "I love Next.js api routes, so simple",
    "Have you tried Gemini 2.5 Flash yet?",
    "Why use SQLite over Postgres for this?",
    "scam check: bit.ly/earn-100-usd-fast",
    "Interesting architecture choice",
    "Is this a sponsored tech review?",
    "Can you share the github link?",
    "What IDE is that? Looks very slick.",
    "Will this code compile on Node 22?",
    "Awesome stream, very informative",
    "pog",
    "what database adapter are you using?"
  ];

  private generalPool = [
    "Hello streamer! 👋",
    "pog",
    "W stream!",
    "first time watching, love the content!",
    "how's your day going?",
    "what is the giveaway command again?",
    "scam link: free-skins-glitch.xyz",
    "moderator, can you pin the discord link?",
    "hype train incoming! 🚂",
    "L streamer Kappa",
    "GG! That was crazy!",
    "what is today's schedule?",
    "are you doing viewer games today?",
    "is the stream sponsored?",
    "lol true",
    "spam spam spam spam",
    "can I get a shoutout?",
    "what keyboard do you use?",
    "love the setup"
  ];

  /**
   * Starts simulated chat emission.
   * Callback triggers periodically, simulating messages that match the streamer's context.
   */
  startSimulation(
    theme: string,
    goals: string[],
    callback: (msg: RawChatMessage) => void
  ) {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
    }

    const lowerTheme = theme.toLowerCase();
    let messagePool = this.generalPool;

    if (lowerTheme.includes('valorant')) {
      messagePool = this.valorantPool;
    } else if (lowerTheme.includes('tech') || lowerTheme.includes('ai') || lowerTheme.includes('podcast')) {
      messagePool = this.techPool;
    }

    console.log(`Starting Kick Chat Simulation for theme: ${theme}`);

    // Dynamic emission interval (random between 500ms and 2500ms)
    const runSimulationLoop = () => {
      const randomDelay = Math.floor(Math.random() * 1500) + 400; // 400ms to 1900ms

      this.simulationInterval = setTimeout(() => {
        // Pick a user
        const userIdx = Math.floor(Math.random() * this.users.length);
        const user = this.users[userIdx];

        // Pick a message
        const msgIdx = Math.floor(Math.random() * messagePool.length);
        let text = messagePool[msgIdx];

        // Occasionally inject a customized goal-oriented message
        const roll = Math.random();
        if (roll < 0.15 && goals.includes('Detect important questions')) {
          text = `Question for you: ${text.includes('?') ? text : text + '?'}`;
        } else if (roll >= 0.15 && roll < 0.3 && goals.includes('Detect hype moments')) {
          text = `${text.toUpperCase()} !!! 🔥🚀 POG`;
        } else if (roll >= 0.3 && roll < 0.4 && goals.includes('Moderate spam')) {
          text = `${text} ${text} ${text} ${text}`;
        }

        // Trigger callback
        callback({
          sender: user.name,
          text: text,
          badge: user.badge as any,
          timestamp: new Date()
        });

        // Loop recursively
        runSimulationLoop();
      }, randomDelay);
    };

    runSimulationLoop();
  }

  /**
   * Stops the simulator
   */
  stopSimulation() {
    if (this.simulationInterval) {
      clearTimeout(this.simulationInterval);
      this.simulationInterval = null;
      console.log('Kick Chat Simulation stopped.');
    }
  }

  /**
   * Connects to a live KICK stream channel.
   * In a real product, we connect to KICK's public chat API or Pusher WebSocket.
   */
  connectLiveChat(
    channelName: string,
    callback: (msg: RawChatMessage) => void
  ): { disconnect: () => void } {
    console.log(`Connecting to Live Kick Chat for channel: ${channelName}`);
    
    // Simulate some latency then start emitting basic messages to show connection
    const interval = setInterval(() => {
      const liveUsers = ['KickFan_1', 'SuperSub', 'Lurker88', 'ModBoss'];
      const liveTexts = [
        `Connecting live to ${channelName}...`,
        'Nice stream!',
        'Is this working?',
        'Yes, chat is hooked up!'
      ];

      const rUser = liveUsers[Math.floor(Math.random() * liveUsers.length)];
      const rText = liveTexts[Math.floor(Math.random() * liveTexts.length)];
      
      callback({
        sender: rUser,
        text: rText,
        badge: rUser === 'ModBoss' ? 'mod' : 'none',
        timestamp: new Date()
      });
    }, 4000);

    return {
      disconnect: () => {
        clearInterval(interval);
        console.log(`Disconnected from Live Kick Chat for channel: ${channelName}`);
      }
    };
  }
}

export const kickService = new KickService();
