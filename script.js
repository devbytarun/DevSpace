const STORAGE_KEYS = {
  name: "db_name",
  github: "db_github",
  role: "db_role",
  tasks: "db_tasks",
  snippets: "db_snippets",
  chat: "db_chat_history"
};

const GH_CACHE_TTL_MS = 30 * 60 * 1000;
const CHAT_LIMIT = 80;

let selectedRole = "";
let activeGithub = "";
let settingsInlineMessageTimer = null;
let chatUserName = (localStorage.getItem(STORAGE_KEYS.name) || "You").trim() || "You";
let chatUserAvatar = "";

let taskItems = safeParse(localStorage.getItem(STORAGE_KEYS.tasks), []);
let snippetItems = safeParse(localStorage.getItem(STORAGE_KEYS.snippets), []);
let chatHistory = safeParse(localStorage.getItem(STORAGE_KEYS.chat), []);

if (!Array.isArray(taskItems)) taskItems = [];
if (!Array.isArray(snippetItems)) snippetItems = [];
if (!Array.isArray(chatHistory)) chatHistory = [];

let chatPending = false;
let chatDraft = "";
let pomodoroTimer = null;
let pomodoroLeft = 25 * 60;
let pomodoroRunning = false;

const obNameInput = byId("ob-name");
const obGithubInput = byId("ob-github");
const obError = byId("obError");
const onboardingEl = byId("onboarding");
const dashboardEl = byId("dashboard");
const sidebarEl = document.querySelector(".sidebar");
const sidebarNavEl = byId("sidebarNav");
const mobileMenuToggleEl = byId("mobileMenuToggle");
const mobileNavMedia = window.matchMedia("(max-width: 920px)");

const chatViews = [
  {
    messages: byId("chatMessages"),
    input: byId("chatInput"),
    send: byId("chatSend")
  },
  {
    messages: byId("chatMessages-full"),
    input: byId("chatInput-full"),
    send: byId("chatSend-full")
  }
].filter((v) => v.messages && v.input && v.send);

const taskViews = [
  {
    list: byId("taskList"),
    input: byId("taskInput"),
    add: byId("taskAdd")
  },
  {
    list: byId("taskList-full"),
    input: byId("taskInput-full"),
    add: byId("taskAdd-full")
  }
].filter((v) => v.list && v.input && v.add);

const snippetViews = [
  {
    list: byId("snipList"),
    nameInput: byId("snipName"),
    codeInput: byId("snipCode"),
    save: byId("snipSave")
  },
  {
    list: byId("snipList-full"),
    nameInput: byId("snipName-full"),
    codeInput: byId("snipCode-full"),
    save: byId("snipSave-full")
  }
].filter((v) => v.list && v.nameInput && v.codeInput && v.save);

const settingsInlineMessageEl = byId("settings-inline-message");

initRolePicker();
initOnboarding();
initNavigation();
initSettings();
initTasks();
initSnippets();
initPomodoro();
initChat();
restoreSession();

function byId(id) {
  return document.getElementById(id);
}

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function showObError(message) {
  if (!obError) return;
  obError.textContent = message;
  obError.classList.remove("hidden");
}

function hideObError() {
  if (!obError) return;
  obError.classList.add("hidden");
}

function firstChar(value) {
  const clean = (value || "").trim();
  return clean ? clean[0].toUpperCase() : "T";
}

function setText(id, value) {
  const el = byId(id);
  if (el) el.textContent = value;
}

function setAvatar(id, imageUrl, fallbackLabel) {
  const el = byId(id);
  if (!el) return;
  if (imageUrl) {
    el.innerHTML = `<img src="${imageUrl}" alt="avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />`;
  } else {
    el.textContent = firstChar(fallbackLabel);
  }
}

function clearAvatar(id, fallbackLabel) {
  const el = byId(id);
  if (!el) return;
  el.innerHTML = "";
  el.textContent = firstChar(fallbackLabel);
}

