// chatbot.js
// Handles the floating AI Chatbot for S.T.E.S 

document.addEventListener("DOMContentLoaded", () => {
    // 1. Inject Chatbot UI into the page
    injectChatbotUI();

    // 2. Setup Event Listeners
    setupChatbotEvents();

    // 3. Initialize Chatbot
    initChatbot();
});

async function initChatbot() {
    const inputField = document.getElementById("chat-input");
    const sendBtn = document.getElementById("chat-send-btn");
    if (!inputField || !sendBtn) return;
    inputField.disabled = true;
    inputField.placeholder = "Loading school knowledge...";
    sendBtn.disabled = true;

    if (typeof firebase !== 'undefined') {
        chatbotDb = firebase.firestore();
    } else if (typeof db !== 'undefined') {
        chatbotDb = db;
    }

    if (chatbotDb) {
        await loadChatbotContext();
    } else {
        console.warn("Firebase not initialized in parent page, Chatbot will use fallback context.");
    }

    inputField.disabled = false;
    inputField.placeholder = "Type your question...";
    sendBtn.disabled = false;
}

let systemContext = "";
let customApiKey = "";
// Use a placeholder/demo key if none provided (Note: in production, fetching from backend is safer)
const DEFAULT_GROQ_KEY = ""; // Best to let user fill this in Admin Panel
let isChatOpen = false;
let chatbotDb = null;

// Conversation History Array for Context
let conversationHistory = [];

