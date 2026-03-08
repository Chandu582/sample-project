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
    inputField.placeholder = "Type ya bolo – mic try karein 🎤";
    sendBtn.disabled = false;
}

let systemContext = "";
let customApiKey = "";
let elevenLabsApiKey = ""; // Premium Ultra-Realistic Voice API Key
let elevenLabsVoiceId = ""; // e.g. EXAVITQu4vr4xnSDxMaL (Sarah - warm, human)
// Use a placeholder/demo key if none provided
const DEFAULT_GROQ_KEY = ""; 
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
                bottom: 25px; 
                right: 25px;
                height: 55px;
                padding: 0 20px; 
                background: linear-gradient(135deg, #f59e0b, #ea580c); 
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
            
            /* 🔥 FIX: Forcefully hide button when chat is open */
            body.chat-active #ai-chat-btn, 
            body.chat-active .status-float-btn {
                transform: scale(0) !important;
                opacity: 0 !important;
                visibility: hidden !important; 
                pointer-events: none !important;
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

            /* Chatbot Window - Premium feel */
            /* 🔥 FIX: Extreme Z-Index to stay above everything */
            #ai-chat-window {
                position: fixed;
                bottom: 110px;
                right: 30px;
                width: 360px;
                height: 520px;
                background: linear-gradient(180deg, #fffbeb 0%, #fff7ed 30%, #ffffff 100%);
                border-radius: 22px;
                box-shadow: 0 20px 50px rgba(234, 88, 12, 0.12), 0 0 0 1px rgba(251, 191, 36, 0.2);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                transform: translateY(20px);
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 99999 !important; 
                font-family: 'Plus Jakarta Sans', 'Poppins', sans-serif;
            }
            #ai-chat-window.active {
                transform: translateY(0);
                opacity: 1;
                pointer-events: auto;
            }

            /* Header - Premium warm gradient */
            .chat-header {
                background: linear-gradient(135deg, #f59e0b 0%, #ea580c 50%, #c2410c 100%);
                padding: 16px 20px;
                color: white;
                display: flex;
                align-items: center;
                justify-content: space-between;
                cursor: grab;
                box-shadow: 0 4px 15px rgba(234, 88, 12, 0.25);
            }
            .chat-header:active {
                cursor: grabbing;
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
                overscroll-behavior: contain; 
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
                box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                border: 1px solid #fef3c7;
                align-self: flex-start;
            }
            .bubble-bot.welcome-msg {
                background: linear-gradient(135deg, #fffbeb 0%, #fff7ed 100%);
                border-color: #fed7aa;
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
            
            /* 🔥 FIX: Perfect Mobile Adjustments 🔥 */
            @media (max-width: 600px) {
                #ai-chat-btn {
                    padding: 0;
                    width: 55px;
                    height: 55px;
                    border-radius: 50%;
                    bottom: 25px; 
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
                    height: calc(100vh - 120px); 
                    height: calc(100dvh - 120px);
                    max-height: 800px;
                    right: 15px !important;
                    bottom: 90px !important; 
                    left: auto !important;
                    top: auto !important;
                    transform: none !important; 
                }
                
                body.chat-keyboard-open #ai-chat-window {
                    height: calc(100vh - 20px) !important; /* 🔥 Fix: Keyboard ke upar ki poori space lega */
                    height: calc(100dvh - 20px) !important;
                    bottom: 10px !important; 
                }
                .chat-footer {
                    padding: 10px 10px;
                    gap: 8px; /* Slightly more gap */
                }
                .chat-input {
                    padding: 10px 15px; /* Better padding for text box */
                    font-size: 14px;
                    width: 100%; 
                }
                /* Lock the send and mic buttons so they never squish */
                .chat-send-btn, .mic-btn {
                    width: 42px !important;
                    height: 42px !important;
                    min-width: 42px !important;
                    font-size: 16px;
                    flex-shrink: 0 !important; 
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
                        <div class="chat-status"><span class="status-dot"></span> Here to help</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center;">
                    <i class="fas fa-volume-up" id="chatbot-speaker-btn" title="Listen to reply (Voice)" style="cursor: pointer; font-size: 18px; opacity: 0.9; margin-right: 15px; transition: 0.3s;" onmouseover="this.style.color='#fef3c7'" onmouseout="this.style.color='inherit'"></i>
                    <i class="fas fa-times" id="close-chat" title="Close Chat" style="cursor: pointer; font-size: 18px; opacity: 0.8; transition: 0.3s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='inherit'"></i>
                </div>
            </div>
            
            <div class="chat-body" id="chat-body">
                <div class="chat-bubble bubble-bot welcome-msg">
                    Namaste! 🙏 I'm here to help you—whether it's fees, timings, transport, or any question about your child's school. Just type or tap the mic to speak. I'm listening. ✨
                </div>
                <div class="typing-indicator" id="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>

            <div class="chat-footer">
                <input type="text" id="chat-input" class="chat-input" placeholder="Type ya bolo – mic try karein 🎤" autocomplete="off">
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
        e.stopPropagation(); 
        isChatOpen = !isChatOpen;
        if (isChatOpen) {
            chatWindow.classList.add("active");
            document.body.classList.add("chat-active");
            setTimeout(() => inputField.focus(), 300);
            if (!window.welcomeVoicePlayed && elevenLabsApiKey) {
                window.welcomeVoicePlayed = true;
                const welcomeEl = document.querySelector('.bubble-bot.welcome-msg');
                if (welcomeEl) {
                    const welcomeText = welcomeEl.textContent.trim();
                    setTimeout(() => speakResponse(welcomeText), 700);
                }
            }
        } else {
            closeChatbot();
        }
    });

    closeBtn.addEventListener("click", () => {
        closeChatbot();
    });

    inputField.addEventListener("focus", () => {
        if (window.innerWidth <= 600) {
            document.body.classList.add("chat-keyboard-open");
            setTimeout(() => {
                const chatBody = document.getElementById("chat-body");
                if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;
            }, 300);
        }
    });

    inputField.addEventListener("blur", () => {
        if (window.innerWidth <= 600) {
            setTimeout(() => {
                if (document.activeElement !== inputField) {
                    document.body.classList.remove("chat-keyboard-open");
                }
            }, 100);
        }
    });

    document.addEventListener("click", (event) => {
        if (isChatOpen && !chatWindow.contains(event.target) && !chatBtn.contains(event.target)) {
            closeChatbot();
        }
    });

    window.visualViewport?.addEventListener("resize", () => {
        if (isChatOpen) {
            const chatBody = document.getElementById("chat-body");
            if (chatBody) {
                setTimeout(() => { chatBody.scrollTop = chatBody.scrollHeight; }, 50);
            }
        }
    });

    makeDraggable(chatWindow, document.querySelector('.chat-header'));

    function makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        handle.onmousedown = dragMouseDown;
        handle.ontouchstart = dragTouchStart;

        function dragMouseDown(e) {
            if (window.innerWidth <= 600) return; 
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function dragTouchStart(e) {
            if (window.innerWidth <= 600) return;
            const touch = e.touches[0];
            pos3 = touch.clientX;
            pos4 = touch.clientY;
            document.ontouchend = closeDragElement;
            document.ontouchmove = elementTouchDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            updateElementPosition();
        }

        function elementTouchDrag(e) {
            const touch = e.touches[0];
            pos1 = pos3 - touch.clientX;
            pos2 = pos4 - touch.clientY;
            pos3 = touch.clientX;
            pos4 = touch.clientY;
            updateElementPosition();
        }

        function updateElementPosition() {
            let newTop = element.offsetTop - pos2;
            let newLeft = element.offsetLeft - pos1;

            if (newTop < 0) newTop = 0;
            if (newLeft < 0) newLeft = 0;
            if (newTop + element.offsetHeight > window.innerHeight) newTop = window.innerHeight - element.offsetHeight;
            if (newLeft + element.offsetWidth > window.innerWidth) newLeft = window.innerWidth - element.offsetWidth;

            element.style.top = newTop + "px";
            element.style.left = newLeft + "px";
            element.style.bottom = "auto";
            element.style.right = "auto";
            element.style.transform = "none";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
            document.ontouchend = null;
            document.ontouchmove = null;
        }
    }

    function closeChatbot() {
        window.currentAudioRequestId = (window.currentAudioRequestId || 0) + 1; 
        window.isPremiumAudioLoading = false;

        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        if (window.currentPremiumAudio) {
            window.currentPremiumAudio.pause();
            window.currentPremiumAudio.currentTime = 0;
        }

        const micBtn = document.getElementById("chatbot-speaker-btn");
        if (micBtn) micBtn.style.color = '';

        stopBackgroundMusic();

        isChatOpen = false;
        chatWindow.classList.remove("active");
        document.body.classList.remove("chat-active");
    }

    sendBtn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
    });

    sendBtn.addEventListener("click", handleUserMessage);
    inputField.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            handleUserMessage();
        }
    });
}

