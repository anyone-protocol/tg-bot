const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const fs = require('fs'); // For synchronous operations like existsSync
const fsp = require('fs').promises; // For promise-based operations

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new TelegramBot(BOT_TOKEN, { polling: true });


const DATA_STATE_FILE = "./data/fingerprints.json";
const CHAT_IDS_FILE = "./data/chatIds.json";


const POLLING_INTERVAL = 60000;
const WEEK_IN_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;

const API_URL = process.env.API_URL;

const saveToFile = (data, fileName) => {
  fs.writeFileSync(fileName, JSON.stringify(data, null, 2));
};

// const fs = require('fs');

async function loadFromFile(fileName) {
  try {
    const data = await fsp.readFile(fileName, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading file:', error);
    return []; // Assuming the default structure is an array
  }
}

let lastrelayState = loadFromFile(DATA_STATE_FILE, {});


const underline = (text) => {
  return text.split('').join('\u0332') + '\u0332';
}

bot.onText(/^\/start@RelayUpBot$/, async (msg) => {

  if (msg.chat.type === 'private') {
    const welcomeMessage = `
🤖 Welcome to the Anyone Relay-Up Bot! 
I am a Telegram bot that automatically pings your group chat whenever a new Anyone relay is registered from our network.

Add me to a group chat and enter <code>/start</code> to begin! Want to set up a relay yourself? Follow our guide on educ.ator.io

You can also check out the general locations of the relays on our official map: https://relaymap.ator.io/

<a href="https://x.com/AnyoneFDN"><u>Twitter</u></a> | <a href="https://t.me/anyoneprotocol"><u>Telegram</u></a>
`;

    await bot.sendMessage(msg.chat.id, welcomeMessage, { parse_mode: 'HTML' });
    return;
  }

  const chatId = msg.chat.id;
  const userId = msg.from.id;

  let activeChats = await loadFromFile(CHAT_IDS_FILE, []);

  try {
    // Get the list of admins for the chat
    const admins = await bot.getChatAdministrators(chatId);
    const isAdmin = admins.some((admin) => admin.user.id === userId);

    if (isAdmin) {
      // If the user is an admin and the chat ID doesn't exist in the activeChats list, add it
      if (activeChats.indexOf(chatId) === -1) {
        activeChats.push(chatId);
        saveToFile(activeChats, CHAT_IDS_FILE);
        bot.sendMessage(
          chatId,
          "Anyone Relay-Up Bot started successfully and will notify this chat of new updates!"
        );
      } else {
        bot.sendMessage(chatId, "Bot is already active in this chat.");
      }
    } else {
      bot.sendMessage(chatId, "Only an admin can start the bot in this chat.");
    }
  } catch (error) {
    console.error("Error checking admin status:", error);
  }
});

bot.onText(/^\/stop@RelayUpBot$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  let activeChats = await loadFromFile(CHAT_IDS_FILE, []);

  try {
    // Get the list of admins for the chat
    const admins = await bot.getChatAdministrators(chatId);
    const isAdmin = admins.some((admin) => admin.user.id === userId);

    if (isAdmin) {
      // If the user is an admin and the chat ID exists in the activeChats list, remove it
      const index = activeChats.indexOf(chatId);
      if (index !== -1) {
        activeChats.splice(index, 1);
        saveToFile(activeChats, CHAT_IDS_FILE);
        bot.sendMessage(
          chatId,
          "Anyone Relay-Up Bot stopped successfully and will no longer notify this chat of updates."
        );
      } else {
        bot.sendMessage(chatId, "Bot is already inactive in this chat.");
      }
    } else {
      bot.sendMessage(chatId, "Only an admin can stop the bot in this chat.");
    }
  } catch (error) {
    console.error("Error checking admin status:", error);
  }
});


const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

// Helper function to check if a relay was first seen in the last 7 days
const isFirstSeenInLast7Days = (firstSeen) => {
  const firstSeenDate = new Date(firstSeen).getTime();
  const sevenDaysAgo = Date.now() - (7 * DAY_IN_MILLISECONDS);
  return firstSeenDate >= sevenDaysAgo;
};


const generateSingleClaimMessage = (nickname, fingerprint) => {
    const shortenedFingerprint = `${fingerprint.substring(0, 3)}...${fingerprint.substring(fingerprint.length - 3)}`;
    return `${nickname} claims fingerprint ${shortenedFingerprint}`;
  };
  

  const generateMessage = (newRelays, totalLast7Days, totalAllTime) => {
    const claimMessages = newRelays.map(relay => {
      return generateSingleClaimMessage(relay.nickname, relay.fingerprint);
    }).join('\n');
  
    return `🌐 New Relays Registered!\n\n${claimMessages}\n\nTotal Relays Registered - All Time: ${totalAllTime}`;
  };
  


// Fetch new data from the API
async function fetchData() {
  try {
    const response = await axios.get(API_URL);
    return response.data;
  } catch (error) {
    console.error('Error fetching data:', error);
    return null;
  }
}


// Load fingerprints from file
async function loadFingerprints() {
  try {
    const data = await fsp.readFile(DATA_STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading file:', error);
    // Return an empty object if the file doesn't exist
    return {};
  }
}

// Save updated fingerprints to file
async function saveFingerprints(fingerprints) {
  try {
    // console.log(fingerprints);
    await fsp.writeFile(DATA_STATE_FILE, JSON.stringify(fingerprints, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing file:', error);
  }
}


// Main function to check for new fingerprints and update
async function updateFingerprints() {
  const existingFingerprints = await loadFingerprints();
  const newData = await fetchData();

  if (newData && newData.relays) {
    let isNewData = false;
    let newRelays = [];
    let totalLast7Days = 0;

    // Filter relays first seen in the last 7 days and check for new fingerprints
    newData.relays.forEach(relay => {
      if (isFirstSeenInLast7Days(relay.first_seen) && relay.nickname !== 'MyRelayNickname') {
        totalLast7Days += 1;
        if (!existingFingerprints[relay.fingerprint]) {
          isNewData = true;
          newRelays.push(relay);
          existingFingerprints[relay.fingerprint] = true; // Mark as seen
          console.log(`New relay detected: ${relay.nickname}`);
        }
      }
    });

    if (isNewData) {
      await saveFingerprints(existingFingerprints);
      console.log("written new data");

      const message = generateMessage(newRelays, totalLast7Days, Object.keys(existingFingerprints).length);
      // console.log(message);
      let activeChats = await loadFromFile(CHAT_IDS_FILE, []);
      activeChats.forEach(async (chatId) => {
        try {
          await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } catch (error) {
          console.error("Error sending message:", error);
        }
      });

      console.log('Fingerprint data updated with new entries.');
    } else {
      console.log('No new fingerprints detected.');
    }
  }
}


updateFingerprints();


setTimeout(() => {
  // Start checking for updates after the delay
  setInterval(updateFingerprints, POLLING_INTERVAL);
}, 500);