function initRolePicker() {
  document.querySelectorAll(".role-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const wasActive = btn.classList.contains("active");
      document.querySelectorAll(".role-btn").forEach((b) => b.classList.remove("active"));
      selectedRole = "";
      if (!wasActive) {
        btn.classList.add("active");
        selectedRole = btn.textContent.trim();
      }
      hideObError();
    });
  });
}

function initOnboarding() {
  const enterBtn = byId("enterBtn");
  if (!enterBtn) return;

  enterBtn.addEventListener("click", () => {
    const name = (obNameInput?.value || "").trim();
    const github = (obGithubInput?.value || "").trim().replace(/^@/, "");

    if (!name) {
      showObError("Please enter your Name!");
      return;
    }
    if (!github) {
      showObError("Please enter your GitHub username!");
      return;
    }
    if (!selectedRole) {
      showObError("Please select a role!");
      return;
    }

    localStorage.setItem(STORAGE_KEYS.name, name);
    localStorage.setItem(STORAGE_KEYS.github, github);
    localStorage.setItem(STORAGE_KEYS.role, selectedRole);
    loadDashboard(name, github, selectedRole);
  });
}

function restoreSession() {
  const name = localStorage.getItem(STORAGE_KEYS.name);
  const github = localStorage.getItem(STORAGE_KEYS.github);
  const role = localStorage.getItem(STORAGE_KEYS.role);
  if (name && github && role) {
    loadDashboard(name, github, role);
  }
}

function hasActiveSession() {
  return Boolean(
    localStorage.getItem(STORAGE_KEYS.name) &&
    localStorage.getItem(STORAGE_KEYS.github) &&
    localStorage.getItem(STORAGE_KEYS.role)
  );
}

function loadDashboard(name, github, role) {
  if (onboardingEl) onboardingEl.classList.add("hidden");
  if (dashboardEl) dashboardEl.classList.remove("hidden");

  setText("sideName", name || "Name");
  setText("sideRole", role || "Role");
  chatUserName = (name || "You").trim() || "You";

  selectedRole = role || "";
  seedWelcomeMessage();
  fetchGitHub(github);
  loadSettings();
  setActiveSection("dashboard");
  renderChat();
}

function logoutDashboard() {
  localStorage.removeItem(STORAGE_KEYS.name);
  localStorage.removeItem(STORAGE_KEYS.github);
  localStorage.removeItem(STORAGE_KEYS.role);
  localStorage.removeItem(STORAGE_KEYS.chat);
  localStorage.removeItem(STORAGE_KEYS.tasks);

  selectedRole = "";
  activeGithub = "";
  chatUserName = "You";
  chatUserAvatar = "";
  chatHistory = [];
  chatDraft = "";
  chatPending = false;
  chatViews.forEach((view) => {
    view.input.value = "";
  });
  taskItems = [];
  taskViews.forEach((view) => {
    view.input.value = "";
  });
  renderTasks();

  if (obNameInput) obNameInput.value = "";
  if (obGithubInput) obGithubInput.value = "";
  hideObError();

  document.querySelectorAll(".role-btn").forEach((b) => b.classList.remove("active"));

  setText("sideName", "Name");
  setText("sideRole", "Role");
  setText("ghName", "Name");
  setText("ghHandle", "@username");
  setText("ghRepos", "-");
  setText("ghFollowers", "-");
  setText("ghFollowing", "-");
  setText("ghStars", "-");

  const followBtn = byId("followBtn");
  if (followBtn) followBtn.href = "";

  const shareBtn = byId("shareBtn");
  if (shareBtn) shareBtn.textContent = "Share Profile";

  const streakImg = byId("streakImg");
  if (streakImg) streakImg.removeAttribute("src");

  clearAvatar("ghAvatar", "T");
  clearAvatar("sideAvatar", "T");

  if (dashboardEl) dashboardEl.classList.add("hidden");
  if (onboardingEl) onboardingEl.classList.remove("hidden");
  renderChat();
}