let publicNoticesContext = "";
let systemImages = [];

async function loadChatbotContext() {
    if (chatbotDb) {
        try {
            const doc = await chatbotDb.collection('settings').doc('chatbot_config').get();
            if (doc.exists) {
                const data = doc.data();
                if (data.context) {
                    systemContext = data.context;
                    console.log("SUCCESS: Loaded Admin Context from Firebase");
                }
                if (data.customApiKey) customApiKey = data.customApiKey;
                if (data.elevenLabsApiKey) elevenLabsApiKey = data.elevenLabsApiKey;
                if (data.elevenLabsVoiceId) elevenLabsVoiceId = data.elevenLabsVoiceId;
                if (data.structuredData && data.structuredData.images) {
                    systemImages = data.structuredData.images.map(img => img.url);
                    console.log("SUCCESS: Loaded Image Context from Firebase", systemImages.length);
                }
            }

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

    const sendBtn = document.getElementById("chat-send-btn");
    if (sendBtn) sendBtn.disabled = true;

    addMessageToChat(message, 'user');
    inputField.value = "";
    inputField.focus();

    showTypingIndicator();

    const apiKey = customApiKey || DEFAULT_GROQ_KEY;
    if (!apiKey) {
        hideTypingIndicator();
        addMessageToChat("Error: Groq API Key is missing. The administrator needs to configure this in the Chatbot Settings (https://console.groq.com/keys).", 'bot');
        return;
    }

    const messages = [];
    let extraContext = "";

    const bdayContainer = document.getElementById('birthday-display');
    if (bdayContainer && bdayContainer.innerText.trim()) {
        extraContext += `\nTODAY'S BIRTHDAYS (from website): \n${bdayContainer.innerText.trim()}\n`;
    }

    const noticeMarquee = document.getElementById('flash-marquee');
    if (noticeMarquee && noticeMarquee.innerText.trim() && !noticeMarquee.innerText.includes('Loading')) {
        extraContext += `\nLATEST NOTICES (from website): \n${noticeMarquee.innerText.trim()}\n`;
    }

    const toppersContainer = document.getElementById('toppers-display');
    if (toppersContainer && toppersContainer.innerText.trim()) {
        extraContext += `\nSCHOOL TOPPERS (from website): \n${toppersContainer.innerText.trim()}\n`;
    }

    const alumniContainer = document.getElementById('alumni-display');
    if (alumniContainer && alumniContainer.innerText.trim()) {
        extraContext += `\nOUR SUCCESSFUL ALUMNI (from website): \n${alumniContainer.innerText.trim()}\n`;
    }

    const systemPromptContent = `You are the warm, caring voice of St. Teresa English School—like a trusted receptionist or a friendly teacher who genuinely cares about every parent and student. Your tone is REAL and HUMAN: warm, respectful, and never robotic. Parents should feel they are talking to a real person who listens and cares.
PERSONALITY: Use a natural, conversational style. Add light, friendly emojis (😊✨🙏) where it feels natural—not in every sentence. Sound like someone who is happy to help, not a scripted bot. NEVER use phrases like "I'm here to help!", "How can I assist you today?", "Let's explore!"—instead, respond as a real person would: "Bilkul, yeh raha...", "Sure, aapko yeh batati hoon...", "Achha sawaal—yeh lo detail."
CRITICAL RULES:
1. NEVER assume gender. Use "Aap", "Dear Parent/Student", or "Sir/Madam" unless they tell you their name or gender.
2. TALK LIKE A REAL HUMAN: Be natural, varied, and warm. Perfect spelling and grammar in both English and Hindi/Hinglish.
3. Answer school questions ONLY from "SCHOOL INFORMATION CONTEXT". Never invent fees, timings, or numbers.
4. For STUDENT study questions (Science, Math, etc.): Answer directly and accurately. Do not redirect to school info.
5. IF A PARENT WANTS TO LEAVE (T.C/Withdraw): Be deeply empathetic. Listen first, ask what went wrong, then reassure them about St. Teresa's family environment, personal attention, and that Principal Bindu P.K is ready to resolve any issue. Make them feel heard and valued so they reconsider. 🥺
6. "Is this a good school?": Answer with genuine enthusiasm about discipline, safety, and values. Never say you don't know.
7. Birthdays, notices, toppers, alumni,every thing which present on index page means that page: Use "DYNAMIC PAGE DATA"; congratulate warmly  🎈.
8. If info is not in context: Apologise politely and suggest calling the office: +91-7632852762.
9. WHO MADE YOU: Say proudly that **Mr. Chandan Sharma (Xevion byte)** 👨‍💻 designed and developed this. Portfolio: https://chandu582.github.io/my-portfolio/. Contact: 9693776982 if they ask again.
10. JOKES/SONGS: Child-friendly only. Use [JOKE] or [SONG] tag at the start. Never repeat the same one; always pick something new and fun.
11. LANGUAGE: Reply in the SAME language as the user (English → English, Hindi/Hinglish → Hindi/Hinglish). Perfect grammar both ways.
12. TIMING: Give only the exact timing from context. No made-up class-wise breakups.
13. FEES: Tuition does NOT include transport, ID, diary, belt, uniform—these are separate. Quote only what is in context.
14. SCHOLARSHIPS: Only mention if in context; otherwise say to visit the office for fee queries.
15. HOSTEL: We provide hostel for boys and girls with food, accommodation, and special care for studies and activities.
16. ADMISSION STATUS: If asked about admission status, redirect to the website link: https://st-teresa-english-school.vercel.app/check-status.html
17. ADMISSION FORM: If asked about admission form, redirect to the website link: https://https://st-teresa-english-school.vercel.app/admission-form.html

SCHOOL INFORMATION CONTEXT:
${systemContext}

DYNAMIC PAGE DATA (Currently visible on the website):
${extraContext || 'No dynamic events today.'}`;

    let modelToUse = "llama-3.1-8b-instant";
    let visionModelsList = [];

    if (systemImages && systemImages.length > 0) {
        visionModelsList = [
            "llama-3.2-11b-vision-instruct",
            "llama-3.2-90b-vision-instruct",
            "meta-llama/llama-4-scout-17b-16e-instruct",
            "llama-3.2-11b-vision-preview",
            "llama-3.2-90b-vision-preview"
        ];
        modelToUse = visionModelsList[0];

        const contentArr = [{ type: "text", text: systemPromptContent }];
        systemImages.forEach(imgUrl => {
            contentArr.push({ type: "image_url", image_url: { url: imgUrl } });
        });

        messages.push({
            role: "user",
            content: contentArr
        });
        messages.push({
            role: "assistant",
            content: "Understood! I have studied the guidelines and the images provided. I am ready to help."
        });
    } else {
        messages.push({
            role: "system",
            content: systemPromptContent
        });
    }

    conversationHistory.push({ role: 'user', text: message });

    const recentHistory = conversationHistory.slice(-6);
    recentHistory.forEach(msg => {
        messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.text
        });
    });

    console.log("SENDING THIS CONTEXT TO AI:", systemContext);

    try {
        let botReply = "";
        let attemptList = visionModelsList.length > 0 ? visionModelsList : [modelToUse];
        let success = false;
        let lastError = null;

        for (let i = 0; i < attemptList.length; i++) {
            const currentModel = attemptList[i];
            const requestBody = {
                model: currentModel,
                messages: messages,
                temperature: 0.4, 
                frequency_penalty: 0.1, 
                presence_penalty: 0.0, 
                max_tokens: 800
            };

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
                if (data.error.message && (data.error.message.includes("decommissioned") || data.error.message.includes("not exist") || data.error.message.includes("not supported"))) {
                    console.warn(`Model ${currentModel} failed: ${data.error.message}. Trying next...`);
                    lastError = data.error.message;
                    continue; 
                } else {
                    throw new Error(data.error.message);
                }
            }

            botReply = data.choices[0].message.content;
            success = true;
            break; 
        }

        if (!success) {
            throw new Error(`All vision model attempts failed! Last error: ${lastError}`);
        }

        conversationHistory.push({ role: 'bot', text: botReply });

        let displayReply = botReply;
        displayReply = displayReply.replace(/\[SONG\]/g, '<span style="display:none" class="speech-tag">[SONG]</span>');
        displayReply = displayReply.replace(/\[JOKE\]/g, '<span style="display:none" class="speech-tag">[JOKE]</span>');

        const formattedReply = formatBotReply(displayReply);

        addMessageToChat(formattedReply, 'bot');

        if (window.isVoiceMode) {
            speakResponse(botReply);
            window.isVoiceMode = false; 
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

        if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === 'user') {
            conversationHistory.pop();
        }
    } finally {
        hideTypingIndicator(); 
    }
}

