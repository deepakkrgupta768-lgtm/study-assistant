const state = {
    chats: JSON.parse(localStorage.getItem("chats") || "[]"),
    currentChatId: localStorage.getItem("currentChatId") || null,
    sending: false,
    theme: localStorage.getItem("theme") || "light",
};

const els = {
    sidebar: document.getElementById("sidebar"),
    sidebarOverlay: document.getElementById("sidebar-overlay"),
    sidebarToggle: document.getElementById("sidebar-toggle"),
    chatList: document.getElementById("chat-list"),
    newChatBtn: document.getElementById("new-chat-btn"),
    newChatSidebar: document.getElementById("new-chat-sidebar"),
    welcome: document.getElementById("welcome-screen"),
    chatContainer: document.getElementById("chat-container"),
    messages: document.getElementById("messages"),
    messageForm: document.getElementById("message-form"),
    messageInput: document.getElementById("message-input"),
    sendBtn: document.getElementById("send-btn"),
    typingIndicator: document.getElementById("typing-indicator"),
    themeToggle: document.getElementById("theme-toggle"),
    apiStatus: document.getElementById("api-status"),
};

function init() {
    applyTheme();
    loadChatList();
    if (state.currentChatId) {
        const chat = getChat(state.currentChatId);
        if (chat) switchToChat(state.currentChatId);
    }
    checkHealth();
    setInterval(checkHealth, 30000);
    bindEvents();
}

function bindEvents() {
    els.messageForm.addEventListener("submit", handleSend);
    els.messageInput.addEventListener("input", () => {
        els.sendBtn.disabled = !els.messageInput.value.trim() || state.sending;
    });
    els.messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) els.messageForm.dispatchEvent(new Event("submit"));
    });

    els.sidebarToggle.addEventListener("click", toggleSidebar);
    els.sidebarOverlay.addEventListener("click", closeSidebar);
    els.newChatBtn.addEventListener("click", newChat);
    els.newChatSidebar.addEventListener("click", newChat);
    els.themeToggle.addEventListener("click", toggleTheme);

    document.querySelectorAll(".suggestion-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
            els.messageInput.value = chip.dataset.q;
            els.sendBtn.disabled = false;
            els.messageForm.dispatchEvent(new Event("submit"));
        });
    });
}

function getChat(id) {
    return state.chats.find((c) => c.id === id);
}

function saveChats() {
    localStorage.setItem("chats", JSON.stringify(state.chats));
    localStorage.setItem("currentChatId", state.currentChatId || "");
}

function loadChatList() {
    els.chatList.innerHTML = "";
    if (state.chats.length === 0) {
        els.chatList.innerHTML = '<div style="padding:16px;color:var(--text-secondary);font-size:13px;text-align:center;">No chats yet. Start a new conversation!</div>';
        return;
    }
    state.chats.forEach((chat) => {
        const item = document.createElement("div");
        item.className = `chat-item${chat.id === state.currentChatId ? " active" : ""}`;
        const firstMsg = chat.messages.length > 0 ? chat.messages[0].content.substring(0, 40) : "New chat";
        item.textContent = firstMsg + (firstMsg.length >= 40 ? "..." : "");
        item.title = firstMsg;
        item.addEventListener("click", () => switchToChat(chat.id));
        els.chatList.appendChild(item);
    });
}

function newChat() {
    const chat = { id: Date.now().toString(), messages: [], createdAt: new Date().toISOString() };
    state.chats.unshift(chat);
    saveChats();
    switchToChat(chat.id);
    closeSidebar();
}

function switchToChat(chatId) {
    state.currentChatId = chatId;
    saveChats();
    loadChatList();
    const chat = getChat(chatId);
    els.messages.innerHTML = "";
    els.welcome.classList.add("hidden");
    els.chatContainer.classList.remove("hidden");
    if (chat && chat.messages.length > 0) {
        chat.messages.forEach((m) => appendMessage(m.role, m.content));
    }
    scrollToBottom();
}