function initNavigation() {
  document.querySelectorAll(".s-item").forEach((item) => {
    item.addEventListener("click", () => {
      setActiveSection(item.dataset.section);
      if (mobileNavMedia.matches) setMobileMenuOpen(false);
    });
  });

  if (mobileMenuToggleEl) {
    mobileMenuToggleEl.addEventListener("click", () => {
      if (!mobileNavMedia.matches) return;
      const shouldOpen = !sidebarEl?.classList.contains("menu-open");
      setMobileMenuOpen(shouldOpen);
    });
  }

  document.addEventListener("click", (event) => {
    if (!mobileNavMedia.matches) return;
    if (!sidebarEl?.classList.contains("menu-open")) return;
    if (!(event.target instanceof Element)) return;
    if (sidebarEl.contains(event.target)) return;
    setMobileMenuOpen(false);
  });

  window.addEventListener("resize", syncMobileMenuState);
  syncMobileMenuState();
}

function setActiveSection(sectionName) {
  if (!sectionName) return;

  document.querySelectorAll(".s-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.section === sectionName);
  });

  document.querySelectorAll('[id^="section-"]').forEach((section) => {
    section.classList.add("hidden");
  });

  const active = byId(`section-${sectionName}`);
  if (active) active.classList.remove("hidden");

  if (sectionName === "chatbot") renderChat();
  if (sectionName === "tasks") renderTasks();
  if (sectionName === "snippets") renderSnippets();
}

function setMobileMenuOpen(shouldOpen) {
  if (!sidebarEl || !sidebarNavEl || !mobileMenuToggleEl) return;
  sidebarEl.classList.toggle("menu-open", shouldOpen);
  mobileMenuToggleEl.setAttribute("aria-expanded", String(shouldOpen));
  sidebarNavEl.setAttribute("aria-hidden", String(!shouldOpen));
}

function syncMobileMenuState() {
  if (!sidebarNavEl || !mobileMenuToggleEl) return;

  if (!mobileNavMedia.matches) {
    sidebarEl?.classList.remove("menu-open");
    mobileMenuToggleEl.setAttribute("aria-expanded", "false");
    sidebarNavEl.setAttribute("aria-hidden", "false");
    return;
  }

  const isOpen = sidebarEl?.classList.contains("menu-open") || false;
  mobileMenuToggleEl.setAttribute("aria-expanded", String(isOpen));
  sidebarNavEl.setAttribute("aria-hidden", String(!isOpen));
}

function loadSettings() {
  const name = localStorage.getItem(STORAGE_KEYS.name) || "";
  const github = localStorage.getItem(STORAGE_KEYS.github) || "";
  const role = localStorage.getItem(STORAGE_KEYS.role) || "";

  setText("settings-name-display", name || "Name");
  setText("settings-role-display", role || "Role");

  const ghInput = byId("settings-github");
  const nameInput = byId("settings-name-input");
  const roleInput = byId("settings-role-input");

  if (ghInput) ghInput.value = github;
  if (nameInput) nameInput.value = name;
  if (roleInput) roleInput.value = role;
}

function showSettingsInlineMessage(message, type) {
  if (!settingsInlineMessageEl) return;
  settingsInlineMessageEl.textContent = message;
  settingsInlineMessageEl.classList.remove("hidden");
  settingsInlineMessageEl.classList.toggle("error", type === "error");

  if (settingsInlineMessageTimer) clearTimeout(settingsInlineMessageTimer);
  settingsInlineMessageTimer = setTimeout(() => {
    settingsInlineMessageEl.classList.add("hidden");
    settingsInlineMessageEl.classList.remove("error");
  }, 2200);
}