function speakResponse(text) {
    if (!('speechSynthesis' in window)) return;

    window.currentAudioRequestId = (window.currentAudioRequestId || 0) + 1;
    let thisRequestId = window.currentAudioRequestId;
    window.isPremiumAudioLoading = false;

    window.speechSynthesis.cancel();
    if (window.currentPremiumAudio) {
        window.currentPremiumAudio.pause();
        window.currentPremiumAudio.currentTime = 0;
    }
    stopBackgroundMusic();

    let isSong = text.includes('[SONG]');
    let isJoke = text.includes('[JOKE]');

    let emotion = 'neutral';
    if (text.match(/[🥺😔😢😭]|sorry|apologize|unfortunately/i)) {
        emotion = 'sad';
    } else if (text.match(/[🤩🥳🎉🎈✨🌟]|wow|congratulations|perfect|amazing/i)) {
        emotion = 'excited';
    } else if (text.match(/[😊🙂👋]/)) {
        emotion = 'friendly';
    }

    let cleanText = text.replace(/\[SONG\]/g, '').replace(/\[JOKE\]/g, '');
    cleanText = cleanText.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
    cleanText = cleanText.replace(/[*_#`~-]/g, ' '); 

    if (elevenLabsApiKey) {
        const speakerBtn = document.getElementById("chatbot-speaker-btn");
        if (speakerBtn) speakerBtn.style.color = '#8b5cf6';

        if (isSong) startBackgroundMusic('song');
        else if (isJoke) startBackgroundMusic('joke');

        const voiceId = (elevenLabsVoiceId && elevenLabsVoiceId.trim()) ? elevenLabsVoiceId.trim() : "EXAVITQu4vr4xnSDxMaL";

        window.isPremiumAudioLoading = true;

        fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'xi-api-key': elevenLabsApiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: cleanText,
                model_id: "eleven_multilingual_v2",
                voice_settings: {
                    stability: (emotion === 'sad' ? 0.7 : (emotion === 'excited' ? 0.3 : 0.5)),
                    similarity_boost: 0.75
                }
            })
        })
            .then(response => {
                if (!response.ok) throw new Error("ElevenLabs API failed");
                return response.blob();
            })
            .then(blob => {
                if (window.currentAudioRequestId !== thisRequestId) return; 
                window.isPremiumAudioLoading = false;

                const audioUrl = URL.createObjectURL(blob);
                const audio = new Audio();
                audio.preload = 'auto';
                audio.src = audioUrl;
                window.currentPremiumAudio = audio;

                audio.onended = () => {
                    stopBackgroundMusic();
                    if (speakerBtn) speakerBtn.style.color = '';
                    URL.revokeObjectURL(audioUrl); 
                };

                audio.addEventListener('canplaythrough', () => {
                    if (window.currentAudioRequestId !== thisRequestId) return;
                    audio.play().catch(err => console.warn('Audio play error:', err));
                }, { once: true });

                audio.load(); 
            })
            .catch(err => {
                console.error("Premium Voice Error: ", err);
                if (window.currentAudioRequestId !== thisRequestId) return;
                window.isPremiumAudioLoading = false;
                if (speakerBtn) speakerBtn.style.color = '';
                stopBackgroundMusic();
                fallbackBrowserTTS(cleanText, emotion, isSong, isJoke);
            });

        return; 
    }

    fallbackBrowserTTS(cleanText, emotion, isSong, isJoke);
}