function injectChatbotUI() {
    const chatHTML = `
        <style>
            /* Chatbot Floating Icon (Modern Pill Shape) */
            #ai-chat-btn {
                position: fixed;
                bottom: 25px; /* Moved down to separate from check status button */
                right: 25px;
                height: 55px;
                padding: 0 20px; 
                background: linear-gradient(135deg, #f59e0b, #ea580c); /* Vibrant Orange/Amber */
                border-radius: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                color: white;
                font-size: 15px;
                font-family: 'Plus Jakarta Sans', 'Poppins', sans-serif;
                font-weight: 600;
                box-shadow: 0 10px 25px rgba(234, 88, 12, 0.4), inset 0 2px 4px rgba(255,255,255,0.3);
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                z-index: 10000;
                border: 2px solid rgba(255,255,255,0.8);
                animation: floatBtn 3s ease-in-out infinite;
            }
            #ai-chat-btn:hover {
                transform: scale(1.05) translateY(-5px);
                box-shadow: 0 15px 35px rgba(234, 88, 12, 0.6);
            }
            #ai-chat-btn i {
                font-size: 22px;
                animation: pulseIcon 2s infinite;
            }

            @keyframes floatBtn {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-8px); }
            }
            @keyframes pulseIcon {
                0% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.15); opacity: 0.8; }
                100% { transform: scale(1); opacity: 1; }
            }

            /* Responsive: Shrink to circle on Mobile */
            @media (max-width: 600px) {
                #ai-chat-btn {
                    padding: 0;
                    width: 55px;
                    border-radius: 50%;
                    bottom: 50px; /* Raised to prevent hiding behind screen edge */
                    right: 15px;
                }
                #ai-chat-btn .btn-text {
                    display: none; /* Hide text on mobile */
                }
                #ai-chat-btn i {
                    font-size: 26px;
                    margin: 0;
                }
            }

            /* Chatbot Window */
            #ai-chat-window {
                position: fixed;
                bottom: 110px;
                right: 30px;
                width: 350px;
                height: 500px;
                background: white;
                border-radius: 20px;
                box-shadow: 0 15px 40px rgba(0, 0, 0, 0.15);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                transform: translateY(20px);
                opacity: 0;
                pointer-events: none;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 9999;
                font-family: 'Plus Jakarta Sans', 'Poppins', sans-serif;
            }
            #ai-chat-window.active {
                transform: translateY(0);
                opacity: 1;
                pointer-events: all;
            }

            /* Header */
            .chat-header {
                background: linear-gradient(135deg, #f59e0b, #ea580c);
                padding: 20px;
                color: white;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .chat-header-info {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .chat-avatar {
                width: 40px;
                height: 40px;
                background: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #ea580c;
                font-size: 20px;
            }
            .chat-title {
                font-size: 16px;
                font-weight: 700;
                margin: 0;
            }
            .chat-status {
                font-size: 11px;
                opacity: 0.9;
                display: flex;
                align-items: center;
                gap: 5px;
            }
            .status-dot {
                width: 6px;
                height: 6px;
                background: #4ade80;
                border-radius: 50%;
                display: inline-block;
            }

            /* Body */
            .chat-body {
                flex: 1;
                padding: 20px;
                overflow-y: auto;
                background: #f8fafc;
                display: flex;
                flex-direction: column;
                gap: 15px;
            }
            .chat-body::-webkit-scrollbar { width: 5px; }
            .chat-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 5px; }

            /* Bubbles */
            .chat-bubble {
                max-width: 80%;
                padding: 12px 16px;
                border-radius: 18px;
                font-size: 14px;
                line-height: 1.5;
                animation: popIn 0.3s ease forwards;
            }
            .bubble-bot {
                background: white;
                color: #334155;
                font-weight: 500;
                border-bottom-left-radius: 5px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.02);
                border: 1px solid #e2e8f0;
                align-self: flex-start;
            }
            .bubble-user {
                background: #f59e0b;
                color: white;
                border-bottom-right-radius: 5px;
                align-self: flex-end;
            }

            /* Typing Indicator */
            .typing-indicator {
                display: flex;
                gap: 4px;
                padding: 12px 16px;
                background: white;
                border-radius: 18px;
                align-self: flex-start;
                border-bottom-left-radius: 5px;
                border: 1px solid #e2e8f0;
                display: none;
            }
            .typing-indicator span {
                width: 6px;
                height: 6px;
                background: #94a3b8;
                border-radius: 50%;
                animation: bounce 1.4s infinite ease-in-out both;
            }
            .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
            .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

            /* Footer */
            .chat-footer {
                padding: 15px;
                background: white;
                border-top: 1px solid #e2e8f0;
                display: flex;
                gap: 10px;
            }
            .chat-input {
                flex: 1;
                padding: 12px 15px;
                border: 1px solid #e2e8f0;
                border-radius: 20px;
                outline: none;
                font-size: 14px;
                font-family: inherit;
                transition: 0.3s;
                background: #f8fafc;
            }
            .chat-input:focus {
                border-color: #f59e0b;
                background: white;
            }
            .chat-send-btn {
                background: #f59e0b;
                color: white;
                border: none;
                width: 45px;
                height: 45px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: 0.3s;
                font-size: 16px;
            }
            .chat-send-btn:hover {
                background: #ea580c;
                transform: scale(1.05);
            }
            .chat-send-btn:disabled {
                background: #cbd5e1;
                cursor: not-allowed;
            }

            @keyframes popIn {
                0% { opacity: 0; transform: translateY(10px) scale(0.95); }
                100% { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes bounce {
                0%, 80%, 100% { transform: scale(0); }
                40% { transform: scale(1); }
            }

            /* Markdown styles in chat */
            .bubble-bot strong { color: #1e293b; font-weight: 700; }
            .bubble-bot ul { margin: 5px 0; padding-left: 20px; }
            .bubble-bot li { margin-bottom: 3px; }
            
            @media (max-width: 400px) {
                #ai-chat-window {
                    width: calc(100% - 40px);
                    right: 20px;
                    bottom: 100px;
                }
            }
        </style>

        <div id="ai-chat-btn" title="Chat with AI Assistant">
            <i class="fas fa-robot"></i>
            <span class="btn-text">Ask AI</span>
        </div>

        <div id="ai-chat-window">
            <div class="chat-header">
                <div class="chat-header-info">
                    <div class="chat-avatar"><i class="fas fa-robot"></i></div>
                    <div>
                        <h4 class="chat-title">S.T.E.S AI Assistant</h4>
                        <div class="chat-status"><span class="status-dot"></span> Online</div>
                    </div>
                </div>
                <i class="fas fa-times" id="close-chat" style="cursor: pointer; font-size: 18px; opacity: 0.8;"></i>
            </div>
            
            <div class="chat-body" id="chat-body">
                <div class="chat-bubble bubble-bot">
                    Hello! 👋 I am the S.T.E.S AI Assistant. How can I help you today? You can ask me about admissions, fees, timings, or rules.
                </div>
                <!-- Typing Indicator -->
                <div class="typing-indicator" id="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>

            <div class="chat-footer">
                <input type="text" id="chat-input" class="chat-input" placeholder="Type your question..." autocomplete="off">
                <button class="chat-send-btn" id="chat-send-btn"><i class="fas fa-paper-plane"></i></button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', chatHTML);
}

function setupChatbotEvents() {
    const chatBtn = document.getElementById("ai-chat-btn");
    const chatWindow = document.getElementById("ai-chat-window");
    const closeBtn = document.getElementById("close-chat");
    const sendBtn = document.getElementById("chat-send-btn");
    const inputField = document.getElementById("chat-input");

    // Toggle Chat Window
    chatBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // prevent document click from closing it immediately
        isChatOpen = !isChatOpen;
        if (isChatOpen) {
            chatWindow.classList.add("active");
            chatBtn.innerHTML = '<i class="fas fa-times"></i>'; // Optional: X icon when open
            setTimeout(() => inputField.focus(), 300);
        } else {
            closeChatbot();
        }
    });

    closeBtn.addEventListener("click", () => {
        closeChatbot();
    });

    // Close on click outside
    document.addEventListener("click", (event) => {
        if (isChatOpen && !chatWindow.contains(event.target) && !chatBtn.contains(event.target)) {
            closeChatbot();
        }
    });

    // Helper to close chat and reset button icon
    function closeChatbot() {
        isChatOpen = false;
        chatWindow.classList.remove("active");
        chatBtn.innerHTML = '<i class="fas fa-robot"></i><span class="btn-text">Ask AI</span>';
    }

    // Send Message
    sendBtn.addEventListener("click", handleUserMessage);
    inputField.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            handleUserMessage();
        }
    });
}

async function loadChatbotContext() {
    if (chatbotDb) {
        try {
            const doc = await chatbotDb.collection('settings').doc('chatbot_config').get();
            if (doc.exists) {
                const data = doc.data();
                if (data.context) {
                    systemContext = data.context;
                    console.log("SUCCESS: Loaded Admin Context from Firebase:", systemContext);
                } else {
                    console.warn("WARNING: chatbot_config document exists, but 'context' field is empty.");
                }
                if (data.customApiKey) customApiKey = data.customApiKey;
            } else {
                console.log("No custom chatbot_config found in Firebase.");
            }
        } catch (err) {
            console.error("Could not load AI Context:", err);
        }
    } else {
        console.warn("chatbotDb not found. AI Context cannot be loaded.");
    }
}



async function handleUserMessage() {
    const inputField = document.getElementById("chat-input");
    const message = inputField.value.trim();
    if (!message) return;

    // 1. Show User Message
    addMessageToChat(message, 'user');
    inputField.value = "";

    // 2. Show Typing Indicator
    showTypingIndicator();

    // 3. Prepare Prompt
    const apiKey = customApiKey || DEFAULT_GROQ_KEY;
    if (!apiKey) {
        hideTypingIndicator();
        addMessageToChat("Error: Groq API Key is missing. The administrator needs to configure this in the Chatbot Settings (https://console.groq.com/keys).", 'bot');
        return;
    }

    // Build the Conversation Structure for Groq (OpenAI format)
    const messages = [];

    // --- DYNAMIC SCRAPING OF THE PAGE ---
    let extraContext = "";

    // Check for birthdays on the page
    const bdayContainer = document.getElementById('birthday-display');
    if (bdayContainer && bdayContainer.innerText.trim()) {
        extraContext += `\nTODAY'S BIRTHDAYS (from website): \n${bdayContainer.innerText.trim()}\n`;
    }

    // Check for notices/marquees on the page
    const noticeMarquee = document.getElementById('flash-marquee');
    if (noticeMarquee && noticeMarquee.innerText.trim() && !noticeMarquee.innerText.includes('Loading')) {
        extraContext += `\nLATEST NOTICES (from website): \n${noticeMarquee.innerText.trim()}\n`;
    }

    // Check for School Toppers on the page
    const toppersContainer = document.getElementById('toppers-display');
    if (toppersContainer && toppersContainer.innerText.trim()) {
        extraContext += `\nSCHOOL TOPPERS (from website): \n${toppersContainer.innerText.trim()}\n`;
    }

    // Check for Alumni on the page
    const alumniContainer = document.getElementById('alumni-display');
    if (alumniContainer && alumniContainer.innerText.trim()) {
        extraContext += `\nOUR SUCCESSFUL ALUMNI (from website): \n${alumniContainer.innerText.trim()}\n`;
    }

    // System prompt
    messages.push({
        role: "system",
        content: `You are the friendly, enthusiastic, and highly persuasive AI Receptionist for St. Teresa English School. 
CRITICAL RULE: Answer parents' questions politely based on the "SCHOOL INFORMATION CONTEXT" below. 
If someone asks for your opinion (e.g., "Is this a good school?"), DO NOT say you don't know. Always respond positively: highlight that St. Teresa English School builds strong foundations with knowledge, discipline, and values. Encourage them to take admission.
If asked about today's birthdays, notices, school toppers, or alumni, check the "DYNAMIC PAGE DATA" section below. Extract the names from the provided text and present them clearly and beautifully to the user.

SCHOOL INFORMATION CONTEXT:
${systemContext}

DYNAMIC PAGE DATA (Currently visible on the website):
${extraContext || 'No dynamic events today.'}`
    });

    // Add history (Limit to last 5 interactions to save tokens)
    const recentHistory = conversationHistory.slice(-5);
    recentHistory.forEach(msg => {
        messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.text
        });
    });

    // Add current message
    messages.push({
        role: "user",
        content: message
    });

    // Save to local history
    conversationHistory.push({ role: 'user', text: message });

    console.log("SENDING THIS CONTEXT TO AI:", systemContext);

    const requestBody = {
        model: "llama-3.1-8b-instant", // Fast and free model
        messages: messages,
        temperature: 0.3, // Keep it factual
        max_tokens: 800
    };

    try {
        const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        const botReply = data.choices[0].message.content;

        // Save to local history
        conversationHistory.push({ role: 'bot', text: botReply });

        // Format basic markdown (bold, lists)
        const formattedReply = formatBotReply(botReply);

        hideTypingIndicator();
        addMessageToChat(formattedReply, 'bot');

    } catch (error) {
        console.error("Groq API Error:", error);
        hideTypingIndicator();

        let errMsg = error.message;
        if (errMsg && (errMsg.includes("Quota") || errMsg.includes("429") || errMsg.includes("too many"))) {
            errMsg = "I am receiving too many questions right now! Google's Free AI limits have been reached. Please wait a few minutes and try again.";
        } else {
            errMsg = "Sorry, I am having trouble connecting to the school servers right now. Please try again later or contact the admin.";
        }

        addMessageToChat(errMsg, 'bot');

        // Remove the failed user message from history so it doesn't corrupt future context
        if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === 'user') {
            conversationHistory.pop();
        }
    }
}