function initSettings() {
  const settingsLogout = byId("settings-logout-btn");
  if (settingsLogout) settingsLogout.addEventListener("click", logoutDashboard);

  const saveGithub = byId("settings-github-save");
  if (saveGithub) {
    saveGithub.addEventListener("click", () => {
      const raw = byId("settings-github")?.value || "";
      const github = raw.trim().replace(/^@/, "");
      if (!github) {
        showSettingsInlineMessage("GitHub username cannot be empty.", "error");
        return;
      }
      localStorage.setItem(STORAGE_KEYS.github, github);
      fetchGitHub(github);
      showSettingsInlineMessage("GitHub updated.", "success");
    });
  }

  const saveName = byId("settings-name-save");
  if (saveName) {
    saveName.addEventListener("click", () => {
      const name = (byId("settings-name-input")?.value || "").trim();
      if (!name) {
        showSettingsInlineMessage("Name cannot be empty.", "error");
        return;
      }
      localStorage.setItem(STORAGE_KEYS.name, name);
      chatUserName = name;
      setText("sideName", name);
      setText("settings-name-display", name);
      showSettingsInlineMessage("Name updated.", "success");
      renderChat();
    });
  }

  const saveRole = byId("settings-role-save");
  if (saveRole) {
    saveRole.addEventListener("click", () => {
      const role = (byId("settings-role-input")?.value || "").trim();
      if (!role) {
        showSettingsInlineMessage("Role cannot be empty.", "error");
        return;
      }
      localStorage.setItem(STORAGE_KEYS.role, role);
      selectedRole = role;
      setText("sideRole", role);
      setText("settings-role-display", role);
      showSettingsInlineMessage("Role updated.", "success");
    });
  }

  const shareBtn = byId("shareBtn");
  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      if (!activeGithub) return;
      const profileUrl = `https://github.com/${activeGithub}`;
      try {
        await navigator.clipboard.writeText(profileUrl);
        shareBtn.textContent = "Copied!";
        setTimeout(() => {
          shareBtn.textContent = "Share Profile";
        }, 1500);
      } catch {
        showSettingsInlineMessage("Could not copy link.", "error");
      }
    });
  }
}

function getGithubCache(github) {
  try {
    const raw = localStorage.getItem(`gh_cache_${github.toLowerCase()}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setGithubCache(github, data) {
  try {
    localStorage.setItem(
      `gh_cache_${github.toLowerCase()}`,
      JSON.stringify({ timestamp: Date.now(), data })
    );
  } catch {
  }
}

function renderGithubData(data, github) {
  setText("ghName", data.name || data.login || "Name");
  setText("ghHandle", "@" + (data.login || github));
  setText("ghRepos", String(data.public_repos ?? "-"));
  setText("ghFollowers", String(data.followers ?? "-"));
  setText("ghFollowing", String(data.following ?? "-"));
  setText("ghStars", String(data.public_gists ?? "-"));

  const label = data.name || data.login || "T";
  setAvatar("ghAvatar", data.avatar_url, label);
  setAvatar("sideAvatar", data.avatar_url, label);
  chatUserAvatar = data.avatar_url || "";

  const followBtn = byId("followBtn");
  if (followBtn) followBtn.href = `https://github.com/${github}`;

  const streakImg = byId("streakImg");
  if (streakImg) {
    streakImg.src = `https://github-readme-activity-graph.vercel.app/graph?username=${encodeURIComponent(github)}&theme=github-compact&hide_border=true`;
  }

  renderChat();
}

function fetchGitHub(githubRaw) {
  const github = (githubRaw || "").trim().replace(/^@/, "");
  if (!github) return;

  activeGithub = github;

  setText("ghName", "Loading...");
  setText("ghHandle", "@" + github);
  setText("ghRepos", "-");
  setText("ghFollowers", "-");
  setText("ghFollowing", "-");
  setText("ghStars", "-");

  const followBtn = byId("followBtn");
  if (followBtn) followBtn.href = `https://github.com/${github}`;

  const cached = getGithubCache(github);
  if (cached && cached.data && Date.now() - cached.timestamp < GH_CACHE_TTL_MS) {
    renderGithubData(cached.data, github);
    return;
  }

  fetch(`https://api.github.com/users/${encodeURIComponent(github)}`)
    .then((res) => {
      if (!res.ok) {
        return res.json().then((err) => {
          throw new Error(err.message || "GitHub API error");
        });
      }
      return res.json();
    })
    .then((data) => {
      if (data.message === "Not Found") {
        setText("ghName", "User not found!");
        clearAvatar("ghAvatar", "T");
        clearAvatar("sideAvatar", "T");
        chatUserAvatar = "";
        renderChat();
        return;
      }
      renderGithubData(data, github);
      setGithubCache(github, data);
    })
    .catch((err) => {
      const message = (err.message || "").toLowerCase();
      if (message.includes("rate limit") && cached?.data) {
        renderGithubData(cached.data, github);
        setText("ghName", `${cached.data.name || cached.data.login || github} (cached)`);
      } else if (message.includes("rate limit")) {
        setText("ghName", "GitHub rate limit hit");
      } else {
        setText("ghName", "Error loading data!");
        chatUserAvatar = "";
        renderChat();
      }
    });
}

function initTasks() {
  taskViews.forEach((view) => {
    view.add.addEventListener("click", () => {
      addTask(view.input.value);
      view.input.value = "";
    });

    view.input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      addTask(view.input.value);
      view.input.value = "";
    });

    view.list.addEventListener("click", (e) => {
      const removeBtn = e.target.closest("[data-remove-task]");
      if (!removeBtn) return;
      removeTask(removeBtn.dataset.removeTask);
    });

    view.list.addEventListener("change", (e) => {
      const checkbox = e.target.closest("[data-task-check]");
      if (!checkbox) return;
      toggleTask(checkbox.dataset.taskCheck, checkbox.checked);
    });
  });

  renderTasks();
}