const TTS_CHUNK_MAX = 180;

function chunkForTTS(text, isSongOrJoke) {
    const trimmed = text.trim();
    if (!trimmed.length) return [];
    if (trimmed.length <= TTS_CHUNK_MAX) return [trimmed];

    const chunks = [];
    if (isSongOrJoke) {
        const lines = trimmed.split(/\n+/).map(l => l.trim()).filter(Boolean);
        let buf = '';
        for (const line of lines) {
            const add = buf ? buf + ' ' + line : line;
            if (add.length <= TTS_CHUNK_MAX) buf = add;
            else {
                if (buf) { chunks.push(buf); buf = ''; }
                if (line.length <= TTS_CHUNK_MAX) buf = line;
                else {
                    let i = 0;
                    while (i < line.length) {
                        let sub = line.slice(i, i + TTS_CHUNK_MAX);
                        const lastSpace = sub.lastIndexOf(' ');
                        if (lastSpace > 100) sub = sub.slice(0, lastSpace + 1);
                        chunks.push(sub.trim());
                        i += sub.length;
                    }
                }
            }
        }
        if (buf) chunks.push(buf);
    } else {
        const parts = trimmed.match(/[^.!?\n]+[.!?\n]*/g) || [trimmed];
        let buf = '';
        for (const p of parts) {
            const add = (buf + p).trim();
            if (add.length <= TTS_CHUNK_MAX) buf = add;
            else {
                if (buf) { chunks.push(buf); buf = ''; }
                if (p.length <= TTS_CHUNK_MAX) buf = p.trim();
                else {
                    let i = 0;
                    while (i < p.length) {
                        let sub = p.slice(i, i + TTS_CHUNK_MAX);
                        const ls = sub.lastIndexOf(' ');
                        if (ls > 100) sub = sub.slice(0, ls + 1);
                        chunks.push(sub.trim());
                        i += sub.length;
                    }
                }
            }
        }
        if (buf) chunks.push(buf);
    }
    return chunks.filter(Boolean);
}

