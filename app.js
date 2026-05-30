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

let currentUserId = null; 
let currentUsername = "User"; 
let currentRoomId = null; 
let unsubscribeMessages = null; 
let globalRoomsCache = []; 

const authContainer = document.getElementById('auth-container'); 
const mainChatContainer = document.getElementById('main-chat-container'); 
const googleAuthBtn = document.getElementById('google-auth-btn'); 

const messagesBox = document.getElementById('messages-box'); 
const messageInput = document.getElementById('message-input'); 
const sendBtn = document.getElementById('send-btn'); 
// Находим контейнер строки ввода, чтобы скрывать/показывать его целиком
const inputContainer = document.getElementById('input-container') || messageInput.parentNode; 

const roomSelect = document.getElementById('room-select'); 
const currentRoomTitle = document.getElementById('current-room-title'); 
const userDisplayName = document.getElementById('user-display-name'); 
const logoutBtn = document.getElementById('logout-btn'); 

const sidebar = document.getElementById('sidebar'); 
const sidebarOverlay = document.getElementById('sidebar-overlay'); 
const menuToggle = document.getElementById('menu-toggle'); 
const closeSidebar = document.getElementById('close-sidebar'); 

const openManagerBtn = document.getElementById('open-manager-btn'); 
const closeManagerBtn = document.getElementById('close-manager-btn'); 
const chatsManagerModal = document.getElementById('chats-manager-modal'); 
const managerRoomsList = document.getElementById('manager-rooms-list'); 

const customConfirm = document.getElementById('custom-confirm'); 
const confirmMessage = document.getElementById('confirm-message'); 
const confirmYes = document.getElementById('confirm-yes'); 
const confirmNo = document.getElementById('confirm-no'); 

const customAlert = document.getElementById('custom-alert'); 
const alertMessage = document.getElementById('alert-message'); 
const alertOk = document.getElementById('alert-ok'); 

const customPrompt = document.getElementById('custom-prompt'); 
const promptMessage = document.getElementById('prompt-message'); 
const promptFriendEmail = document.getElementById('prompt-friend-email'); 
const promptRoomName = document.getElementById('prompt-room-name'); 
const promptSave = document.getElementById('prompt-save'); 
const promptCancel = document.getElementById('prompt-cancel'); 

const addMemberBtn = document.createElement('button'); 
addMemberBtn.id = 'add-member-btn'; 
addMemberBtn.className = 'sidebar-menu-btn'; 
addMemberBtn.style.marginTop = '10px'; 
addMemberBtn.innerHTML = 'Add friends by Email'; 
openManagerBtn.parentNode.insertBefore(addMemberBtn, openManagerBtn); 

firebase.auth().onAuthStateChanged((user) => { 
    if (user) { 
        currentUserId = user.uid; 
        currentUsername = user.displayName || "Без имени"; 
        userDisplayName.textContent = currentUsername; 
        
        db.collection("users").doc(user.uid).set({ 
            username: currentUsername, 
            email: user.email.toLowerCase() 
        }, { merge: true }); 

        authContainer.style.display = "none"; 
        mainChatContainer.style.display = "flex"; 
        
        initRoomsListener();
    } else { 
        authContainer.style.display = "block"; 
        mainChatContainer.style.display = "none"; 
        toggleSidebar(false); 
        if(unsubscribeMessages) { unsubscribeMessages(); unsubscribeMessages = null; }
        currentRoomId = null;
    } 
}); 

function toggleSidebar(show) { 
    if (show) { 
        sidebar.classList.add('open'); 
        sidebarOverlay.style.display = 'block'; 
    } else { 
        sidebar.classList.remove('open'); 
        sidebarOverlay.style.display = 'none'; 
    } 
} 

menuToggle.addEventListener('click', () => toggleSidebar(true)); 
closeSidebar.addEventListener('click', () => toggleSidebar(false)); 
sidebarOverlay.addEventListener('click', () => toggleSidebar(false)); 