function addTask(rawText) {
  const text = (rawText || "").trim();
  if (!text) return;

  taskItems.unshift({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text,
    done: false
  });

  taskItems = taskItems.slice(0, 60);
  saveJson(STORAGE_KEYS.tasks, taskItems);
  renderTasks();
}

function removeTask(id) {
  taskItems = taskItems.filter((t) => t.id !== id);
  saveJson(STORAGE_KEYS.tasks, taskItems);
  renderTasks();
}

function toggleTask(id, checked) {
  taskItems = taskItems.map((t) => (t.id === id ? { ...t, done: checked } : t));
  saveJson(STORAGE_KEYS.tasks, taskItems);
  renderTasks();
}

function renderTasks() {
  taskViews.forEach((view) => {
    view.list.innerHTML = "";

    if (!taskItems.length) {
      const empty = document.createElement("div");
      empty.className = "task-empty";
      empty.style.color = "var(--muted)";
      empty.style.fontSize = "13px";
      empty.textContent = "No tasks yet. Add your first one.";
      view.list.appendChild(empty);
      return;
    }

    taskItems.forEach((task) => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "8px";
      row.style.marginBottom = "8px";

      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = !!task.done;
      check.dataset.taskCheck = task.id;
      check.style.margin = "0";
      check.style.width = "16px";
      check.style.height = "16px";

      const text = document.createElement("span");
      text.textContent = task.text;
      text.style.flex = "1";
      text.style.fontSize = "13px";
      text.style.color = task.done ? "var(--muted)" : "var(--text)";
      text.style.textDecoration = task.done ? "line-through" : "none";
      text.style.wordBreak = "break-word";

      const remove = document.createElement("button");
      remove.type = "button";
      remove.dataset.removeTask = task.id;
      remove.textContent = "x";
      remove.style.border = "1px solid var(--border)";
      remove.style.background = "transparent";
      remove.style.color = "var(--muted)";
      remove.style.borderRadius = "6px";
      remove.style.width = "24px";
      remove.style.height = "24px";
      remove.style.cursor = "pointer";

      row.appendChild(check);
      row.appendChild(text);
      row.appendChild(remove);
      view.list.appendChild(row);
    });
  });
}

function initSnippets() {
  snippetViews.forEach((view) => {
    view.save.addEventListener("click", () => {
      addSnippet(view.nameInput.value, view.codeInput.value);
      view.nameInput.value = "";
      view.codeInput.value = "";
    });

    view.codeInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      addSnippet(view.nameInput.value, view.codeInput.value);
      view.nameInput.value = "";
      view.codeInput.value = "";
    });

    view.list.addEventListener("click", async (e) => {
      const removeBtn = e.target.closest("[data-remove-snip]");
      if (removeBtn) {
        removeSnippet(removeBtn.dataset.removeSnip);
        return;
      }

      const copyBtn = e.target.closest("[data-copy-snip]");
      if (copyBtn) {
        const id = copyBtn.dataset.copySnip;
        const snip = snippetItems.find((s) => s.id === id);
        if (!snip) return;
        try {
          await navigator.clipboard.writeText(snip.code);
          copyBtn.textContent = "Copied";
          setTimeout(() => {
            copyBtn.textContent = "Copy";
          }, 1200);
        } catch {
          copyBtn.textContent = "Failed";
          setTimeout(() => {
            copyBtn.textContent = "Copy";
          }, 1200);
        }
      }
    });
  });

  renderSnippets();
}