function addMessageToChat(text, sender) {
    const chatBody = document.getElementById("chat-body");
    const typingIndicator = document.getElementById("typing-indicator");

    const bubble = document.createElement("div");
    bubble.className = `chat-bubble bubble-${sender}`;
    bubble.innerHTML = text; // Using innerHTML because bot reply might have formatted HTML

    // Insert before typing indicator
    chatBody.insertBefore(bubble, typingIndicator);

    // Scroll to bottom
    chatBody.scrollTop = chatBody.scrollHeight;
}

function showTypingIndicator() {
    const indicator = document.getElementById("typing-indicator");
    const chatBody = document.getElementById("chat-body");
    indicator.style.display = "flex";
    chatBody.scrollTop = chatBody.scrollHeight;

    const sendBtn = document.getElementById("chat-send-btn");
    sendBtn.disabled = true;
}

function hideTypingIndicator() {
    const indicator = document.getElementById("typing-indicator");
    indicator.style.display = "none";

    const sendBtn = document.getElementById("chat-send-btn");
    sendBtn.disabled = false;
}

// Simple Markdown formatter for the bot response
function formatBotReply(text) {
    // Bold
    let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Newlines to BR
    html = html.replace(/\n\n/g, '<br><br>');
    html = html.replace(/\n(?!\*)/g, '<br>');

    // Lists (Basic mapping)
    html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    return html;
}