googleAuthBtn.addEventListener('click', async () => { 
    const provider = new firebase.auth.GoogleAuthProvider(); 
    try { 
        await firebase.auth().signInWithPopup(provider); 
    } catch (error) { 
        console.error("Google auth error:", error); 
        await showCustomAlert("Error: " + error.message); 
    } 
}); 

logoutBtn.addEventListener('click', async () => { 
    const confirmed = await showCustomConfirm("Are you sure you want to log out?"); 
    if (confirmed) firebase.auth().signOut(); 
}); 

async function sendMessage() { 
    const text = messageInput.value.trim(); 
    if (!text || !currentRoomId) return; 
    try { 
        await db.collection("rooms").doc(currentRoomId).collection("messages").add({ 
            text: text, 
            userId: currentUserId, 
            username: currentUsername, 
            createdAt: firebase.firestore.FieldValue.serverTimestamp() 
        }); 
        messageInput.value = ""; 
    } catch (e) { 
        console.error("Error sending message:", e); 
        await showCustomAlert("Error! Check the console"); 
    } 
} 

sendBtn.addEventListener('click', sendMessage); 
messageInput.addEventListener('keypress', (e) => { 
    if (e.key === 'Enter') sendMessage(); 
}); 

function loadMessages(roomId) { 
    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    } 
    
    if (!roomId) { 
        currentRoomTitle.textContent = "No active chats"; 
        messagesBox.innerHTML = ` <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #ff61ea; font-family: sans-serif; gap: 10px;"> <span style="font-size: 48px; text-shadow: 0 0 15px rgba(255, 97, 234, 0.4);">✨</span> <h3 style="font-size: 20px; font-weight: bold;">No chats available</h3> <p style="font-size: 14px; opacity: 0.6; color: #ffdbe8;">Create a new chat room to start!</p> </div> `; 
        
        // Прячем строку ввода, если нет активного чата
        if (inputContainer) inputContainer.style.display = 'none';
        return; 
    } 
    
    // Показываем строку ввода, если чат открыт
    if (inputContainer) inputContainer.style.display = 'flex';

    unsubscribeMessages = db.collection("rooms").doc(roomId).collection("messages") 
        .orderBy("createdAt", "asc") 
        .onSnapshot((snapshot) => { 
            messagesBox.innerHTML = ""; 
            snapshot.forEach((doc) => { 
                const data = doc.data(); 
                if (!data.text) return; 
                
                const msgDiv = document.createElement('div'); 
                msgDiv.classList.add('msg'); 
                const nameSpan = document.createElement('strong'); 
                nameSpan.textContent = data.username || "Guest"; 
                nameSpan.style.display = "block"; 
                nameSpan.style.fontSize = "12px"; 
                nameSpan.style.marginBottom = "4px"; 
                const textSpan = document.createElement('span'); 
                textSpan.textContent = data.text; 
                const footerDiv = document.createElement('div'); 
                footerDiv.style.display = "flex"; 
                footerDiv.style.justifyContent = "space-between"; 
                footerDiv.style.alignItems = "center"; 
                footerDiv.style.gap = "10px"; 
                footerDiv.style.marginTop = "4px"; 
                const timeDiv = document.createElement('div'); 
                timeDiv.textContent = formatTime(data.createdAt); 
                timeDiv.style.fontSize = "10px"; 
                timeDiv.style.opacity = "0.6"; 
                footerDiv.appendChild(timeDiv); 
                msgDiv.appendChild(nameSpan); 
                msgDiv.appendChild(textSpan); 
                msgDiv.appendChild(footerDiv); 
                
                if (data.userId === currentUserId) { 
                    msgDiv.setAttribute('style', 'align-self: flex-end;'); 
                    nameSpan.style.color = '#ff61ea'; 
                    const deleteBtn = document.createElement('button'); 
                    deleteBtn.innerHTML = "Delete"; 
                    deleteBtn.classList.add('delete-msg-btn'); 
                    deleteBtn.addEventListener('click', async () => { 
                        const confirmed = await showCustomConfirm("Delete this message?"); 
                        if (confirmed) { 
                            try { 
                                await db.collection("rooms").doc(currentRoomId).collection("messages").doc(doc.id).delete(); 
                            } catch (e) { 
                                console.error("Error deleting message:", e); 
                                await showCustomAlert("Cannot delete message"); 
                            } 
                        } 
                    }); 
                    footerDiv.appendChild(deleteBtn); 
                } else { 
                    msgDiv.setAttribute('style', 'align-self: flex-start;'); 
                    nameSpan.style.color = '#ff9ed2'; 
                } 
                messagesBox.appendChild(msgDiv); 
            }); 
            messagesBox.scrollTop = messagesBox.scrollHeight; 
        }); 
} 