function addSnippet(rawName, rawCode) {
  const name = (rawName || "").trim() || "Untitled";
  const code = (rawCode || "").trim();
  if (!code) return;

  snippetItems.unshift({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    code
  });

  snippetItems = snippetItems.slice(0, 60);
  saveJson(STORAGE_KEYS.snippets, snippetItems);
  renderSnippets();
}

function removeSnippet(id) {
  snippetItems = snippetItems.filter((s) => s.id !== id);
  saveJson(STORAGE_KEYS.snippets, snippetItems);
  renderSnippets();
}

function renderSnippets() {
  snippetViews.forEach((view) => {
    view.list.innerHTML = "";

    if (!snippetItems.length) {
      const empty = document.createElement("div");
      empty.style.color = "var(--muted)";
      empty.style.fontSize = "13px";
      empty.textContent = "No snippets saved yet.";
      view.list.appendChild(empty);
      return;
    }

    snippetItems.forEach((snip) => {
      const card = document.createElement("div");
      card.style.border = "1px solid var(--border)";
      card.style.borderRadius = "8px";
      card.style.padding = "8px";
      card.style.marginBottom = "8px";
      card.style.background = "#0a101a";

      const head = document.createElement("div");
      head.style.display = "flex";
      head.style.alignItems = "center";
      head.style.justifyContent = "space-between";
      head.style.gap = "8px";
      head.style.marginBottom = "6px";

      const title = document.createElement("strong");
      title.textContent = snip.name;
      title.style.fontSize = "12px";

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "6px";

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.dataset.copySnip = snip.id;
      copyBtn.textContent = "Copy";
      copyBtn.style.border = "1px solid var(--border)";
      copyBtn.style.background = "transparent";
      copyBtn.style.color = "var(--muted)";
      copyBtn.style.borderRadius = "6px";
      copyBtn.style.padding = "4px 8px";
      copyBtn.style.cursor = "pointer";
      copyBtn.style.fontSize = "11px";

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.dataset.removeSnip = snip.id;
      removeBtn.textContent = "Delete";
      removeBtn.style.border = "1px solid var(--border)";
      removeBtn.style.background = "transparent";
      removeBtn.style.color = "#ff8e8a";
      removeBtn.style.borderRadius = "6px";
      removeBtn.style.padding = "4px 8px";
      removeBtn.style.cursor = "pointer";
      removeBtn.style.fontSize = "11px";

      const pre = document.createElement("pre");
      pre.textContent = snip.code;
      pre.style.margin = "0";
      pre.style.whiteSpace = "pre-wrap";
      pre.style.wordBreak = "break-word";
      pre.style.fontSize = "12px";
      pre.style.color = "#c9d1d9";
      pre.style.fontFamily = "Consolas, monospace";

      actions.appendChild(copyBtn);
      actions.appendChild(removeBtn);
      head.appendChild(title);
      head.appendChild(actions);
      card.appendChild(head);
      card.appendChild(pre);
      view.list.appendChild(card);
    });
  });
}

function initPomodoro() {
  const startBtn = byId("pomoStart");
  const resetBtn = byId("pomoReset");
  if (!startBtn || !resetBtn) return;

  startBtn.addEventListener("click", togglePomodoro);
  resetBtn.addEventListener("click", resetPomodoro);
  updatePomodoroUi();
}

function togglePomodoro() {
  if (pomodoroRunning) {
    stopPomodoro();
    return;
  }

  pomodoroRunning = true;
  pomodoroTimer = setInterval(() => {
    pomodoroLeft -= 1;
    if (pomodoroLeft <= 0) {
      pomodoroLeft = 0;
      stopPomodoro();
      setText("pomoLabel", "Session complete. Take a short break.");
    }
    updatePomodoroUi();
  }, 1000);

  updatePomodoroUi();
}

