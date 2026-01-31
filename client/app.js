// Valley Agent Web UI

class ValleyAgentUI {
  constructor() {
    this.ws = null;
    this.currentSessionId = null;
    this.sessions = new Map();
    this.isProcessing = false;
    this.currentTab = 'chat';
    this.editingSkill = null;
    this.editingScheduler = null;
    this.scheduledTasks = [];

    this.elements = {
      // Header
      headerTabs: document.querySelectorAll('.header-tab'),

      // Chat page
      chatPage: document.getElementById('chatPage'),
      statusDot: document.getElementById('statusDot'),
      statusText: document.getElementById('statusText'),
      sessionList: document.getElementById('sessionList'),
      messages: document.getElementById('messages'),
      messageInput: document.getElementById('messageInput'),
      sendBtn: document.getElementById('sendBtn'),
      stopBtn: document.getElementById('stopBtn'),
      newSessionBtn: document.getElementById('newSessionBtn'),

      // Settings page
      settingsPage: document.getElementById('settingsPage'),
      settingsNavItems: document.querySelectorAll('.settings-nav-item'),
      claudeMdSection: document.getElementById('claudeMdSection'),
      skillsSection: document.getElementById('skillsSection'),
      schedulerSection: document.getElementById('schedulerSection'),
      claudeMdEditor: document.getElementById('claudeMdEditor'),
      saveClaudeMdBtn: document.getElementById('saveClaudeMdBtn'),
      reloadClaudeMdBtn: document.getElementById('reloadClaudeMdBtn'),
      skillsList: document.getElementById('skillsList'),
      newSkillBtn: document.getElementById('newSkillBtn'),
      schedulerList: document.getElementById('schedulerList'),
      newSchedulerBtn: document.getElementById('newSchedulerBtn'),

      // Skill modal
      skillModal: document.getElementById('skillModal'),
      skillModalTitle: document.getElementById('skillModalTitle'),
      skillModalClose: document.getElementById('skillModalClose'),
      skillNameInput: document.getElementById('skillNameInput'),
      skillContentEditor: document.getElementById('skillContentEditor'),
      saveSkillBtn: document.getElementById('saveSkillBtn'),
      cancelSkillBtn: document.getElementById('cancelSkillBtn'),

      // Scheduler modal
      schedulerModal: document.getElementById('schedulerModal'),
      schedulerModalTitle: document.getElementById('schedulerModalTitle'),
      schedulerModalClose: document.getElementById('schedulerModalClose'),
      schedulerNameInput: document.getElementById('schedulerNameInput'),
      schedulerIntervalValue: document.getElementById('schedulerIntervalValue'),
      schedulerIntervalUnit: document.getElementById('schedulerIntervalUnit'),
      schedulerEnabledInput: document.getElementById('schedulerEnabledInput'),
      schedulerPromptEditor: document.getElementById('schedulerPromptEditor'),
      saveSchedulerBtn: document.getElementById('saveSchedulerBtn'),
      cancelSchedulerBtn: document.getElementById('cancelSchedulerBtn'),

      // Toast
      toast: document.getElementById('toast'),
    };

    this.init();
  }

  init() {
    this.connectWebSocket();
    this.loadSessions();
    this.bindEvents();
  }

