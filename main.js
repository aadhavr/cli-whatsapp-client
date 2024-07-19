#!/usr/bin/env node

// Suppress warnings by overriding process.emitWarning
process.emitWarning = (warning, type) => {
    if (type !== 'DeprecationWarning') {
      console.warn(warning);
    }
  };
  

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const readline = require('readline');
const clc = require('cli-color');

// Create a new client instance
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '.wwebjs_cache'
    })
});

// Create readline interface for terminal input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let chatId = null; // Variable to store the chat ID
let contactName = ''; // Variable to store the contact name
let messageHistory = []; // Array to store message history
let firstMessage = true; // Flag to indicate if it's the first message

// ASCII art for title
const title = `
${clc.greenBright.bold(` _      __    __                   __      
| | /| / /__ / /______  __ _  ___ / /      
| |/ |/ / -_) / __/ _ \\/  ' \\/ -_)_/       
|__/|__/\\__/_/\\__/\\___/_/_/_/\\__(_)  `)}
`;

client.once('ready', () => {
    console.log(title);
    console.log(clc.cyanBright('Client is ready!'));
    promptChatDetails(); // Start by prompting for chat details
});

// Function to prompt user for phone number and contact name
function promptChatDetails() {
    rl.question(clc.yellowBright('Enter the contact name: '), name => {
        if (!name.trim()) {
            console.log(clc.redBright('Contact name cannot be empty. Please try again.'));
            return promptChatDetails();
        }
        contactName = name; // Store the contact name
        rl.question(clc.yellowBright('Enter the phone number (e.g., 1234567890): '), number => {
            if (!/^\d{7,15}$/.test(number.trim())) {
                console.log(clc.redBright('Invalid phone number format. Please try again.'));
                return promptChatDetails();
            }
            chatId = `${number.trim()}@s.whatsapp.net`; // Store the chat ID
            rl.setPrompt(clc.greenBright('Enter message here: ')); // Set the initial prompt message
            drawInterface();
            rl.prompt(); // Prompt for the first message
        });
    });
}

// Function to send a message
function sendMessage(chatId, message) {
    if (!message.trim()) {
        console.log(clc.redBright('Message cannot be empty.'));
        drawInterface();
        return rl.prompt();
    }
    client.sendMessage(chatId, message).then(() => {
        if (firstMessage) {
            firstMessage = false;
            rl.setPrompt(clc.greenBright('> ')); // Change prompt symbol after the first message
        }
        addToMessageHistory(clc.cyanBright(`You: ${message}`));
        drawInterface();
        rl.prompt(); // Prompt again after sending the message
    }).catch(err => {
        addToMessageHistory(clc.redBright(`Error sending message: ${err}`));
        drawInterface();
        rl.prompt(); // Prompt again even if there's an error
    });
}

// Function to add a message to the message history
function addToMessageHistory(message) {
    messageHistory.push(message);
    if (messageHistory.length > process.stdout.rows - 5) { // Leave space for prompt and title
        messageHistory.shift(); // Keep the history size within the terminal height
    }
}

// Function to draw the interface
function drawInterface() {
    readline.cursorTo(process.stdout, 0, 0); // Move cursor to the top-left
    readline.clearScreenDown(process.stdout); // Clear the screen

    console.log(title);
    messageHistory.forEach(message => console.log(message));
    readline.cursorTo(process.stdout, 0, process.stdout.rows - 1); // Move cursor to the bottom
}

// When the client received QR-Code
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

// Start your client
client.initialize();

// Listening to all incoming messages
client.on('message_create', message => {
    if (!message.fromMe) { // Ensure only received messages are added here
        addToMessageHistory(clc.magentaBright(`${contactName}: ${message.body}`));
        drawInterface();
        rl.prompt(); // Keep the prompt active after receiving a message
    }
});

// Handle input line and send the message
rl.on('line', (input) => {
    if (chatId) {
        sendMessage(chatId, input);
    } else {
        console.log(clc.redBright('Please set the chat ID first.'));
        rl.prompt();
    }
});

// Properly handle exit
rl.on('SIGINT', () => {
    readline.clearLine(process.stdout, 0); // Clear the current line
    readline.cursorTo(process.stdout, 0); // Move the cursor to the start of the line
    rl.question(clc.yellowBright('Are you sure you want to exit? (y/N) '), (answer) => {
        if (answer.match(/^y(es)?$/i)) {
            rl.close();
            client.destroy().then(() => process.exit(0)); // Exit the process gracefully
        } else {
            drawInterface(); // Redraw the interface if not exiting
            rl.prompt();
        }
    });
});

// Global error handling
process.on('uncaughtException', (err) => {
    console.error(clc.redBright(`Uncaught Exception: ${err.message}`));
    client.destroy().then(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(clc.redBright(`Unhandled Rejection at: ${promise}, reason: ${reason}`));
    client.destroy().then(() => process.exit(1));
});