function stopPomodoro() {
  pomodoroRunning = false;
  if (pomodoroTimer) {
    clearInterval(pomodoroTimer);
    pomodoroTimer = null;
  }
  updatePomodoroUi();
}

function resetPomodoro() {
  stopPomodoro();
  pomodoroLeft = 25 * 60;
  setText("pomoLabel", "Ready to focus?");
  updatePomodoroUi();
}

function updatePomodoroUi() {
  const minutes = String(Math.floor(pomodoroLeft / 60)).padStart(2, "0");
  const seconds = String(pomodoroLeft % 60).padStart(2, "0");
  setText("pomoTime", `${minutes}:${seconds}`);

  const startBtn = byId("pomoStart");
  if (startBtn) startBtn.textContent = pomodoroRunning ? "|| Pause" : "> Start";

  const label = byId("pomoLabel");
  if (label && pomodoroRunning && pomodoroLeft > 0) {
    label.textContent = "Focus mode is on.";
  }
}

function seedWelcomeMessage() {
  if (chatHistory.length) return;
  chatHistory.push({
    role: "assistant",
    text: `Hi ${chatUserName}! I am your DevSpace assistant. Ask me anything.`
  });
  saveJson(STORAGE_KEYS.chat, chatHistory);
}

function initChat() {
  injectChatStyles();
  if (hasActiveSession()) {
    seedWelcomeMessage();
  } else {
    chatHistory = [];
    chatDraft = "";
    chatPending = false;
  }

  chatViews.forEach((view) => {
    view.send.addEventListener("click", () => handleChatSend(view.input.value));

    view.input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.shiftKey) return;
      e.preventDefault();
      handleChatSend(view.input.value);
    });

    view.input.addEventListener("input", () => {
      chatDraft = view.input.value;
      syncChatDraft(view.input);
    });
  });

  renderChat();
}

function injectChatStyles() {
  if (byId("chatbot-ui-style")) return;

  const style = document.createElement("style");
  style.id = "chatbot-ui-style";
  style.textContent = `
    .chat-messages { display:flex; flex-direction:column; gap:12px; padding-right:4px; }
    .chat-row { display:flex; align-items:flex-end; gap:10px; }
    .chat-row.user { justify-content:flex-end; }
    .chat-content { max-width:78%; display:flex; flex-direction:column; gap:4px; }
    .chat-row.user .chat-content { align-items:flex-end; }
    .chat-row.assistant .chat-content { align-items:flex-start; }
    .chat-meta { font-size:11px; color:#6f7c8d; line-height:1; padding:0 2px; }
    .chat-avatar {
      width:28px; height:28px; border-radius:50%; flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
      font-size:10px; font-weight:700; border:1px solid #30363d; overflow:hidden;
    }
    .chat-avatar img { width:100%; height:100%; object-fit:cover; border-radius:50%; }
    .chat-row.user .chat-avatar { background:#1f6feb; color:#fff; }
    .chat-row.assistant .chat-avatar { background:#2fbf71; color:#08120d; }
    .chat-bubble {
      padding:10px 12px;
      border-radius:14px;
      font-size:13px;
      line-height:1.45;
      white-space:pre-wrap;
      word-break:break-word;
    }
    .chat-row.user .chat-bubble {
      background:#1f6feb;
      color:#fff;
      border-bottom-right-radius:6px;
    }
    .chat-row.assistant .chat-bubble {
      background:#0f1724;
      border:1px solid #30363d;
      color:#e6edf3;
      border-bottom-left-radius:6px;
    }
    .chat-row.thinking .chat-bubble { opacity:.8; }
    .typing-dots { display:inline-flex; gap:4px; align-items:center; }
    .typing-dots span {
      width:6px; height:6px; border-radius:50%; background:#9fb0c7; opacity:.5;
      animation:chat-blink 1.3s infinite;
    }
    .typing-dots span:nth-child(2) { animation-delay:.2s; }
    .typing-dots span:nth-child(3) { animation-delay:.4s; }
    @keyframes chat-blink { 0%, 80%, 100% { transform:translateY(0); opacity:.35; } 40% { transform:translateY(-2px); opacity:1; } }
    @media (max-width: 760px) {
      .chat-content { max-width: calc(100% - 46px); }
      .chat-bubble { font-size: 12px; }
    }
  `;

  document.head.appendChild(style);
}