function fallbackBrowserTTS(cleanText, emotion, isSong, isJoke) {
    if (isSong) startBackgroundMusic('song');
    else if (isJoke) startBackgroundMusic('joke');

    function doSpeak(voices) {
        let selectedVoice = null;
        const preferredVoices = ['Microsoft Swara Online', 'Microsoft Neerja Online', 'Google हिन्दी', 'Microsoft Swara', 'Microsoft Neerja', 'Kajal', 'Aditi', 'Veena', 'Zira', 'Female'];
        for (let pref of preferredVoices) {
            selectedVoice = voices.find(v => v.name.includes(pref));
            if (selectedVoice) break;
        }
        if (!selectedVoice && voices.length > 0) selectedVoice = voices.find(v => v.lang.startsWith('hi')) || voices[0];

        const validSentences = chunkForTTS(cleanText, isSong || isJoke);
        if (validSentences.length === 0) return;

        let pitch = 1.2, rate = 0.95;
        if (emotion === 'sad') { pitch = 0.9; rate = 0.88; }
        else if (emotion === 'excited') { pitch = 1.35; rate = 1.05; }
        else if (emotion === 'friendly') { pitch = 1.25; rate = 1.0; }
        if (isSong) { pitch = 1.35; rate = 0.9; }
        else if (isJoke) { pitch = 1.3; rate = 1.0; }

        let keepAliveTimer = setInterval(() => {
            if (!window.speechSynthesis.speaking) {
                clearInterval(keepAliveTimer);
                return;
            }
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
        }, 10000);

        function speakNext(index) {
            if (index >= validSentences.length) {
                clearInterval(keepAliveTimer);
                stopBackgroundMusic();
                return;
            }
            const utterance = new SpeechSynthesisUtterance(validSentences[index]);
            utterance.lang = 'hi-IN';
            utterance.pitch = pitch;
            utterance.rate = rate;
            if (selectedVoice) utterance.voice = selectedVoice;
            
            utterance.onend = function () { speakNext(index + 1); };
            utterance.onerror = function () { speakNext(index + 1); };
            if (window.speechSynthesis.paused) window.speechSynthesis.resume();
            window.speechSynthesis.speak(utterance);
        }
        speakNext(0);
    }

    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
        doSpeak(voices);
    } else {
        window.speechSynthesis.onvoiceschanged = function () {
            window.speechSynthesis.onvoiceschanged = null;
            doSpeak(window.speechSynthesis.getVoices());
        };
    }
}

