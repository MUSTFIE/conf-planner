// 引入 Firebase SDK (使用 CDN 模組化版本)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// TODO: 換成你自己的 Firebase 設定
const firebaseConfig = {
    apiKey: "AIzaSyBnwMcgxCxqyQi4n7dc4-ZRZGiFT0dVUFg",
    authDomain: "conference-c7eee.firebaseapp.com",
    databaseURL: "https://conference-c7eee-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "conference-c7eee",
    storageBucket: "conference-c7eee.firebasestorage.app",
    messagingSenderId: "603047083531",
    appId: "1:603047083531:web:909351d3140b2b040f110e"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 判斷目前在哪一個頁面
const path = window.location.pathname;

if (path.includes("detail.html")) {
    initDetailPage();
} else {
    initIndexPage();
}

// --- 首頁邏輯 (index.html) ---
function initIndexPage() {
    const form = document.getElementById("add-event-form");
    const eventListEl = document.getElementById("event-list");
    const syncStatus = document.getElementById("sync-status");

    syncStatus.textContent = "已連線同步";
    syncStatus.className = "text-sm text-green-600 font-medium";

    // 提交新增活動
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = document.getElementById("event-name").value;
        const date = document.getElementById("event-date").value;

        const eventsRef = ref(db, 'events');
        push(eventsRef, {
            name: name,
            date: date
        });

        form.reset();
    });

    // 即時監聽活動列表
    const eventsRef = ref(db, 'events');
    onValue(eventsRef, (snapshot) => {
        const data = snapshot.val();
        eventListEl.innerHTML = "";

        if (!data) {
            eventListEl.innerHTML = `<p class="text-gray-500 col-span-2">目前沒有會議，請在上方新增。</p>`;
            return;
        }

        Object.keys(data).forEach((key) => {
            const event = data[key];
            const tasks = event.tasks ? Object.values(event.tasks) : [];
            const totalTasks = tasks.length;
            const completedTasks = tasks.filter(t => t.completed).length;
            const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            const card = document.createElement("div");
            card.className = "bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition cursor-pointer flex flex-col justify-between";
            card.innerHTML = `
                <div>
                    <h3 class="text-xl font-bold text-gray-800 mb-2">${escapeHtml(event.name)}</h3>
                    <p class="text-gray-500 text-sm mb-4">日期：${event.date}</p>
                </div>
                <div>
                    <div class="flex justify-between text-sm font-medium text-gray-700 mb-1">
                        <span>進度</span>
                        <span>${progress}%</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2.5">
                        <div class="bg-blue-600 h-2.5 rounded-full" style="width: ${progress}%"></div>
                    </div>
                </div>
            `;
            // 點擊卡片跳轉到詳細頁面，帶入 event id
            card.addEventListener("click", () => {
                window.location.href = `detail.html?id=${key}`;
            });

            eventListEl.appendChild(card);
        });
    });
}

// --- 詳細頁邏輯 (detail.html) ---
function initDetailPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get("id");

    if (!eventId) {
        alert("找不到活動資訊！");
        window.location.href = "index.html";
        return;
    }

    const eventRef = ref(db, `events/${eventId}`);
    const tasksRef = ref(db, `events/${eventId}/tasks`);

    const titleEl = document.getElementById("detail-title");
    const dateEl = document.getElementById("detail-date");
    const progressBar = document.getElementById("detail-progress-bar");
    const progressText = document.getElementById("detail-progress-text");
    const taskForm = document.getElementById("add-task-form");
    const taskListEl = document.getElementById("task-list");

    // 即時監聽該活動資料與任務
    onValue(eventRef, (snapshot) => {
        const event = snapshot.val();
        if (!event) {
            titleEl.textContent = "活動不存在或已被刪除";
            return;
        }

        titleEl.textContent = event.name;
        dateEl.textContent = `會議日期：${event.date}`;

        const tasks = event.tasks ? event.tasks : {};
        const taskKeys = Object.keys(tasks);
        const totalTasks = taskKeys.length;
        const completedTasks = taskKeys.filter(k => tasks[k].completed).length;
        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${progress}%`;

        taskListEl.innerHTML = "";
        if (totalTasks === 0) {
            taskListEl.innerHTML = `<p class="text-gray-500 py-4 text-center">目前尚無籌備工作項目。</p>`;
            return;
        }

        taskKeys.forEach((taskKey) => {
            const task = tasks[taskKey];
            const li = document.createElement("li");
            li.className = "py-3 flex items-center justify-between";
            li.innerHTML = `
                <label class="flex items-center gap-3 cursor-pointer flex-1">
                    <input type="checkbox" data-id="${taskKey}" ${task.completed ? "checked" : ""} class="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500">
                    <span class="${task.completed ? "line-through text-gray-400" : "text-gray-800"}">${escapeHtml(task.name)}</span>
                </label>
                <button data-id="${taskKey}" class="delete-task text-red-500 hover:text-red-700 text-sm px-2 py-1">刪除</button>
            `;
            taskListEl.appendChild(li);
        });

        // 綁定勾選狀態改變事件
        taskListEl.querySelectorAll("input[type='checkbox']").forEach(checkbox => {
            checkbox.addEventListener("change", (e) => {
                const tKey = e.target.getAttribute("data-id");
                const isChecked = e.target.checked;
                update(ref(db, `events/${eventId}/tasks/${tKey}`), {
                    completed: isChecked
                });
            });
        });

        // 綁定刪除工作事件
        taskListEl.querySelectorAll(".delete-task").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const tKey = e.target.getAttribute("data-id");
                remove(ref(db, `events/${eventId}/tasks/${tKey}`));
            });
        });
    });

    // 新增任務
    taskForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const taskNameInput = document.getElementById("task-name");
        push(tasksRef, {
            name: taskNameInput.value,
            completed: false
        });
        taskNameInput.value = "";
    });
}

// 防止 XSS 攻擊的小工具
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}
