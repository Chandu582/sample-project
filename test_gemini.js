const apiKey = "AIzaSyCNLZ3_RB7qTHvRArbVhkptanXYUPibgvs";

const requestBody = {
    system_instruction: {
        parts: [{ text: "You are a helpful AI." }]
    },
    contents: [
        {
            role: "user",
            parts: [{ text: "Hello" }]
        }
    ]
};

async function testGemini() {
    try {
        console.log("Sending request...");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        console.log("Response status:", response.status);
        const data = await response.json();
        console.log("Response data:", JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Test Error:", error);
    }
}

testGemini();