  bindEvents() {
    // Header tab switching
    this.elements.headerTabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // Chat events
    this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
    this.elements.stopBtn.addEventListener('click', () => this.stopSession());
    this.elements.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    this.elements.newSessionBtn.addEventListener('click', () => this.startNewSession());

    // Settings navigation
    this.elements.settingsNavItems.forEach(item => {
      item.addEventListener('click', () => this.switchSettingsSection(item.dataset.section));
    });

    // CLAUDE.md events
    this.elements.saveClaudeMdBtn.addEventListener('click', () => this.saveClaudeMd());
    this.elements.reloadClaudeMdBtn.addEventListener('click', () => this.loadClaudeMd());

    // Skills events
    this.elements.newSkillBtn.addEventListener('click', () => this.openSkillModal());
    this.elements.skillModalClose.addEventListener('click', () => this.closeSkillModal());
    this.elements.cancelSkillBtn.addEventListener('click', () => this.closeSkillModal());
    this.elements.saveSkillBtn.addEventListener('click', () => this.saveSkill());

    // Close modal on backdrop click
    this.elements.skillModal.addEventListener('click', (e) => {
      if (e.target === this.elements.skillModal) {
        this.closeSkillModal();
      }
    });

    // Scheduler events
    this.elements.newSchedulerBtn.addEventListener('click', () => this.openSchedulerModal());
    this.elements.schedulerModalClose.addEventListener('click', () => this.closeSchedulerModal());
    this.elements.cancelSchedulerBtn.addEventListener('click', () => this.closeSchedulerModal());
    this.elements.saveSchedulerBtn.addEventListener('click', () => this.saveScheduler());

    // Close scheduler modal on backdrop click
    this.elements.schedulerModal.addEventListener('click', (e) => {
      if (e.target === this.elements.schedulerModal) {
        this.closeSchedulerModal();
      }
    });
  }

  // ==================== Tab Navigation ====================