function initRoomsListener() {
    db.collection("rooms") 
        .where("members", "array-contains", currentUserId) 
        .orderBy("createdAt", "asc") 
        .onSnapshot((snapshot) => { 
            roomSelect.innerHTML = ''; 
            globalRoomsCache = []; 
            
            if (snapshot.empty) { 
                currentRoomId = null; 
                const noChatOption = document.createElement('option'); 
                noChatOption.textContent = "No active chats"; 
                noChatOption.disabled = true; 
                roomSelect.appendChild(noChatOption); 
                loadMessages(null); 
                renderManagerList(); 
                return; 
            } 
            
            let hasCurrentRoom = false;
            
            snapshot.forEach((doc) => { 
                const room = doc.data(); 
                globalRoomsCache.push({ id: doc.id, name: room.name }); 
                
                const option = document.createElement('option'); 
                option.value = doc.id; 
                option.textContent = `${room.name}`; 
                
                if (doc.id === currentRoomId) { 
                    option.selected = true; 
                    currentRoomTitle.textContent = `${room.name}`; 
                    hasCurrentRoom = true;
                } 
                roomSelect.appendChild(option); 
            }); 
            
            if (!currentRoomId || !hasCurrentRoom) { 
                currentRoomId = snapshot.docs[0].id; 
                roomSelect.value = currentRoomId; 
                currentRoomTitle.textContent = `${snapshot.docs[0].data().name}`;
                loadMessages(currentRoomId); 
            } 
            renderManagerList(); 
        }, (error) => {
            console.error("Snapshot rooms error:", error);
        }); 
}

async function actionCreateRoom() { 
    const promptData = await showCustomPrompt("Create New Chat"); 
    if (!promptData) return; 
    
    const { email, roomNameInput } = promptData;
    
    if (!email) {
        await showCustomAlert("Friend's Email is required!");
        return;
    }
    
    try { 
        const userSnapshot = await db.collection("users").where("email", "==", email.toLowerCase()).get(); 
        if (userSnapshot.empty) { 
            await showCustomAlert("User with this Email not found!"); 
            return; 
        } 
        
        const friendId = userSnapshot.docs[0].id; 
        const friendData = userSnapshot.docs[0].data(); 
        
        if (friendId === currentUserId) {
            await showCustomAlert("You cannot create a chat with yourself!");
            return;
        }

        let roomName = roomNameInput ? roomNameInput.trim() : "";
        if (!roomName) {
            roomName = `${friendData.username}`;
        }

        const existingRoomsSnapshot = await db.collection("rooms")
            .where("members", "array-contains", currentUserId)
            .get();

        let duplicateRoomId = null;

        existingRoomsSnapshot.forEach((doc) => {
            const roomData = doc.data();
            if (roomData.name === roomName && roomData.members && roomData.members.includes(friendId)) {
                duplicateRoomId = doc.id;
                roomName = roomData.name;
            }
        });

        if (duplicateRoomId) {
            currentRoomId = duplicateRoomId;
            roomSelect.value = duplicateRoomId;
            currentRoomTitle.textContent = `${roomName}`;
            loadMessages(duplicateRoomId);
            await showCustomAlert(`Chat named "${roomName}" with this user already exists! Switched to it.`);
            return;
        }
        
        const docRef = await db.collection("rooms").add({ 
            name: roomName, 
            createdAt: firebase.firestore.FieldValue.serverTimestamp(), 
            members: [currentUserId, friendId] 
        }); 
        
        currentRoomId = docRef.id; 
        currentRoomTitle.textContent = `${roomName}`;
        loadMessages(currentRoomId);
        
        await showCustomAlert(`Chat "${roomName}" successfully created!`); 
    } catch (e) { 
        console.error("Error creating chat:", e); 
        await showCustomAlert("Failed to create chat."); 
    } 
} 

