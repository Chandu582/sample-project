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
            body.chat-active #ai-chat-btn, 
            body.chat-active .status-float-btn {
                transform: scale(0) !important;
                opacity: 0;
                pointer-events: none;
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

            /* Mobile rules have been consolidated at the bottom of the style tag */

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

            /* Voice Mic Button */
            .mic-btn {
                background: #f1f5f9;
                color: #64748b;
                border: none;
                width: 45px;
                height: 45px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                font-size: 18px;
                flex-shrink: 0;
            }
            .mic-btn:hover {
                background: #e2e8f0;
                color: #f59e0b;
                transform: scale(1.05);
            }
            .mic-btn.listening {
                background: #fef3c7;
                color: #ea580c;
                animation: pulse-mic 1.2s infinite;
            }
            @keyframes pulse-mic {
                0% { box-shadow: 0 0 0 0 rgba(234, 88, 12, 0.4); }
                70% { box-shadow: 0 0 0 10px rgba(234, 88, 12, 0); }
                100% { box-shadow: 0 0 0 0 rgba(234, 88, 12, 0); }
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
            
            @media (max-width: 600px) {
                #ai-chat-btn {
                    padding: 0;
                    width: 55px;
                    height: 55px;
                    border-radius: 50%;
                    bottom: 25px; /* Keep it nicely at the bottom corner */
                    right: 15px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                #ai-chat-btn .btn-text {
                    display: none;
                }
                #ai-chat-btn i {
                    font-size: 24px;
                    margin: 0;
                }
                
                #ai-chat-window {
                    width: calc(100% - 30px);
                    height: 450px; /* Reduced height to fit modern phones */
                    right: 15px;
                    bottom: 130px; /* Sits just above the Floating Button and keyboard */
                }
                .chat-footer {
                    padding: 10px 8px;
                    gap: 6px;
                }
                .chat-input {
                    padding: 10px 12px;
                    font-size: 13px;
                    width: 100%; /* Force it to stay strictly inside */
                }
                .chat-send-btn, .mic-btn {
                    width: 40px !important;
                    height: 40px !important;
                    font-size: 15px;
                    flex-shrink: 0; /* Prevent them from ever hiding */
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
                <div style="display: flex; align-items: center;">
                    <i class="fas fa-volume-up" id="chatbot-speaker-btn" title="Read Last Reply Aloud" style="cursor: pointer; font-size: 18px; opacity: 0.8; margin-right: 15px; transition: 0.3s;" onmouseover="this.style.color='#f59e0b'" onmouseout="this.style.color='inherit'"></i>
                    <i class="fas fa-times" id="close-chat" title="Close Chat" style="cursor: pointer; font-size: 18px; opacity: 0.8; transition: 0.3s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='inherit'"></i>
                </div>
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
                <button class="mic-btn" id="chatbot-mic-btn" title="Click to Speak"><i class="fas fa-microphone"></i></button>
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
            document.body.classList.add("chat-active");
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
        // Stop speaking immediately when closing the AI chat window
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }

        // Ensure background music also stops
        stopBackgroundMusic();

        isChatOpen = false;
        chatWindow.classList.remove("active");
        document.body.classList.remove("chat-active");
    }

    // Prevent input focus loss on send button tap/click
    sendBtn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
    });

    // Send Message
    sendBtn.addEventListener("click", handleUserMessage);
    inputField.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            handleUserMessage();
        }
    });
}

let publicNoticesContext = "";

async function loadChatbotContext() {
    if (chatbotDb) {
        try {
            // 1. Get Settings (Fees, Rules, Timings, API key)
            const doc = await chatbotDb.collection('settings').doc('chatbot_config').get();
            if (doc.exists) {
                const data = doc.data();
                if (data.context) {
                    systemContext = data.context;
                    console.log("SUCCESS: Loaded Admin Context from Firebase");
                }
                if (data.customApiKey) customApiKey = data.customApiKey;
            }

            // 2. Fetch Latest Public Notices from Firebase
            const noticeSnapshot = await chatbotDb.collection('notices')
                .orderBy('timestamp', 'desc')
                .limit(5)
                .get();

            if (!noticeSnapshot.empty) {
                publicNoticesContext = "\n\nRECENT FIREBASE NOTICES:\n";
                noticeSnapshot.forEach(nDoc => {
                    const nData = nDoc.data();
                    let dateStr = nData.date || "Recent";
                    publicNoticesContext += `- [${dateStr}] ${nData.title}: ${nData.body}\n`;
                });
                systemContext += publicNoticesContext;
                console.log("SUCCESS: Appended Firebase Notices to AI Context.");
            }

        } catch (err) {
            console.error("Could not load AI Context or Notices:", err);
        }
    } else {
        console.warn("chatbotDb not found. AI Context cannot be loaded.");
    }
}



