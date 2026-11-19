'use strict';

// Chat with the bot in your terminal – no WhatsApp account needed.
//   npm run chat
const readline = require('node:readline');
const { createBot } = require('./bot');

const bot = createBot({ onLead: (lead) => console.log('\n[lead captured]', lead, '\n') });
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'you> ' });

console.log('Apache roof tile bot – local test chat. Type "hi" to start, Ctrl+C to quit.\n');
rl.prompt();
rl.on('line', (line) => {
  for (const reply of bot.handle('local-test', line)) {
    console.log('\nbot>\n' + reply + '\n');
  }
  rl.prompt();
});