  switchTab(tab) {
    this.currentTab = tab;

    // Update header tabs
    this.elements.headerTabs.forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });

    // Update pages
    this.elements.chatPage.classList.toggle('active', tab === 'chat');
    this.elements.settingsPage.classList.toggle('active', tab === 'settings');

    // Load settings data when switching to settings tab
    if (tab === 'settings') {
      this.loadClaudeMd();
      this.loadSkills();
    }
  }

  switchSettingsSection(section) {
    // Update nav items
    this.elements.settingsNavItems.forEach(item => {
      item.classList.toggle('active', item.dataset.section === section);
    });

    // Update sections
    this.elements.claudeMdSection.classList.toggle('active', section === 'claude-md');
    this.elements.skillsSection.classList.toggle('active', section === 'skills');
    this.elements.schedulerSection.classList.toggle('active', section === 'scheduler');

    // Load data for section
    if (section === 'claude-md') {
      this.loadClaudeMd();
    } else if (section === 'skills') {
      this.loadSkills();
    } else if (section === 'scheduler') {
      this.loadScheduledTasks();
    }
  }

  // ==================== WebSocket ====================

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    this.ws.onopen = () => {
      this.updateStatus('connected', 'Connected');
      this.elements.sendBtn.disabled = false;

      if (this.currentSessionId) {
        this.ws.send(JSON.stringify({
          type: 'subscribe',
          sessionId: this.currentSessionId,
        }));
      }
    };

    this.ws.onclose = () => {
      this.updateStatus('disconnected', 'Disconnected');
      this.elements.sendBtn.disabled = true;
      setTimeout(() => this.connectWebSocket(), 2000);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
  }

  // ==================== CLAUDE.md ====================

  async loadClaudeMd() {
    try {
      const response = await fetch('/api/settings/claude-md');
      const data = await response.json();
      this.elements.claudeMdEditor.value = data.content;
    } catch (error) {
      console.error('Error loading CLAUDE.md:', error);
      this.showToast('Failed to load CLAUDE.md', 'error');
    }
  }

  async saveClaudeMd() {
    try {
      const content = this.elements.claudeMdEditor.value;
      const response = await fetch('/api/settings/claude-md', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (response.ok) {
        this.showToast('CLAUDE.md saved successfully', 'success');
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Error saving CLAUDE.md:', error);
      this.showToast('Failed to save CLAUDE.md', 'error');
    }
  }

  // ==================== Skills ====================

  async loadSkills() {
    try {
      const response = await fetch('/api/settings/skills');
      const data = await response.json();
      this.renderSkillsList(data.skills);
    } catch (error) {
      console.error('Error loading skills:', error);
      this.showToast('Failed to load skills', 'error');
    }
  }

  renderSkillsList(skills) {
    if (skills.length === 0) {
      this.elements.skillsList.innerHTML = `
        <div style="color: #888; padding: 1rem; text-align: center;">
          No skills yet. Click "+ New Skill" to create one.
        </div>
      `;
      return;
    }

    this.elements.skillsList.innerHTML = skills.map(skill => `
      <div class="skill-item" data-skill="${skill.name}">
        <div>
          <div class="skill-name">${skill.name}</div>
          <div class="skill-meta">Modified: ${new Date(skill.modifiedAt).toLocaleString()}</div>
        </div>
        <div class="skill-actions">
          <button class="btn btn-secondary" onclick="app.editSkill('${skill.name}')">Edit</button>
          <button class="btn btn-danger" onclick="app.deleteSkill('${skill.name}')">Delete</button>
        </div>
      </div>
    `).join('');
  }

  openSkillModal(skill = null) {
    this.editingSkill = skill;

    if (skill) {
      this.elements.skillModalTitle.textContent = 'Edit Skill';
      this.elements.skillNameInput.value = skill.name;
      this.elements.skillNameInput.disabled = true;
      this.elements.skillContentEditor.value = skill.content;
    } else {
      this.elements.skillModalTitle.textContent = 'New Skill';
      this.elements.skillNameInput.value = '';
      this.elements.skillNameInput.disabled = false;
      this.elements.skillContentEditor.value = '';
    }

    this.elements.skillModal.classList.add('active');
  }

  closeSkillModal() {
    this.editingSkill = null;
    this.elements.skillModal.classList.remove('active');
  }

  async editSkill(name) {
    try {
      const response = await fetch(`/api/settings/skills/${encodeURIComponent(name)}`);
      const data = await response.json();
      this.openSkillModal(data.skill);
    } catch (error) {
      console.error('Error loading skill:', error);
      this.showToast('Failed to load skill', 'error');
    }
  }

  async saveSkill() {
    const name = this.elements.skillNameInput.value.trim();
    const content = this.elements.skillContentEditor.value;

    if (!name) {
      this.showToast('Please enter a skill name', 'error');
      return;
    }

    try {
      const response = await fetch(`/api/settings/skills/${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (response.ok) {
        this.showToast('Skill saved successfully', 'success');
        this.closeSkillModal();
        this.loadSkills();
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Error saving skill:', error);
      this.showToast('Failed to save skill', 'error');
    }
  }

  async deleteSkill(name) {
    if (!confirm(`Are you sure you want to delete the skill "${name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/settings/skills/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        this.showToast('Skill deleted successfully', 'success');
        this.loadSkills();
      } else {
        throw new Error('Failed to delete');
      }
    } catch (error) {
      console.error('Error deleting skill:', error);
      this.showToast('Failed to delete skill', 'error');
    }
  }

  // ==================== Scheduler ====================

  async loadScheduledTasks() {
    try {
      const response = await fetch('/api/scheduler/tasks');
      const data = await response.json();
      this.scheduledTasks = data.tasks;
      this.renderSchedulerList(data.tasks);
    } catch (error) {
      console.error('Error loading scheduled tasks:', error);
      this.showToast('Failed to load scheduled tasks', 'error');
    }
  }

  renderSchedulerList(tasks) {
    if (tasks.length === 0) {
      this.elements.schedulerList.innerHTML = `
        <div style="color: #888; padding: 1rem; text-align: center;">
          No scheduled tasks yet. Click "+ New Scheduled Task" to create one.
        </div>
      `;
      return;
    }

    this.elements.schedulerList.innerHTML = tasks.map(task => `
      <div class="scheduler-item ${task.enabled ? '' : 'disabled'}" data-task-id="${task.id}">
        <div class="scheduler-info">
          <div class="scheduler-name">
            <span class="scheduler-status ${task.enabled ? '' : 'disabled'}"></span>
            ${this.escapeHtml(task.name)}
          </div>
          <div class="scheduler-meta">
            Interval: ${this.formatInterval(task.intervalMs)} ·
            Last run: ${task.lastRunAt ? new Date(task.lastRunAt).toLocaleString() : 'Never'} ·
            Next run: ${task.nextRunAt ? new Date(task.nextRunAt).toLocaleString() : 'N/A'}
          </div>
          <div class="scheduler-prompt">${this.escapeHtml(task.prompt)}</div>
        </div>
        <div class="scheduler-actions">
          <button class="btn btn-success" onclick="app.runSchedulerNow('${task.id}')">Run Now</button>
          <button class="btn btn-secondary" onclick="app.editScheduler('${task.id}')">Edit</button>
          <button class="btn btn-secondary" onclick="app.toggleScheduler('${task.id}', ${!task.enabled})">${task.enabled ? 'Disable' : 'Enable'}</button>
          <button class="btn btn-danger" onclick="app.deleteScheduler('${task.id}')">Delete</button>
        </div>
      </div>
    `).join('');
  }

  formatInterval(ms) {
    if (ms < 60000) {
      return `${ms / 1000} seconds`;
    } else if (ms < 3600000) {
      return `${ms / 60000} minutes`;
    } else if (ms < 86400000) {
      return `${ms / 3600000} hours`;
    } else {
      return `${ms / 86400000} days`;
    }
  }

  openSchedulerModal(task = null) {
    this.editingScheduler = task;

    if (task) {
      this.elements.schedulerModalTitle.textContent = 'Edit Scheduled Task';
      this.elements.schedulerNameInput.value = task.name;
      this.elements.schedulerEnabledInput.checked = task.enabled;
      this.elements.schedulerPromptEditor.value = task.prompt;

      // Parse interval
      const { value, unit } = this.parseInterval(task.intervalMs);
      this.elements.schedulerIntervalValue.value = value;
      this.elements.schedulerIntervalUnit.value = unit;
    } else {
      this.elements.schedulerModalTitle.textContent = 'New Scheduled Task';
      this.elements.schedulerNameInput.value = '';
      this.elements.schedulerIntervalValue.value = '5';
      this.elements.schedulerIntervalUnit.value = '60000';
      this.elements.schedulerEnabledInput.checked = true;
      this.elements.schedulerPromptEditor.value = '';
    }

    this.elements.schedulerModal.classList.add('active');
  }

  closeSchedulerModal() {
    this.editingScheduler = null;
    this.elements.schedulerModal.classList.remove('active');
  }

  parseInterval(ms) {
    if (ms % 86400000 === 0) {
      return { value: ms / 86400000, unit: '86400000' };
    } else if (ms % 3600000 === 0) {
      return { value: ms / 3600000, unit: '3600000' };
    } else if (ms % 60000 === 0) {
      return { value: ms / 60000, unit: '60000' };
    } else {
      return { value: ms / 1000, unit: '1000' };
    }
  }

  async editScheduler(taskId) {
    try {
      const response = await fetch(`/api/scheduler/tasks/${taskId}`);
      const data = await response.json();
      this.openSchedulerModal(data.task);
    } catch (error) {
      console.error('Error loading scheduled task:', error);
      this.showToast('Failed to load scheduled task', 'error');
    }
  }

  async saveScheduler() {
    const name = this.elements.schedulerNameInput.value.trim();
    const intervalValue = parseInt(this.elements.schedulerIntervalValue.value, 10);
    const intervalUnit = parseInt(this.elements.schedulerIntervalUnit.value, 10);
    const intervalMs = intervalValue * intervalUnit;
    const enabled = this.elements.schedulerEnabledInput.checked;
    const prompt = this.elements.schedulerPromptEditor.value;

    if (!name) {
      this.showToast('Please enter a task name', 'error');
      return;
    }

    if (!prompt) {
      this.showToast('Please enter a prompt', 'error');
      return;
    }

    if (intervalMs < 1000) {
      this.showToast('Interval must be at least 1 second', 'error');
      return;
    }

    try {
      let response;
      if (this.editingScheduler) {
        // Update existing task
        response = await fetch(`/api/scheduler/tasks/${this.editingScheduler.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, prompt, intervalMs, enabled }),
        });
      } else {
        // Create new task
        response = await fetch('/api/scheduler/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, prompt, intervalMs, enabled }),
        });
      }

      if (response.ok) {
        this.showToast('Scheduled task saved successfully', 'success');
        this.closeSchedulerModal();
        this.loadScheduledTasks();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save');
      }
    } catch (error) {
      console.error('Error saving scheduled task:', error);
      this.showToast(`Failed to save scheduled task: ${error.message}`, 'error');
    }
  }

  async toggleScheduler(taskId, enabled) {
    try {
      const response = await fetch(`/api/scheduler/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        this.showToast(`Task ${enabled ? 'enabled' : 'disabled'} successfully`, 'success');
        this.loadScheduledTasks();
      } else {
        throw new Error('Failed to update');
      }
    } catch (error) {
      console.error('Error toggling scheduled task:', error);
      this.showToast('Failed to update scheduled task', 'error');
    }
  }

  async runSchedulerNow(taskId) {
    try {
      this.showToast('Running task...', 'success');
      const response = await fetch(`/api/scheduler/tasks/${taskId}/run`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        this.showToast(`Task started in session ${data.run.sessionId}`, 'success');
        this.loadScheduledTasks();
      } else {
        throw new Error('Failed to run');
      }
    } catch (error) {
      console.error('Error running scheduled task:', error);
      this.showToast('Failed to run scheduled task', 'error');
    }
  }

  async deleteScheduler(taskId) {
    if (!confirm('Are you sure you want to delete this scheduled task?')) {
      return;
    }

    try {
      const response = await fetch(`/api/scheduler/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        this.showToast('Scheduled task deleted successfully', 'success');
        this.loadScheduledTasks();
      } else {
        throw new Error('Failed to delete');
      }
    } catch (error) {
      console.error('Error deleting scheduled task:', error);
      this.showToast('Failed to delete scheduled task', 'error');
    }
  }

  // ==================== Toast ====================

  showToast(message, type = 'success') {
    this.elements.toast.textContent = message;
    this.elements.toast.className = `toast ${type} active`;

    setTimeout(() => {
      this.elements.toast.classList.remove('active');
    }, 3000);
  }

  // ==================== Chat functionality ====================

  async loadSessions() {
    try {
      const response = await fetch('/api/sessions');
      const data = await response.json();

      for (const session of data.sessions) {
        this.sessions.set(session.id, session);
      }

      this.renderSessionList();
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  }

  renderSessionList() {
    const list = this.elements.sessionList;
    list.innerHTML = '';

    const sortedSessions = Array.from(this.sessions.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    for (const session of sortedSessions) {
      const item = document.createElement('li');
      item.className = 'session-item' + (session.id === this.currentSessionId ? ' active' : '');
      item.innerHTML = `
        <div class="session-id">${session.id}</div>
        <div class="session-meta">
          ${session.messageCount} messages · ${session.isActive ? 'Active' : 'Idle'}
        </div>
      `;
      item.addEventListener('click', () => this.selectSession(session.id));
      list.appendChild(item);
    }
  }

  selectSession(sessionId) {
    if (this.currentSessionId === sessionId) return;

    if (this.currentSessionId && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        sessionId: this.currentSessionId,
      }));
    }

    this.currentSessionId = sessionId;
    this.renderSessionList();
    this.clearMessages();

    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        sessionId: sessionId,
      }));
    }

    this.loadSessionLogs(sessionId);
  }

  async loadSessionLogs(sessionId) {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/logs`);
      const data = await response.json();

      this.clearMessages();

      for (const log of data.logs) {
        this.displayLogEntry(log);
      }

      this.scrollToBottom();
    } catch (error) {
      console.error('Error loading session logs:', error);
    }
  }

  displayLogEntry(log) {
    const message = log.data;

    if (message.type === 'user') {
      this.addMessage('user', message.message?.content || '');
    } else if (message.type === 'assistant') {
      const content = message.message?.content;
      if (typeof content === 'string') {
        this.addMessage('assistant', content);
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text') {
            this.addMessage('assistant', block.text);
          } else if (block.type === 'tool_use') {
            this.addMessage('tool', `Tool: ${block.name}\nInput: ${JSON.stringify(block.input, null, 2)}`);
          }
        }
      }
    } else if (message.type === 'result') {
      if (message.subtype === 'success') {
        this.addMessage('result', `Completed (Cost: $${message.total_cost_usd?.toFixed(4) || '?'}, Duration: ${message.duration_ms || '?'}ms)`);
      }
    }
  }

  startNewSession() {
    this.currentSessionId = null;
    this.clearMessages();
    this.renderSessionList();
    this.elements.messageInput.focus();
  }

  sendMessage() {
    const content = this.elements.messageInput.value.trim();
    if (!content || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({
      type: 'chat',
      content: content,
      sessionId: this.currentSessionId,
    }));

    this.addMessage('user', content);
    this.elements.messageInput.value = '';
    this.updateStatus('processing', 'Processing...');
    this.isProcessing = true;
    this.elements.stopBtn.style.display = 'inline-block';
    this.elements.sendBtn.style.display = 'none';
  }

  stopSession() {
    if (!this.currentSessionId || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({
      type: 'stop_session',
      sessionId: this.currentSessionId,
    }));

    this.showToast('Stopping session...', 'success');
  }

  handleMessage(message) {
    switch (message.type) {
      case 'session_info':
        this.currentSessionId = message.sessionId;
        if (!this.sessions.has(message.sessionId)) {
          this.sessions.set(message.sessionId, {
            id: message.sessionId,
            messageCount: message.messageCount,
            isActive: message.isActive,
            createdAt: new Date().toISOString(),
          });
        }
        this.renderSessionList();
        break;

      case 'assistant_message':
        this.addMessage('assistant', message.content);
        break;

      case 'tool_use':
        this.addMessage('tool', `Tool: ${message.toolName}\nInput: ${JSON.stringify(message.toolInput, null, 2)}`);
        break;

      case 'tool_result':
        const resultContent = typeof message.content === 'string'
          ? message.content
          : JSON.stringify(message.content, null, 2);
        this.addMessage('tool', `Result: ${resultContent.substring(0, 500)}${resultContent.length > 500 ? '...' : ''}`);
        break;

      case 'result':
        if (message.success) {
          this.addMessage('result', `Completed (Cost: $${message.cost?.toFixed(4) || '?'}, Duration: ${message.duration || '?'}ms)`);
        } else {
          this.addMessage('error', `Error: ${message.error}`);
        }
        this.updateStatus('connected', 'Connected');
        this.isProcessing = false;
        this.elements.stopBtn.style.display = 'none';
        this.elements.sendBtn.style.display = 'inline-block';
        break;

      case 'error':
        this.addMessage('error', message.error);
        this.updateStatus('connected', 'Connected');
        this.isProcessing = false;
        this.elements.stopBtn.style.display = 'none';
        this.elements.sendBtn.style.display = 'inline-block';
        break;

      case 'stopped':
        this.addMessage('result', 'Session stopped by user');
        this.updateStatus('connected', 'Connected');
        this.isProcessing = false;
        this.elements.stopBtn.style.display = 'none';
        this.elements.sendBtn.style.display = 'inline-block';
        break;

      case 'session_stopped':
        if (message.success) {
          this.showToast('Session stopped', 'success');
        }
        this.updateStatus('connected', 'Connected');
        this.isProcessing = false;
        this.elements.stopBtn.style.display = 'none';
        this.elements.sendBtn.style.display = 'inline-block';
        break;

      case 'system':
        break;
    }

    this.scrollToBottom();
  }

  addMessage(type, content) {
    const messagesEl = this.elements.messages;

    const emptyState = messagesEl.querySelector('.empty-state');
    if (emptyState) {
      emptyState.remove();
    }

    const messageEl = document.createElement('div');
    messageEl.className = `message ${type}`;

    const labels = {
      user: 'You',
      assistant: 'Assistant',
      tool: 'Tool',
      error: 'Error',
      result: 'Result',
    };

    messageEl.innerHTML = `
      <div class="label">${labels[type] || type}</div>
      <pre>${this.escapeHtml(content)}</pre>
    `;

    messagesEl.appendChild(messageEl);
  }

  clearMessages() {
    this.elements.messages.innerHTML = `
      <div class="empty-state">
        <h2>Select a session</h2>
        <p>Or start a new one to begin chatting</p>
      </div>
    `;
  }

  updateStatus(state, text) {
    this.elements.statusDot.className = 'status-dot ' + state;
    this.elements.statusText.textContent = text;
  }

  scrollToBottom() {
    this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize the UI when the DOM is ready
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new ValleyAgentUI();
});