async function handleUserMessage() {
    const inputField = document.getElementById("chat-input");
    const message = inputField.value.trim();
    if (!message) return;

    // Instantly disable the send button to prevent double clicks during processing
    const sendBtn = document.getElementById("chat-send-btn");
    if (sendBtn) sendBtn.disabled = true;

    // 1. Show User Message
    addMessageToChat(message, 'user');
    inputField.value = "";

    // Explicitly keep focus on input field (for mobile keyboard)
    inputField.focus();

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
        content: `You are the highly intelligent, friendly, empathetic and persuasive female AI Receptionist for St. Teresa English School. Your primary goal is to completely satisfy the curiosity of parents and students with a warm, human-like touch. YOU MUST USE EXCITING AND FRIENDLY EMOJIS (like 😊✨🌟🎓🏫) in your responses to make them feel highly engaging and premium!
CRITICAL RULES:
1. NEVER assume the user's gender. Do NOT automatically call everyone "Madam" or "Sir". Use neutral, respectful terms like "Friend", "Aap", or "Dear Parent/Student". If you must use a formal title and don't know the gender, use "Sir/Madam" together. You can only use a specific gendered title if the user explicitly tells you their gender or name.
2. NEVER repeat the exact same word or phrase multiple times in a row. Use varied, professional, natural human language.
3. Answer questions politely and directly based ONLY on the "SCHOOL INFORMATION CONTEXT". NEVER hallucinate or make up fake numbers, fake fees, or fake class-wise time schedules if they are not explicitly written in the context.
4. IF A PARENT WANTS TO WITHDRAW THEIR CHILD (T.C / Leaving School): Act like a highly empathetic human counselor, NEVER use a repetitive scripted response! First, express deep shock and sadness 🥺. Second, actively listen and gently ask what specific issue (studies, fees, behavior) caused this decision. Third, powerfully reassure them by highlighting St. Teresa's USPs: "We are a family, our teachers provide personal attention, and Principal Bindu P.K is always ready to personally solve any problem." Beg them (politely) to give the school one more chance to fix the issue. Make the parent feel extremely valued and heard so they change their mind!
5. IF ASKED FOR YOUR OPINION ("Is this a good school?"): NEVER say you don't know. Always respond enthusiastically ✨, highlighting that St. Teresa builds strong foundations with knowledge, discipline, safety, and modern values, making it the perfect choice!
6. If they ask about birthdays, notices, toppers, or alumni, check the "DYNAMIC PAGE DATA" section. Extract the names nicely and congratulate them 🎈.
7. If the exact answer is truly not in the context, politely apologize 😔 and suggest they contact the school office at +91-7632852762.
8. IF ASKED WHO CREATED/DEVELOPED/DESIGNED YOU OR THE WEBSITE: You MUST proudly say: "I, along with this wonderful school website, was designed and developed by **Mr. Chandan Sharma (Xevion byte)** 👨‍💻✨. You can view his amazing portfolio here: https://chandu582.github.io/my-portfolio/" don't say same sentence alwys i along this thing you made alwys new sentence by which they feel happy and satisfied.If someone asked about contact number then you say visit his portfolio website there you can find his contact number. if again he/she asked for contact number then you provide his contact number 9693776982.
9. IF ASKED FOR JOKES, SONGS, GAMES, OR FUN FACTS: YOU MUST BE STRICTLY CHILD-FRIENDLY & SCHOOL-APPROPRIATE. 🚫 ABSOLUTELY NO ROMANTIC SONGS, ADULT JOKES, OR INAPPROPRIATE CONTENT. 🚫 Instead, sing kid's nursery rhymes, motivational student songs, or tell clean, funny school jokes! To stop being boring, NEVER EVER repeat the same joke or song twice. ALWAYS pick a completely new and unique one. Act highly entertaining and excited! 🤩🎶. CRITICAL: If you are telling a joke, you MUST include the exact tag [JOKE] at the very beginning of your response. If you are singing a song or reciting a poem, you MUST include the exact tag [SONG] at the very beginning of your response.
10. STRICT LANGUAGE MATCHING: You MUST reply in the EXACT SAME LANGUAGE as the user's question. If the user asks in pure English, reply ONLY in pure English. If the user asks in Hindi or Hinglish (e.g., "fees kitni hai"), reply in Hindi/Hinglish. NEVER mix it up!
11. STRICT TIMING RULE: If the context only gives a single general school timing (e.g., 9:00 AM to 2:35 PM), simply tell them THAT exact timing. DO NOT mathematically divide or hallucinate class-wise breakups (like Nursery 9-12, 1st 9-1) unless it is explicitly written in the context!
12. STRICT FEE RULE: NEVER say that the Tuition Fee includes transport, ID Card, Belt, Diary, or Uniforms. ALWAYS clarify that Transport Fees and Extra Items (like ID card, diary, belt) are charged SEPARATELY. Provide their exact separate costs ONLY if they are listed in the context.
13. ZERO HALLUCINATION ON SCHOLARSHIPS/PROGRAMS: NEVER proactively bring up scholarships, discounts, or financial aid. If a user SPECIFICALLY asks about a scholarship, ONLY provide information if it is clearly written in the "SCHOOL INFORMATION CONTEXT". If there is NO scholarship mentioned in the context, you MUST politely say: "Currently, we do not have any special scholarship programs running. Please visit the school office for any fee-related queries." NEVER invent fake names or criteria.
14. we also provide hostel facility for boys and girls.we provide food, accommodation, and other facilities to the hostlers.There is also a special care for hostlers in studying and other activities.

SCHOOL INFORMATION CONTEXT:
${systemContext}

DYNAMIC PAGE DATA (Currently visible on the website):
${extraContext || 'No dynamic events today.'}`
    });

    // Save to local history FIRST
    conversationHistory.push({ role: 'user', text: message });

    // Add history (Limit to last 5 interactions to save tokens)
    // We only take the last 6 items since we just added the new user message
    const recentHistory = conversationHistory.slice(-6);
    recentHistory.forEach(msg => {
        messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.text
        });
    });

    console.log("SENDING THIS CONTEXT TO AI:", systemContext);

    const requestBody = {
        model: "llama-3.1-8b-instant", // Fast and free model
        messages: messages,
        temperature: 0.7, // Higher for more creative & varied answers (especially jokes/songs)
        frequency_penalty: 0.5, // Discourages repeating the same exact words
        presence_penalty: 0.4, // Encourages talking about new topics completely
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

        // Hide system tags but keep them in DOM for text-to-speech to detect later
        let displayReply = botReply;
        displayReply = displayReply.replace(/\[SONG\]/g, '<span style="display:none" class="speech-tag">[SONG]</span>');
        displayReply = displayReply.replace(/\[JOKE\]/g, '<span style="display:none" class="speech-tag">[JOKE]</span>');

        // Format basic markdown (bold, lists)
        const formattedReply = formatBotReply(displayReply);

        addMessageToChat(formattedReply, 'bot');

        // Only Speak Response if user asked via Microphone
        if (window.isVoiceMode) {
            speakResponse(botReply);
            window.isVoiceMode = false; // Reset for next message
        }

    } catch (error) {
        console.error("Groq API Error:", error);

        let errMsg = error.message;
        if (errMsg && (errMsg.includes("Quota") || errMsg.includes("429") || errMsg.includes("too many"))) {
            errMsg = "I am receiving too many questions right now! Google's Free AI limits have been reached. Please wait a few minutes and try again.";
        } else {
            errMsg = "Sorry, I am having trouble connecting to the school servers right now. Please try again later or contact the admin.";
        }

        addMessageToChat(errMsg, 'bot');
        speakResponse("Sorry, I am having trouble connecting right now.");

        // Remove the failed user message from history so it doesn't corrupt future context
        if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === 'user') {
            conversationHistory.pop();
        }
    } finally {
        hideTypingIndicator(); // Always re-enable button and hide indicator
    }
}