function syncChatDraft(sourceInput) {
  chatViews.forEach((view) => {
    if (view.input !== sourceInput) view.input.value = chatDraft;
  });
}

function setChatLoadingState(loading) {
  chatViews.forEach((view) => {
    view.send.disabled = loading;
    view.send.textContent = loading ? "..." : "Send";
    view.input.disabled = loading;
  });
}

function buildMessageRow(role, text, pending) {
  const isUser = role === "user";
  const row = document.createElement("div");
  row.className = `chat-row ${role}${pending ? " thinking" : ""}`;

  const avatar = document.createElement("div");
  avatar.className = "chat-avatar";
  if (isUser && chatUserAvatar) {
    const img = document.createElement("img");
    img.src = chatUserAvatar;
    img.alt = chatUserName;
    avatar.appendChild(img);
  } else {
    avatar.textContent = isUser ? firstChar(chatUserName) : "AI";
  }
  avatar.title = isUser ? chatUserName : "DevSpace AI";

  const content = document.createElement("div");
  content.className = "chat-content";

  if (!isUser) {
    const meta = document.createElement("div");
    meta.className = "chat-meta";
    meta.textContent = "DevSpace AI";
    content.appendChild(meta);
  }

  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";

  if (pending) {
    bubble.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
  } else {
    bubble.textContent = text;
  }

  content.appendChild(bubble);

  if (!isUser) {
    row.appendChild(avatar);
    row.appendChild(content);
  } else {
    row.appendChild(content);
    row.appendChild(avatar);
  }
  return row;
}

function renderChat() {
  chatViews.forEach((view) => {
    view.messages.innerHTML = "";

    chatHistory.forEach((msg) => {
      view.messages.appendChild(buildMessageRow(msg.role, msg.text, false));
    });

    if (chatPending) {
      view.messages.appendChild(buildMessageRow("assistant", "", true));
    }

    view.messages.scrollTop = view.messages.scrollHeight;
  });

  setChatLoadingState(chatPending);
}

function getApiUrl() {
  const host = window.location.hostname;
  const isLocalHost = host === "localhost" || host === "127.0.0.1";
  if (window.location.protocol === "file:" || isLocalHost) return "http://localhost:3000/api/chat";
  return "/api/chat";
}

async function handleChatSend(rawMessage) {
  const message = (rawMessage || "").trim();
  if (!message || chatPending) return;

  chatHistory.push({ role: "user", text: message });
  chatHistory = chatHistory.slice(-CHAT_LIMIT);
  saveJson(STORAGE_KEYS.chat, chatHistory);

  chatDraft = "";
  chatViews.forEach((view) => {
    view.input.value = "";
  });

  chatPending = true;
  renderChat();

  try {
    const res = await fetch(getApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    let payload = {};
    try {
      payload = await res.json();
    } catch {
      payload = {};
    }

    if (!res.ok) {
      const reason = payload.reply || payload.error || `Request failed (${res.status})`;
      throw new Error(reason);
    }

    const reply = typeof payload.reply === "string" ? payload.reply.trim() : "";
    chatHistory.push({
      role: "assistant",
      text: reply || "I could not generate a response this time."
    });
  } catch {
    chatHistory.push({
      role: "assistant",
      text:
        "I could not reach the backend. For local use, run Express at http://localhost:3000 with GOOGLE_API_KEY in .env. For Netlify, set GOOGLE_API_KEY in site environment variables."
    });
  } finally {
    chatPending = false;
    chatHistory = chatHistory.slice(-CHAT_LIMIT);
    saveJson(STORAGE_KEYS.chat, chatHistory);
    renderChat();
  }
}