function appendMessage(role, content, isError = false) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${isError ? "error" : role}`;
    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = role === "user" ? "🧑‍🎓" : "🤖";
    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";
    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.innerHTML = role === "assistant" && !isError ? renderMarkdown(content) : escapeHtml(content);
    contentDiv.appendChild(bubble);
    msgDiv.appendChild(avatar);
    msgDiv.appendChild(contentDiv);
    els.messages.appendChild(msgDiv);
    scrollToBottom();
}

function renderMarkdown(text) {
    let html = escapeHtml(text);
    html = html.replace(/### (.+)/g, "<h3>$1</h3>");
    html = html.replace(/## (.+)/g, "<h2>$1</h2>");
    html = html.replace(/# (.+)/g, "<h1>$1</h1>");
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
    html = html.replace(/^- (.+)/gm, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");
    html = html.replace(/\d+\. (.+)/g, "<li>$1</li>");
    html = html.replace(/(?:^|\n)(?!<[uo]l>|<li>|<h\d>|<pre>|<p>)([^<\n].*)/gm, (m) => m.trim() ? `<p>${m.trim()}</p>` : "");
    html = html.replace(/\n\n/g, "</p><p>");
    html = html.replace(/<p><\/p>/g, "");
    return html;
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

async function handleSend(e) {
    e.preventDefault();
    const text = els.messageInput.value.trim();
    if (!text || state.sending) return;

    let chat = getChat(state.currentChatId);
    if (!chat) {
        newChat();
        chat = getChat(state.currentChatId);
    }

    chat.messages.push({ role: "user", content: text });
    saveChats();
    loadChatList();
    appendMessage("user", text);
    els.messageInput.value = "";
    els.sendBtn.disabled = true;
    els.welcome.classList.add("hidden");
    els.chatContainer.classList.remove("hidden");

    state.sending = true;
    els.typingIndicator.classList.remove("hidden");
    scrollToBottom();

    const history = chat.messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));

    try {
        const resp = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text, history: history }),
        });

        const data = await resp.json();
        els.typingIndicator.classList.add("hidden");

        if (resp.ok) {
            chat.messages.push({ role: "assistant", content: data.reply });
            saveChats();
            appendMessage("assistant", data.reply);
        } else {
            appendMessage("assistant", data.error || "An error occurred", true);
        }
    } catch (err) {
        els.typingIndicator.classList.add("hidden");
        appendMessage("assistant", "Network error. Check your connection.", true);
    }

    state.sending = false;
    els.sendBtn.disabled = !els.messageInput.value.trim();
    scrollToBottom();
}

function scrollToBottom() {
    setTimeout(() => {
        if (els.chatContainer) els.chatContainer.scrollTop = els.chatContainer.scrollHeight;
    }, 50);
}

function toggleSidebar() {
    els.sidebar.classList.toggle("open");
    els.sidebarOverlay.classList.toggle("visible");
}

function closeSidebar() {
    els.sidebar.classList.remove("open");
    els.sidebarOverlay.classList.remove("visible");
}

function toggleTheme() {
    state.theme = state.theme === "light" ? "dark" : "light";
    localStorage.setItem("theme", state.theme);
    applyTheme();
}

function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.theme);
    els.themeToggle.textContent = state.theme === "dark" ? "☀️" : "🌙";
}

async function checkHealth() {
    try {
        const resp = await fetch("/api/health");
        const data = await resp.json();
        const dot = els.apiStatus.querySelector(".status-dot");
        if (resp.ok) {
            dot.className = "status-dot connected";
        } else {
            dot.className = "status-dot disconnected";
        }
    } catch {
        const dot = els.apiStatus.querySelector(".status-dot");
        dot.className = "status-dot disconnected";
    }
}

document.addEventListener("DOMContentLoaded", init);