// --- VOICE INTEGRATION LOGIC ---

function speakResponse(text) {
    if (!('speechSynthesis' in window)) return;

    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    stopBackgroundMusic();

    let isSong = text.includes('[SONG]');
    let isJoke = text.includes('[JOKE]');

    // Clean text by removing emojis and markdown formatting for cleaner speech
    let cleanText = text.replace(/\[SONG\]/g, '').replace(/\[JOKE\]/g, '');
    cleanText = cleanText.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
    cleanText = cleanText.replace(/[*_#`~]/g, '');

    // Try to find a single consistent, premium female Indian/Hindi voice
    const voices = window.speechSynthesis.getVoices();
    let selectedVoice = null;

    // Split text into smaller sentences to prevent browser speech cutoff on long texts
    // BUT do NOT chunk songs/jokes because the pauses make it sound choppy (kat-kat-kar)
    let sentences = [cleanText];
    if (!isSong && !isJoke) {
        sentences = cleanText.match(/[^.!?\n]+[.!?\n]*/g) || [cleanText];
    }

    // Priority order for the best Hindi + English mix female voices
    const preferredVoices = ['Google हिन्दी', 'Microsoft Swara', 'Microsoft Neerja', 'Zira', 'Aditi', 'Veena', 'Female'];

    for (let pref of preferredVoices) {
        selectedVoice = voices.find(v => v.name.includes(pref));
        if (selectedVoice) break;
    }

    if (isSong) startBackgroundMusic('song');
    else if (isJoke) startBackgroundMusic('joke');

    let sentencesSpoken = 0;

    // Queue each sentence
    sentences.forEach((sentence, index) => {
        if (sentence.trim() === '') return;
        const utterance = new SpeechSynthesisUtterance(sentence.trim());
        utterance.lang = 'hi-IN'; // Force Hindi-India locale

        // Make it sound rhythmic and sing-songy if it's a song/poem
        // Milder pitch/rate adjustments because extreme ones make the TTS voice glitch/stutter
        if (isSong) {
            utterance.rate = 0.95;
            utterance.pitch = 1.2;
        } else if (isJoke) {
            utterance.rate = 1.05;
            utterance.pitch = 1.15;
        } else {
            utterance.rate = 1.0;
            utterance.pitch = 1.1;
        }

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        utterance.onend = function () {
            sentencesSpoken++;
            if (sentencesSpoken === sentences.length - 1 || sentences.length === 1 || sentencesSpoken === sentences.filter(s => s.trim() !== '').length) {
                stopBackgroundMusic();
            }
        };

        window.speechSynthesis.speak(utterance);
    });
}

// Setup Mic Event bindings must be added in setupChatbotEvents() or here.
// We will assign it dynamically to the document since HTML is injected.
document.addEventListener('click', function (e) {
    const micBtn = e.target.closest('#chatbot-mic-btn');
    if (micBtn) {
        startListening(micBtn);
    }

    const speakerBtn = e.target.closest('#chatbot-speaker-btn');
    if (speakerBtn) {
        // If already speaking, stop it (Toggle OFF)
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            return;
        }

        // Otherwise find the last bot message and read it aloud (Toggle ON)
        const botMessages = document.querySelectorAll('.bubble-bot');
        if (botMessages.length > 0) {
            // Use textContent to grab the hidden [SONG]/[JOKE] tags, but visible text
            const lastMessage = botMessages[botMessages.length - 1].textContent;
            speakResponse(lastMessage);
        }
    }
});

function startListening(micBtn) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Sorry, your browser doesn't support voice recognition. Please use Google Chrome.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN'; // Set to Indian English to support both English and Hinglish correctly without forcing Devanagari.
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = function () {
        micBtn.classList.add('listening');
        window.isVoiceMode = true; // Mark as voice mode
        // Stop any currently playing audio so it doesn't listen to itself
        window.speechSynthesis.cancel();
    };

    recognition.onresult = function (event) {
        const transcript = event.results[0][0].transcript;
        const inputField = document.getElementById("chat-input");
        inputField.value = transcript;
    };

    recognition.onerror = function (event) {
        console.error("Speech Recognition Error: ", event.error);
        micBtn.classList.remove('listening');
        window.isVoiceMode = false;
    };

    recognition.onend = function () {
        micBtn.classList.remove('listening');

        // Auto send immediately when speaking stops
        const inputField = document.getElementById("chat-input");
        if (inputField.value.trim() !== '') {
            handleUserMessage();
        }
    };

    recognition.start();
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
    if (indicator) {
        indicator.style.display = "flex";
    }
    if (chatBody) {
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    const sendBtn = document.getElementById("chat-send-btn");
    if (sendBtn) sendBtn.disabled = true;
}

function hideTypingIndicator() {
    const indicator = document.getElementById("typing-indicator");
    if (indicator) {
        indicator.style.display = "none";
    }
    const sendBtn = document.getElementById("chat-send-btn");
    if (sendBtn) sendBtn.disabled = false;
}

// --- BACKGROUND MUSIC LOGIC ---
let audioCtx;
let musicInterval;

function startBackgroundMusic(type) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    stopBackgroundMusic(); // Clear existing

    // Simple magical chord notes for song/poem, quirky bouncy notes for joke
    const notes = type === 'joke' ? [200, 300, 200, 400] : [523.25, 659.25, 783.99, 1046.50];
    let i = 0;

    musicInterval = setInterval(() => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type === 'joke' ? 'triangle' : 'sine';
        osc.frequency.value = notes[i % notes.length];

        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        // Soft volume for background to avoid overpowering the voice
        gain.gain.linearRampToValueAtTime(0.02, audioCtx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);

        i++;
    }, type === 'joke' ? 400 : 350);
}

function stopBackgroundMusic() {
    if (musicInterval) {
        clearInterval(musicInterval);
        musicInterval = null;
    }
}

// Simple Markdown formatter for the bot response
function formatBotReply(text) {
    // Hide [SONG] and [JOKE] tags for display
    let html = text.replace(/\[SONG\]/g, '<span style="display:none;">[SONG]</span>');
    html = html.replace(/\[JOKE\]/g, '<span style="display:none;">[JOKE]</span>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Newlines to BR
    html = html.replace(/\n\n/g, '<br><br>');
    html = html.replace(/\n(?!\*)/g, '<br>');

    // Lists (Basic mapping)
    html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    return html;
}