async function actionAddMemberToChat() { 
    if (!currentRoomId) { 
        await showCustomAlert("Select an active chat room first!"); 
        return; 
    } 
    
    promptFriendEmail.placeholder = "Enter friend's Email";
    promptRoomName.style.display = "none";
    
    const promptData = await showCustomPrompt("Add Member to Current Chat"); 
    
    let currentRoomDoc = await db.collection("rooms").doc(currentRoomId).get();
    let currentRoomData = currentRoomDoc.data();
    
    promptRoomName.style.display = "block";
    promptFriendEmail.placeholder = "Friend's Email";
    
    if (!promptData || !promptData.email) return; 
    
    try { 
        const userSnapshot = await db.collection("users").where("email", "==", promptData.email.toLowerCase()).get(); 
        if (userSnapshot.empty) { 
            await showCustomAlert("User with this Email not found!"); 
            return; 
        } 
        const friendId = userSnapshot.docs[0].id; 
        const friendData = userSnapshot.docs[0].data(); 
        
        if (!currentRoomDoc.exists) return; 
        
        let currentMembers = currentRoomData.members || []; 
        
        if (currentMembers.includes(friendId)) { 
            await showCustomAlert(`${friendData.username} is already a member of this chat!`); 
            return; 
        } 
        
        currentMembers.push(friendId); 
        await db.collection("rooms").doc(currentRoomId).update({ members: currentMembers }); 
        
        await db.collection("rooms").doc(currentRoomId).collection("messages").add({ 
            text: `${friendData.username} has joined the chat!`, 
            userId: "system", 
            username: "System", 
            createdAt: firebase.firestore.FieldValue.serverTimestamp() 
        }); 
        await showCustomAlert(`${friendData.username} successfully added to the chat!`); 
        toggleSidebar(false); 
    } catch (e) { 
        console.error("Error adding member:", e); 
        await showCustomAlert("Failed to add member."); 
    } 
} 

roomSelect.addEventListener('change', (e) => { 
    currentUserId = firebase.auth().currentUser.uid;
    currentRoomId = e.target.value; 
    const selectedOption = roomSelect.options[roomSelect.selectedIndex];
    currentRoomTitle.textContent = selectedOption ? selectedOption.textContent : "# Chat";
    loadMessages(currentRoomId); 
    toggleSidebar(false); 
}); 

document.getElementById('add-room-btn').addEventListener('click', actionCreateRoom); 
addMemberBtn.addEventListener('click', actionAddMemberToChat); 

openManagerBtn.addEventListener('click', () => { 
    toggleSidebar(false); 
    chatsManagerModal.style.display = 'flex'; 
    renderManagerList(); 
}); 

closeManagerBtn.addEventListener('click', () => { 
    chatsManagerModal.style.display = 'none'; 
}); 

