// University Calendar Application - Public Version
class CalendarApp {
    constructor() {
        this.currentView = 'month';
        this.currentDate = new Date();
        this.events = [];
        this.selectedDate = null;
        this.editingEvent = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadEvents();
        this.renderCalendar();
    }

    setupEventListeners() {
        // Calendar controls
        document.getElementById('prevPeriod').addEventListener('click', () => this.navigatePeriod(-1));
        document.getElementById('nextPeriod').addEventListener('click', () => this.navigatePeriod(1));
        document.getElementById('todayBtn').addEventListener('click', () => this.goToToday());

        // Event management
        document.getElementById('createEventBtn').addEventListener('click', () => this.showEventModal());
        document.getElementById('eventFormElement').addEventListener('submit', (e) => this.handleEventSubmit(e));
        document.getElementById('cancelEventBtn').addEventListener('click', () => this.hideEventModal());

        // Recurring events
        document.getElementById('eventRecurring').addEventListener('change', (e) => {
            document.getElementById('recurringOptions').classList.toggle('hidden', !e.target.checked);
        });

        // File upload
        document.getElementById('fileUploadForm').addEventListener('submit', (e) => this.handleFileUpload(e));
        document.getElementById('cancelFileUpload').addEventListener('click', () => this.hideFileUploadModal());

        // Modal close buttons
        document.querySelectorAll('.modal .close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.add('hidden');
            });
        });

        // Close modals on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        });
    }

    // Calendar Methods
    setView(view) {
        this.currentView = view;
        document.querySelectorAll('.view-controls .btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`${view}View`).classList.add('active');
        this.renderCalendar();
    }

    navigatePeriod(direction) {
        const date = new Date(this.currentDate);
        
        switch (this.currentView) {
            case 'month':
                date.setMonth(date.getMonth() + direction);
                break;
            case 'week':
                date.setDate(date.getDate() + (direction * 7));
                break;
            case 'day':
                date.setDate(date.getDate() + direction);
                break;
        }
        
        this.currentDate = date;
        this.renderCalendar();
    }

    goToToday() {
        this.currentDate = new Date();
        this.renderCalendar();
    }

    renderCalendar() {
        this.updatePeriodTitle();
        
        switch (this.currentView) {
            case 'month':
                this.renderMonthView();
                break;
            case 'week':
                this.renderWeekView();
                break;
            case 'day':
                this.renderDayView();
                break;
        }
    }

    updatePeriodTitle() {
        const options = { year: 'numeric', month: 'long' };
        let title;
        
        switch (this.currentView) {
            case 'month':
                title = this.currentDate.toLocaleDateString('ru-RU', options);
                break;
            case 'week':
                const weekStart = this.getWeekStart(this.currentDate);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                title = `${weekStart.getDate()} - ${weekEnd.getDate()} ${weekEnd.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}`;
                break;
            case 'day':
                title = this.currentDate.toLocaleDateString('ru-RU', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                break;
        }
        
        document.getElementById('currentPeriod').textContent = title;
    }

    renderMonthView() {
        const grid = document.getElementById('calendarGrid');
        grid.innerHTML = '';
        grid.className = 'calendar-grid';

        // Add week number header
        const weekHeader = document.createElement('div');
        weekHeader.className = 'calendar-header';
        weekHeader.textContent = 'Неделя';
        grid.appendChild(weekHeader);

        // Add day headers
        const dayHeaders = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        dayHeaders.forEach(day => {
            const header = document.createElement('div');
            header.className = 'calendar-header';
            header.textContent = day;
            grid.appendChild(header);
        });

        // Get first day of month and calculate calendar days
        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const startDate = this.getWeekStart(firstDay);
        
        // Generate 6 weeks
        for (let week = 0; week < 6; week++) {
            const weekStartDate = new Date(startDate);
            weekStartDate.setDate(startDate.getDate() + (week * 7));
            
            // Calculate week number (1-based, starting from September 1st)
            const weekNumber = this.getWeekNumber(weekStartDate);
            
            // Add week number cell
            const weekElement = document.createElement('div');
            weekElement.className = 'week-number clickable';
            
            // Week number label
            const weekLabel = document.createElement('div');
            weekLabel.className = 'week-number-label';
            weekLabel.textContent = `${weekNumber}`;
            weekElement.appendChild(weekLabel);
            
            // Week events container
            const weekEvents = document.createElement('div');
            weekEvents.className = 'week-events';
            
            // Get events for this week
            const weekEventsData = this.getEventsForWeek(weekStartDate);
            weekEventsData.forEach(event => {
                const eventElement = document.createElement('div');
                eventElement.className = 'week-event-item';
                eventElement.textContent = event.title;
                eventElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showEventDetails(event);
                });
                weekEvents.appendChild(eventElement);
            });
            
            weekElement.appendChild(weekEvents);
            weekElement.addEventListener('click', () => this.showWeekEventModal(weekNumber, weekStartDate));
            grid.appendChild(weekElement);
            
            // Add 7 days for this week
            for (let day = 0; day < 7; day++) {
                const date = new Date(weekStartDate);
                date.setDate(weekStartDate.getDate() + day);
                
                const dayElement = this.createDayElement(date);
                grid.appendChild(dayElement);
            }
        }
    }

    createDayElement(date) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        
        const isCurrentMonth = date.getMonth() === this.currentDate.getMonth();
        const isToday = this.isToday(date);
        const isSelected = this.selectedDate && this.isSameDay(date, this.selectedDate);
        
        if (!isCurrentMonth) dayElement.classList.add('other-month');
        if (isToday) dayElement.classList.add('today');
        if (isSelected) dayElement.classList.add('selected');
        
        // Day number
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = date.getDate();
        dayElement.appendChild(dayNumber);
        
        // Events for this day
        const dayEvents = document.createElement('div');
        dayEvents.className = 'day-events';
        
        const eventsForDay = this.getEventsForDay(date);
        eventsForDay.forEach(event => {
            const eventElement = document.createElement('div');
            eventElement.className = `event-item ${event.event_type} priority-${event.priority || 'medium'}`;
            eventElement.textContent = event.title;
            eventElement.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showEventDetails(event);
            });
            dayEvents.appendChild(eventElement);
        });
        
        dayElement.appendChild(dayEvents);
        
        // Click handler for day
        dayElement.addEventListener('click', () => {
            this.selectedDate = date;
            this.renderCalendar();
            this.showSimpleEventModal(date);
        });
        
        return dayElement;
    }

    renderWeekView() {
        // Simplified week view - would need more complex implementation
        this.renderMonthView();
    }

    renderDayView() {
        // Simplified day view - would need more complex implementation
        this.renderMonthView();
    }

    // Event Methods
    async loadEvents() {
        try {
            const response = await this.apiCall('/api/events', 'GET');
            
            if (response.success) {
                this.events = response.data;
                this.renderCalendar();
            }
        } catch (error) {
            this.showToast('Ошибка загрузки событий', 'error');
        }
    }

    getEventsForDay(date) {
        return this.events.filter(event => {
            const eventStart = new Date(event.start_time);
            const eventEnd = new Date(event.end_time);
            
            // Calculate event duration in days
            const eventDuration = (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60 * 60 * 24);
            
            // Only show single-day events in day cells
            // Multi-day events (week events) should only appear in week column
            return eventDuration <= 1 && this.isSameDay(eventStart, date);
        });
    }

    getEventsForWeek(weekStartDate) {
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekStartDate.getDate() + 6);
        
        return this.events.filter(event => {
            const eventStart = new Date(event.start_time);
            const eventEnd = new Date(event.end_time);
            
            // Check if event spans multiple days (likely a week event)
            const eventDuration = (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60 * 60 * 24);
            
            // If event is longer than 1 day and starts within this week, show it in week column
            return eventDuration > 1 && 
                   eventStart >= weekStartDate && 
                   eventStart <= weekEndDate;
        });
    }

    // Simplified event creation modal
    showSimpleEventModal(date) {
        const eventName = prompt('Название события:');
        if (!eventName) return;
        
        const eventNotes = prompt('Заметки (необязательно):') || '';
        
        // Create event with minimal data
        const eventData = {
            title: eventName,
            description: eventNotes,
            event_type: 'other',
            start_time: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0).toISOString(),
            end_time: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 10, 0).toISOString(),
            priority: 'medium',
            is_recurring: false
        };
        
        this.createSimpleEvent(eventData);
    }

    async createSimpleEvent(eventData) {
        try {
            this.showLoading();
            const response = await this.apiCall('/api/events', 'POST', eventData);
            
            if (response.success) {
                this.loadEvents();
                this.showToast('Событие создано!', 'success');
            } else {
                this.showToast(response.message || 'Ошибка создания события', 'error');
            }
        } catch (error) {
            this.showToast('Ошибка подключения к серверу', 'error');
        } finally {
            this.hideLoading();
        }
    }

    showEventModal(date = null) {
        this.editingEvent = null;
        document.getElementById('eventFormTitle').textContent = 'Создать событие';
        document.getElementById('eventModal').classList.remove('hidden');
        
        // Reset form
        document.getElementById('eventFormElement').reset();
        document.getElementById('recurringOptions').classList.add('hidden');
        
        // Set default date/time if provided
        if (date) {
            const dateStr = date.toISOString().slice(0, 16);
            document.getElementById('eventStartTime').value = dateStr;
            
            const endDate = new Date(date);
            endDate.setHours(endDate.getHours() + 1);
            document.getElementById('eventEndTime').value = endDate.toISOString().slice(0, 16);
        }
    }

    hideEventModal() {
        document.getElementById('eventModal').classList.add('hidden');
        this.editingEvent = null;
    }

    async handleEventSubmit(e) {
        e.preventDefault();
        
        const eventData = {
            title: document.getElementById('eventTitle').value,
            description: document.getElementById('eventDescription').value || null,
            course: document.getElementById('eventCourse').value || null,
            event_type: document.getElementById('eventType').value,
            start_time: new Date(document.getElementById('eventStartTime').value).toISOString(),
            end_time: new Date(document.getElementById('eventEndTime').value).toISOString(),
            location: document.getElementById('eventLocation').value || null,
            instructor: document.getElementById('eventInstructor').value || null,
            priority: document.getElementById('eventPriority').value,
            is_recurring: document.getElementById('eventRecurring').checked,
        };

        // Handle recurring events
        if (eventData.is_recurring) {
            const frequency = document.getElementById('recurringFrequency').value;
            const endDate = document.getElementById('recurringEndDate').value;
            const daysOfWeek = Array.from(document.querySelectorAll('.days-of-week input:checked'))
                .map(cb => parseInt(cb.value));
            
            eventData.recurrence_pattern = {
                frequency,
                days_of_week: daysOfWeek.length > 0 ? daysOfWeek : null,
                interval: 1
            };
            
            if (endDate) {
                eventData.recurrence_end_date = endDate;
            }
        }

        try {
            this.showLoading();
            const url = this.editingEvent ? `/api/events/${this.editingEvent.id}` : '/api/events';
            const method = this.editingEvent ? 'PUT' : 'POST';
            
            const response = await this.apiCall(url, method, eventData);
            
            if (response.success) {
                this.hideEventModal();
                this.loadEvents();
                this.showToast(
                    this.editingEvent ? 'Событие обновлено!' : 'Событие создано!', 
                    'success'
                );
            } else {
                this.showToast(response.message || 'Ошибка сохранения события', 'error');
            }
        } catch (error) {
            this.showToast('Ошибка подключения к серверу', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async showEventDetails(event) {
        // Load event details with files and notes
        try {
            const response = await this.apiCall(`/api/events/${event.id}/details`);
            if (!response.success) {
                this.showToast('Ошибка загрузки деталей события', 'error');
                return;
            }
            
            const eventDetails = response.data;
            const modal = document.getElementById('eventDetailsModal');
            const details = document.getElementById('eventDetails');
            
            const startTime = new Date(eventDetails.start_time).toLocaleString('ru-RU');
            const endTime = new Date(eventDetails.end_time).toLocaleString('ru-RU');
            
            const typeNames = {
                'class': 'Занятие',
                'homework': 'Домашнее задание',
                'exam': 'Экзамен',
                'other': 'Прочее'
            };
            
            const priorityNames = {
                'low': 'Низкий',
                'medium': 'Средний',
                'high': 'Высокий'
            };

            details.innerHTML = `
                <h2>${eventDetails.title}</h2>
                <div class="event-meta">
                    <div class="meta-item">
                        <i class="fas fa-tag"></i>
                        <span>${typeNames[eventDetails.event_type] || eventDetails.event_type}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-clock"></i>
                        <span>${startTime} - ${endTime}</span>
                    </div>
                    ${eventDetails.location ? `
                    <div class="meta-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${eventDetails.location}</span>
                    </div>` : ''}
                    ${eventDetails.instructor ? `
                    <div class="meta-item">
                        <i class="fas fa-user"></i>
                        <span>${eventDetails.instructor}</span>
                    </div>` : ''}
                    <div class="meta-item">
                        <i class="fas fa-exclamation-circle"></i>
                        <span>${priorityNames[eventDetails.priority]}</span>
                    </div>
                    ${eventDetails.course ? `
                    <div class="meta-item">
                        <i class="fas fa-book"></i>
                        <span>${eventDetails.course}</span>
                    </div>` : ''}
                </div>
                ${eventDetails.description ? `
                <div class="event-description">
                    <h3>Описание</h3>
                    <p>${eventDetails.description}</p>
                </div>` : ''}
                
                <div class="form-actions">
                    <button class="btn btn-outline" onclick="app.editEvent('${eventDetails.id}')">
                        <i class="fas fa-edit"></i> Редактировать
                    </button>
                    <button class="btn btn-outline" onclick="app.showFileUploadModal('${eventDetails.id}')">
                        <i class="fas fa-upload"></i> Загрузить файл
                    </button>
                    <button class="btn btn-outline" onclick="app.deleteEvent('${eventDetails.id}')">
                        <i class="fas fa-trash"></i> Удалить
                    </button>
                </div>
                
                ${eventDetails.files && eventDetails.files.length > 0 ? `
                <div class="event-files">
                    <h3>Прикрепленные файлы</h3>
                    <div class="file-list">
                        ${eventDetails.files.map(file => `
                            <div class="file-item">
                                <div class="file-info">
                                    <i class="fas fa-file"></i>
                                    <span>${file.original_filename}</span>
                                    <small>(${this.formatFileSize(file.file_size)}) - ${file.uploaded_by}</small>
                                </div>
                                <div class="file-actions">
                                    <button class="btn btn-outline" onclick="app.downloadFile('${file.id}')">
                                        <i class="fas fa-download"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>` : ''}
                
                <div class="event-notes">
                    <h3>Заметки и обсуждение</h3>
                    <div class="notes-list" id="notesList-${eventDetails.id}">
                        ${eventDetails.notes && eventDetails.notes.length > 0 ? 
                            eventDetails.notes.map(note => `
                                <div class="note-item">
                                    <div class="note-header">
                                        <strong>${note.author_name}</strong>
                                        <small>${new Date(note.created_at).toLocaleString('ru-RU')}</small>
                                    </div>
                                    <div class="note-content">${note.content}</div>
                                </div>
                            `).join('') : 
                            '<p class="no-notes">Пока нет заметок</p>'
                        }
                    </div>
                    
                    <div class="add-note-form">
                        <div class="form-group">
                            <input type="text" id="noteAuthor-${eventDetails.id}" placeholder="Ваше имя" required>
                        </div>
                        <div class="form-group">
                            <textarea id="noteContent-${eventDetails.id}" placeholder="Добавить заметку..." rows="3" required></textarea>
                        </div>
                        <button class="btn btn-primary" onclick="app.addNote('${eventDetails.id}')">
                            <i class="fas fa-plus"></i> Добавить заметку
                        </button>
                    </div>
                </div>
            `;
            
            modal.classList.remove('hidden');
        } catch (error) {
            this.showToast('Ошибка подключения к серверу', 'error');
        }
    }

    async editEvent(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (!event) return;
        
        this.editingEvent = event;
        document.getElementById('eventFormTitle').textContent = 'Редактировать событие';
        
        // Fill form with event data
        document.getElementById('eventTitle').value = event.title;
        document.getElementById('eventDescription').value = event.description || '';
        document.getElementById('eventCourse').value = event.course || '';
        document.getElementById('eventType').value = event.event_type;
        document.getElementById('eventStartTime').value = new Date(event.start_time).toISOString().slice(0, 16);
        document.getElementById('eventEndTime').value = new Date(event.end_time).toISOString().slice(0, 16);
        document.getElementById('eventLocation').value = event.location || '';
        document.getElementById('eventInstructor').value = event.instructor || '';
        document.getElementById('eventPriority').value = event.priority;
        document.getElementById('eventRecurring').checked = event.is_recurring;
        
        if (event.is_recurring) {
            document.getElementById('recurringOptions').classList.remove('hidden');
            // Fill recurring options if needed
        }
        
        document.getElementById('eventDetailsModal').classList.add('hidden');
        document.getElementById('eventModal').classList.remove('hidden');
    }

    async deleteEvent(eventId) {
        if (!confirm('Вы уверены, что хотите удалить это событие?')) return;
        
        try {
            this.showLoading();
            const response = await this.apiCall(`/api/events/${eventId}`, 'DELETE');
            
            if (response.success) {
                document.getElementById('eventDetailsModal').classList.add('hidden');
                this.loadEvents();
                this.showToast('Событие удалено!', 'success');
            } else {
                this.showToast('Ошибка удаления события', 'error');
            }
        } catch (error) {
            this.showToast('Ошибка подключения к серверу', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // File Methods
    showFileUploadModal(eventId) {
        this.currentEventId = eventId;
        document.getElementById('fileUploadModal').classList.remove('hidden');
    }

    hideFileUploadModal() {
        document.getElementById('fileUploadModal').classList.add('hidden');
        this.currentEventId = null;
    }

    async handleFileUpload(e) {
        e.preventDefault();
        
        const fileInput = document.getElementById('fileInput');
        const uploaderName = document.getElementById('uploaderName');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showToast('Пожалуйста, выберите файл', 'error');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('uploaded_by', uploaderName.value || 'Anonymous');
        
        try {
            this.showLoading();
            const response = await fetch(`/api/events/${this.currentEventId}/files`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.hideFileUploadModal();
                this.loadEvents();
                this.showToast('Файл загружен!', 'success');
            } else {
                this.showToast(result.message || 'Ошибка загрузки файла', 'error');
            }
        } catch (error) {
            this.showToast('Ошибка подключения к серверу', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async downloadFile(fileId) {
        try {
            const response = await fetch(`/api/files/${fileId}/download`);
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                
                // Extract filename from Content-Disposition header
                const contentDisposition = response.headers.get('Content-Disposition');
                let filename = 'file';
                
                if (contentDisposition) {
                    const filenameMatch = contentDisposition.match(/filename="([^"]+)"/i);
                    if (filenameMatch) {
                        filename = filenameMatch[1];
                    } else {
                        // Fallback for filename without quotes
                        const fallbackMatch = contentDisposition.match(/filename=([^;]+)/i);
                        if (fallbackMatch) {
                            filename = fallbackMatch[1].trim();
                        }
                    }
                }
                
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                this.showToast(`Файл ${filename} скачан!`, 'success');
            } else {
                this.showToast('Ошибка скачивания файла', 'error');
            }
        } catch (error) {
            this.showToast('Ошибка подключения к серверу', 'error');
        }
    }
    
    // Notes Methods
    async addNote(eventId) {
        const authorInput = document.getElementById(`noteAuthor-${eventId}`);
        const contentInput = document.getElementById(`noteContent-${eventId}`);
        
        const author = authorInput.value.trim();
        const content = contentInput.value.trim();
        
        if (!author || !content) {
            this.showToast('Пожалуйста, заполните имя и текст заметки', 'error');
            return;
        }
        
        try {
            this.showLoading();
            const response = await this.apiCall(`/api/events/${eventId}/notes`, 'POST', {
                author_name: author,
                content: content
            });
            
            if (response.success) {
                // Clear the form
                contentInput.value = '';
                
                // Reload the event details to show the new note
                const event = this.events.find(e => e.id === eventId);
                if (event) {
                    this.showEventDetails(event);
                }
                
                this.showToast('Заметка добавлена!', 'success');
            } else {
                this.showToast(response.message || 'Ошибка добавления заметки', 'error');
            }
        } catch (error) {
            this.showToast('Ошибка подключения к серверу', 'error');
        } finally {
            this.hideLoading();
        }
    }


    // Week number calculation (1-based, starting from September 1st)
    getWeekNumber(date) {
        const year = date.getFullYear();
        // Academic year starts September 1st
        const academicYearStart = new Date(year, 8, 1); // September 1st
        
        // If date is before September, use previous year's academic start
        if (date.getMonth() < 8) {
            academicYearStart.setFullYear(year - 1);
        }
        
        const weekStart = this.getWeekStart(date);
        const academicWeekStart = this.getWeekStart(academicYearStart);
        
        const diffTime = weekStart.getTime() - academicWeekStart.getTime();
        const diffWeeks = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
        
        return Math.max(1, diffWeeks + 1);
    }
    
    // Show week event creation modal
    showWeekEventModal(weekNumber, weekStartDate) {
        const eventName = prompt(`Создать событие для недели ${weekNumber}:`);
        if (!eventName) return;
        
        const eventNotes = prompt('Заметки (необязательно):') || '';
        
        // Create week-long event
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekStartDate.getDate() + 6);
        
        const eventData = {
            title: `${eventName} (Неделя ${weekNumber})`,
            description: eventNotes,
            event_type: 'other',
            start_time: new Date(weekStartDate.getFullYear(), weekStartDate.getMonth(), weekStartDate.getDate(), 9, 0).toISOString(),
            end_time: new Date(weekEndDate.getFullYear(), weekEndDate.getMonth(), weekEndDate.getDate(), 17, 0).toISOString(),
            priority: 'medium',
            is_recurring: false
        };
        
        this.createSimpleEvent(eventData);
    }

    // Utility Methods
    async apiCall(url, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(url, options);
        return await response.json();
    }

    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
        return new Date(d.setDate(diff));
    }

    isToday(date) {
        const today = new Date();
        return this.isSameDay(date, today);
    }

    isSameDay(date1, date2) {
        return date1.getDate() === date2.getDate() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getFullYear() === date2.getFullYear();
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showLoading() {
        document.getElementById('loadingSpinner').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loadingSpinner').classList.add('hidden');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        document.getElementById('toastContainer').appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }
}

// Initialize the application
const app = new CalendarApp();
