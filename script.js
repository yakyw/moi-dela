(() => {
  "use strict";

  const STORAGE_KEY = "daylist_tasks_v1";
  const form = document.querySelector("#task-form");
  const input = document.querySelector("#task-input");
  const list = document.querySelector("#task-list");
  const empty = document.querySelector("#empty-state");
  const filters = [...document.querySelectorAll(".filter")];
  const clearButton = document.querySelector("#clear-completed");
  const toast = document.querySelector("#toast");
  const toastMessage = document.querySelector("#toast-message");
  const undoButton = document.querySelector("#undo-delete");
  const toastClose = document.querySelector("#toast-close");

  let tasks = loadTasks();
  let currentFilter = "all";
  let undoTask = null;
  let toastTimer = null;
  let storageAvailable = true;

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(task => task && typeof task.text === "string" && task.text.trim())
        .map(task => ({
          id: typeof task.id === "string" ? task.id : createId(),
          text: task.text.trim().slice(0, 160),
          completed: Boolean(task.completed),
          createdAt: Number.isFinite(task.createdAt) ? task.createdAt : Date.now()
        }));
    } catch (error) {
      console.warn("Не удалось прочитать список задач:", error);
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      if (!storageAvailable) {
        storageAvailable = true;
        showToast("Сохранение снова работает", false);
      }
    } catch (error) {
      storageAvailable = false;
      console.warn("Не удалось сохранить список задач:", error);
      showToast("Браузер не смог сохранить изменения. Проверьте настройки хранилища.", false);
    }
  }

  function createId() {
    return window.crypto?.randomUUID?.() || `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function plural(number, one, few, many) {
    const mod10 = number % 10;
    const mod100 = number % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  }

  function addTask(text) {
    tasks.unshift({ id: createId(), text, completed: false, createdAt: Date.now() });
    saveTasks();
    render();
  }

  function setCompleted(task, completed) {
    task.completed = completed;
    saveTasks();
    render();
  }

  function showToast(message, withUndo = false) {
    window.clearTimeout(toastTimer);
    toastMessage.textContent = message;
    undoButton.hidden = !withUndo;
    toast.hidden = false;
    toast.classList.remove("toast-visible");
    requestAnimationFrame(() => toast.classList.add("toast-visible"));
    toastTimer = window.setTimeout(hideToast, withUndo ? 6000 : 4200);
  }

  function hideToast() {
    toast.classList.remove("toast-visible");
    window.setTimeout(() => { toast.hidden = true; }, 180);
    undoTask = null;
  }

  function deleteTask(task) {
    undoTask = { ...task };
    tasks = tasks.filter(item => item.id !== task.id);
    saveTasks();
    render();
    showToast("Задача удалена", true);
  }

  function editTask(task, textElement, row) {
    const editor = document.createElement("form");
    editor.className = "edit-form";
    const field = document.createElement("input");
    field.className = "edit-input";
    field.type = "text";
    field.maxLength = 160;
    field.value = task.text;
    field.setAttribute("aria-label", "Изменить название задачи");
    const save = document.createElement("button");
    save.className = "edit-save";
    save.type = "submit";
    save.textContent = "Сохранить";
    const cancel = document.createElement("button");
    cancel.className = "edit-cancel";
    cancel.type = "button";
    cancel.textContent = "Отмена";
    editor.append(field, save, cancel);
    textElement.replaceWith(editor);
    row.classList.add("is-editing");
    field.focus();
    field.select();

    const finish = (shouldSave) => {
      if (shouldSave) {
        const value = field.value.trim();
        if (!value) {
          field.setCustomValidity("Введите название задачи");
          field.reportValidity();
          field.focus();
          return;
        }
        task.text = value;
        saveTasks();
      }
      render();
    };
    editor.addEventListener("submit", event => { event.preventDefault(); finish(true); });
    cancel.addEventListener("click", () => finish(false));
    field.addEventListener("keydown", event => {
      if (event.key === "Escape") finish(false);
    });
  }

  function makeIconButton(className, label, symbol) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.textContent = symbol;
    return button;
  }

  function renderTask(task) {
    const row = document.createElement("li");
    row.className = `task-item${task.completed ? " completed" : ""}`;
    row.dataset.taskId = task.id;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "check";
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", task.completed ? `Вернуть задачу «${task.text}» в активные` : `Отметить задачу «${task.text}» выполненной`);
    checkbox.addEventListener("change", () => setCompleted(task, checkbox.checked));

    const text = document.createElement("span");
    text.className = "task-text";
    text.textContent = task.text;

    const actions = document.createElement("div");
    actions.className = "task-actions";
    const edit = makeIconButton("icon-button edit-button", "Редактировать задачу", "✎");
    edit.addEventListener("click", () => editTask(task, text, row));
    const remove = makeIconButton("icon-button delete-button", "Удалить задачу", "×");
    remove.addEventListener("click", () => deleteTask(task));
    actions.append(edit, remove);
    row.append(checkbox, text, actions);
    return row;
  }

  function render() {
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const active = total - completed;
    const percent = total ? Math.round(completed / total * 100) : 0;

    document.querySelector("#task-count").textContent = `${total} ${plural(total, "задача", "задачи", "задач")}`;
    document.querySelector("#all-count").textContent = total;
    document.querySelector("#active-count").textContent = active;
    document.querySelector("#done-count").textContent = completed;
    document.querySelector("#remaining").textContent = active
      ? `Осталось ${active} ${plural(active, "задача", "задачи", "задач")}`
      : total ? "Все задачи выполнены — отличная работа!" : "Пока нет задач — самое время начать";
    document.querySelector("#progress-label").textContent = `${percent}%`;
    document.querySelector("#progress-fill").style.width = `${percent}%`;
    document.querySelector("#progress-bar").setAttribute("aria-valuenow", percent);
    document.querySelector("#progress-caption").textContent = total ? (percent === 100 ? "Всё получилось!" : "Продолжайте в том же духе") : "Пора начать";
    document.querySelector("#completed-summary").textContent = `${completed} выполнено`;
    document.querySelector("#total-summary").textContent = `из ${total} ${plural(total, "задачи", "задач", "задач")}`;
    clearButton.disabled = completed === 0;

    filters.forEach(button => {
      const selected = button.dataset.filter === currentFilter;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });

    const visibleTasks = tasks.filter(task =>
      currentFilter === "all" || (currentFilter === "active" ? !task.completed : task.completed)
    );
    const fragment = document.createDocumentFragment();
    visibleTasks.forEach(task => fragment.append(renderTask(task)));
    list.replaceChildren(fragment);

    empty.hidden = visibleTasks.length > 0;
    if (!visibleTasks.length) {
      const isFiltered = total > 0;
      document.querySelector("#empty-title").textContent = isFiltered
        ? currentFilter === "active" ? "Активных задач нет" : "Выполненных задач пока нет"
        : "Начнём с первой задачи?";
      document.querySelector("#empty-description").textContent = isFiltered
        ? "Для этого фильтра пока ничего не найдено. Выберите другой раздел."
        : "Добавьте дело в поле выше. Маленький шаг — уже начало.";
    }
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) {
      input.focus();
      return;
    }
    addTask(value);
    input.value = "";
    input.focus();
  });

  filters.forEach(button => button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    render();
  }));

  clearButton.addEventListener("click", () => {
    const removed = tasks.filter(task => task.completed);
    if (!removed.length) return;
    tasks = tasks.filter(task => !task.completed);
    saveTasks();
    render();
    undoTask = { bulk: removed };
    showToast(`Удалено задач: ${removed.length}`, true);
  });

  undoButton.addEventListener("click", () => {
    if (!undoTask) return;
    if (undoTask.bulk) {
      const existingIds = new Set(tasks.map(task => task.id));
      tasks = [...undoTask.bulk.filter(task => !existingIds.has(task.id)), ...tasks];
    } else if (!tasks.some(task => task.id === undoTask.id)) {
      tasks.unshift(undoTask);
    }
    saveTasks();
    undoTask = null;
    hideToast();
    render();
  });

  toastClose.addEventListener("click", hideToast);

  window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY) {
      tasks = loadTasks();
      render();
      showToast("Список обновлён в другой вкладке", false);
    }
  });

  document.querySelector("#today").textContent = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long", day: "numeric", month: "long"
  }).format(new Date());

  render();
})();