function renderManagerList() { 
    managerRoomsList.innerHTML = ''; 
    if (globalRoomsCache.length === 0) { 
        managerRoomsList.innerHTML = '<p style="opacity:0.5; font-size:14px;">No rooms to manage.</p>'; 
        return; 
    } 
    globalRoomsCache.forEach(room => { 
        const item = document.createElement('div'); 
        item.classList.add('manager-item'); 
        const nameSpan = document.createElement('span'); 
        nameSpan.classList.add('manager-room-name'); 
        nameSpan.textContent = `${room.name}`; 
        const actionsDiv = document.createElement('div'); 
        actionsDiv.classList.add('manager-actions'); 
        const clearBtn = document.createElement('button'); 
        clearBtn.classList.add('action-icon-btn', 'clear'); 
        clearBtn.innerHTML = "Clear Chat"; 
        clearBtn.title = "Clear all messages in this chat"; 
        clearBtn.addEventListener('click', () => actionClearRoomMessages(room.id, room.name)); 
        const deleteBtn = document.createElement('button'); 
        deleteBtn.classList.add('action-icon-btn', 'delete'); 
        deleteBtn.innerHTML = "Delete"; 
        deleteBtn.title = "Delete chat entirely"; 
        deleteBtn.addEventListener('click', () => actionDeleteRoomEntirely(room.id, room.name)); 
        actionsDiv.appendChild(clearBtn); 
        actionsDiv.appendChild(deleteBtn); 
        item.appendChild(nameSpan); 
        item.appendChild(actionsDiv); 
        managerRoomsList.appendChild(item); 
    }); 
} 

async function actionClearRoomMessages(roomId, roomName) { 
    const confirmed = await showCustomConfirm(`Clear all messages in "${roomName}"?`); 
    if (confirmed) { 
        try { 
            const snapshot = await db.collection("rooms").doc(roomId).collection("messages").get(); 
            const promises = snapshot.docs.map(doc => doc.ref.delete()); 
            await Promise.all(promises); 
            await showCustomAlert("History successfully cleared!"); 
        } catch (e) { 
            console.error(e); 
            await showCustomAlert("Error clearing history."); 
        } 
    } 
} 

async function actionDeleteRoomEntirely(roomId, roomName) { 
    const confirmed = await showCustomConfirm(`Delete "${roomName}" and all its contents?`); 
    if (confirmed) { 
        try { 
            const messagesSnapshot = await db.collection("rooms").doc(roomId).collection("messages").get(); 
            const deleteMessagesPromises = messagesSnapshot.docs.map(doc => doc.ref.delete()); 
            await Promise.all(deleteMessagesPromises); 
            await db.collection("rooms").doc(roomId).delete(); 
            await showCustomAlert("Room deleted!"); 
            if (currentRoomId === roomId) currentRoomId = null; 
        } catch (e) { 
            console.error(e); 
            await showCustomAlert("Error deleting room."); 
        } 
    } 
} 

function formatTime(timestamp) { 
    if (!timestamp) return "..."; 
    const date = timestamp.toDate(); 
    let hours = date.getHours(); 
    let minutes = date.getMinutes(); 
    if (hours < 10) hours = "0" + hours; 
    if (minutes < 10) minutes = "0" + minutes; 
    return `${hours}:${minutes}`; 
} 

function showCustomConfirm(message) { 
    return new Promise((resolve) => { 
        confirmMessage.textContent = message; 
        customConfirm.style.display = 'flex'; 
        confirmYes.onclick = () => { customConfirm.style.display = 'none'; resolve(true); }; 
        confirmNo.onclick = () => { customConfirm.style.display = 'none'; resolve(false); }; 
    }); 
} 

function showCustomAlert(message) { 
    return new Promise((resolve) => { 
        alertMessage.textContent = message; 
        customAlert.style.display = 'flex'; 
        alertOk.onclick = () => { customAlert.style.display = 'none'; resolve(); }; 
    }); 
} 

function showCustomPrompt(title) { 
    return new Promise((resolve) => { 
        promptMessage.textContent = title; 
        promptFriendEmail.value = ""; 
        promptRoomName.value = ""; 
        customPrompt.style.display = 'flex'; 
        promptFriendEmail.focus(); 
        
        promptSave.onclick = () => { 
            customPrompt.style.display = 'none'; 
            resolve({
                email: promptFriendEmail.value.trim(),
                roomNameInput: promptRoomName.value.trim()
            }); 
        }; 
        promptCancel.onclick = () => { 
            customPrompt.style.display = 'none'; 
            resolve(null); 
        }; 
    }); 
}
