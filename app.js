const firebaseConfig = {
    apiKey: "AIzaSyBsdhi-i7-BWT6M1ActSfdxDhYxN17Ui4Q",
    authDomain: "simple-chat-6666.firebaseapp.com",
    projectId: "simple-chat-6666",
    storageBucket: "simple-chat-6666.firebasestorage.app",
    messagingSenderId: "156972927588",
    appId: "1:156972927588:web:25a9a2a7d839f7501fed71",
    measurementId: "G-NJ0C6Z181T"
  };

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const messagesBox = document.getElementById('messages-box');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    try {
        await db.collection("messages").add({
            text: text,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        messageInput.value = ""; 
    } catch (e) {
        console.error("Error:", e);
        alert("Error! Check the console");
    }
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

db.collection("messages").orderBy("createdAt", "asc")
    .onSnapshot((snapshot) => {
        messagesBox.innerHTML = ""; 
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.text) {
                const msgDiv = document.createElement('div');
                msgDiv.classList.add('msg');
                msgDiv.textContent = data.text; 
                messagesBox.appendChild(msgDiv);
            }
        });
        messagesBox.scrollTop = messagesBox.scrollHeight; 
    });

const clearBtn = document.getElementById('clear-btn');

clearBtn.addEventListener('click', async () => {
    if (confirm("Clear all chat messages?")) {
        try {
            const snapshot = await db.collection("messages").get();
            
            const promises = snapshot.docs.map(doc => doc.ref.delete());
            await Promise.all(promises);
            
        } catch (e) {
            console.error("Error:", e);
            alert("Cannot clear chat history");
        }
    }
});