document.addEventListener('click', function (e) {
    const micBtn = e.target.closest('#chatbot-mic-btn');
    if (micBtn) {
        startListening(micBtn);
    }

    const speakerBtn = e.target.closest('#chatbot-speaker-btn');
    if (speakerBtn) {
        if (window.speechSynthesis.speaking || (window.currentPremiumAudio && !window.currentPremiumAudio.paused) || window.isPremiumAudioLoading) {
            window.currentAudioRequestId = (window.currentAudioRequestId || 0) + 1; 
            window.isPremiumAudioLoading = false;

            window.speechSynthesis.cancel();
            if (window.currentPremiumAudio) {
                window.currentPremiumAudio.pause();
                window.currentPremiumAudio.currentTime = 0;
            }
            stopBackgroundMusic();
            speakerBtn.style.color = ''; 
            return;
        }

        const botMessages = document.querySelectorAll('.bubble-bot');
        if (botMessages.length > 0) {
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
    recognition.lang = 'en-IN'; 
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = function () {
        micBtn.classList.add('listening');
        window.isVoiceMode = true; 
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
    bubble.innerHTML = text; 

    chatBody.insertBefore(bubble, typingIndicator);
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

// Background music functions kept for safety/logic
function startBackgroundMusic(type) { return; }
function stopBackgroundMusic() {}

function formatBotReply(text) {
    let html = text.replace(/\[SONG\]/g, '<span style="display:none;">[SONG]</span>');
    html = html.replace(/\[JOKE\]/g, '<span style="display:none;">[JOKE]</span>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n\n/g, '<br><br>');
    html = html.replace(/\n(?!\*)/g, '<br>');
    html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    return html;
}