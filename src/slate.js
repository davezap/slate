import { createSourceEditor } from './source-editor.js';
import { markWordChanges, planChanges } from './changes.js';
import { checkAnswers, isFormTemplate, localToday, parseForm, fillMarkdown } from './forms.js';

(() => {
  'use strict';

  // Where slate.js was loaded from, to find mermaid/ next to it.
  const SCRIPT_URL = document.currentScript?.src || '';

  const APP_VERSION = '0.20.0';
  const DB_NAME = 'slate-markdown-editor-db';
  const DB_VERSION = 1;
  const NODE_STORE = 'documents';
  const ATTACHMENT_STORE = 'attachments';
  const DOCUMENT_ID = 'document';
  const EDITOR_TEMPLATE = `<div id="app" class="editor-app" data-editor-mode="edit" data-read-only="false" data-document-complete="false">
    <section id="noteWorkspace" class="note-workspace">
      <div id="formatToolbar" class="format-toolbar" aria-label="Markdown editor controls">
        <div id="formatControls" class="format-controls" aria-label="Markdown formatting">
          <button type="button" data-format="bold" title="Bold (Ctrl+B)"><strong>B</strong></button>
          <button type="button" data-format="italic" title="Italic (Ctrl+I)"><em>I</em></button>
          <button type="button" data-format="strike" title="Strikethrough"><s>S</s></button>
          <span class="toolbar-separator"></span>
          <button type="button" data-format="heading" title="Heading">H</button>
          <button type="button" data-format="quote" title="Blockquote">❯</button>
          <button type="button" data-format="code" title="Inline code">&lt;/&gt;</button>
          <button type="button" data-format="codeblock" title="Code block">▣</button>
          <span class="toolbar-separator"></span>
          <button type="button" data-format="link" title="Link (Ctrl+K)">↗</button>
          <button type="button" data-format="wikilink" title="Wiki link">[[ ]]</button>
          <button type="button" data-format="task" title="Task">☑</button>
          <button type="button" data-format="video" title="Insert video Markdown template">▶</button>
          <button type="button" data-format="video-task" title="Insert locked video-task Markdown template">▶✓</button>
          <button id="attachButton" type="button" title="Attach image, video, or file">📎</button>
          <input id="attachInput" type="file" multiple hidden>
        </div>

        <button id="changesToggle" class="changes-toggle" type="button" aria-pressed="false" hidden
          title="Show what changed since another version">± Changes</button>
        <div id="viewSwitcher" class="view-switcher" role="group" aria-label="Editor mode">
          <button class="view-button active" data-workspace-mode="edit" type="button" title="Edit with Obsidian-style Live Preview">Edit</button>
          <button class="view-button" data-workspace-mode="preview" type="button" title="Preview the rendered document without editing">Preview</button>
          <button class="view-button" data-workspace-mode="source" type="button" title="Edit the complete raw Markdown source">Source</button>
        </div>
      </div>

      <div id="workspaceBody" class="workspace-body">
        <div class="workspace-gutter" aria-label="Document navigation controls">
          <button id="outlineToggle" class="outline-toggle outline-control" type="button"
            aria-controls="documentOutline" aria-expanded="true"
            aria-label="Toggle document outline" title="Show or hide document outline">
            <svg class="outline-control-icon outline-menu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
            <svg class="outline-control-icon outline-complete-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M4.5 12.5 9.5 17.5 19.5 6.5"></path>
            </svg>
          </button>
        </div>

        <aside id="documentOutline" class="document-outline" aria-label="Document navigation">
          <div class="outline-header">
            <div>
              <strong>Document navigation</strong>
              <span id="outlineSummary">No headings</span>
            </div>
            <button id="outlineClose" class="outline-close outline-control" type="button"
              aria-controls="documentOutline" aria-expanded="true"
              aria-label="Close document navigation" title="Close document navigation">
              <svg class="outline-control-icon outline-menu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M4 6h16M4 12h16M4 18h16"></path>
              </svg>
              <svg class="outline-control-icon outline-complete-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M4.5 12.5 9.5 17.5 19.5 6.5"></path>
              </svg>
            </button>
          </div>
          <nav id="outlineNavigation" class="outline-navigation" aria-label="Headings"></nav>
        </aside>

        <div id="editorGrid" class="editor-grid live-view">
          <article id="previewPane" class="preview-pane view-only markdown-body" aria-label="Rendered Markdown document"></article>
          <div id="editorPane" class="editor-pane">
            <div id="compareBar" class="compare-bar" role="region" aria-label="Compare versions" hidden>
              <span class="compare-legend">
                <span class="compare-key compare-key-other"><span id="compareLabel">Other version</span></span>
                <span class="compare-key compare-key-this">This document</span>
              </span>
              <span id="compareSummary" class="compare-summary" aria-live="polite"></span>
              <span class="compare-actions">
                <button id="compareUseAll" class="compare-button" type="button">Use all of theirs</button>
                <button id="compareDone" class="compare-button compare-done" type="button">Done</button>
              </span>
            </div>
            <div id="markdownEditor" class="markdown-editor"></div>
          </div>
          <div id="changesPane" class="changes-pane" data-form="preview" hidden>
            <div class="compare-bar changes-bar" role="region" aria-label="Changes">
              <span class="compare-legend">
                <strong id="changesTitle" class="changes-title">Changes</strong>
                <span class="compare-key compare-key-other">Removed</span>
                <span class="compare-key compare-key-this">Added</span>
              </span>
              <span id="changesSummary" class="compare-summary" aria-live="polite"></span>
              <span class="compare-actions">
                <button id="changesPrevious" class="compare-button" type="button" title="Previous change" aria-label="Previous change">↑</button>
                <button id="changesNext" class="compare-button" type="button" title="Next change" aria-label="Next change">↓</button>
                <button id="changesClose" class="compare-button compare-done" type="button">Hide Changes</button>
              </span>
            </div>
            <article id="changesPreview" class="preview-pane view-only markdown-body changes-preview" aria-label="Changes in the rendered document"></article>
            <div id="changesSource" class="markdown-editor changes-source"></div>
          </div>
          <div id="fillPane" class="fill-pane" hidden>
            <div class="compare-bar fill-bar" role="region" aria-label="Filling in a form">
              <span class="compare-legend"><strong id="fillTitle" class="changes-title">Filling in</strong></span>
              <span id="fillStatus" class="compare-summary fill-status" aria-live="polite"></span>
              <span class="compare-actions">
                <button id="fillSubmit" class="compare-button compare-done" type="button">Send</button>
                <button id="fillClose" class="compare-button" type="button">Stop Filling In</button>
              </span>
            </div>
            <article id="fillForm" class="preview-pane view-only markdown-body fill-form" aria-label="Form to fill in"></article>
          </div>
          <div id="dropOverlay" class="drop-overlay" hidden>
            <div>
              <span class="drop-icon">⇩</span>
              <strong>Drop files to insert</strong>
              <small>Images and videos appear inline; other files become links.</small>
            </div>
          </div>
        </div>
      </div>

      <footer class="statusbar">
        <span id="saveStatus">Saved locally</span>
        <span id="documentStats">0 words · 0 characters</span>
      </footer>
    </section>

    <div id="toastRegion" class="toast-region" aria-live="polite" aria-atomic="true"></div>
  </div>`;
  const memorySettings = new Map();
  const externalScriptPromises = new Map();

  let mountHost = null;
  let mountRoot = null;
  let ownerDocument = document;
  let mountedApi = null;
  let initialisePromise = null;
  let resolveReady;
  let rejectReady;
  const readyPromise = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  let pendingAttachmentHandler = null;
  let currentMountOptions = {};

  const state = {
    db: null,
    nodes: [],
    selectedId: DOCUMENT_ID,
    view: 'live',
    editorMode: 'edit',
    readOnly: false,
    lastWritableWorkspaceMode: null,
    saveTimers: new Map(),
    previewTimer: null,
    outlineTimer: null,
    outlineOpen: true,
    completionState: Object.freeze({ hasCheckboxes: false, total: 0, checked: 0, complete: false }),
    completionCallbacks: new Set(),
    dragDepth: 0,
    attachmentUrls: new Map(),
    isSaving: false,
    liveRenderGeneration: 0,
    mediaPlayers: [],
    memoryStores: new Map([[NODE_STORE, new Map()], [ATTACHMENT_STORE, new Map()]]),
    usingMemoryStorage: false,
    persistDocument: true,
    persistSettings: true,
    attachmentHandler: null,
    attachmentBusy: false,
    interactiveTasks: false,
    resolveUrl: null,
    diagramsUrl: '',
    outlinePanel: true,
    compare: null,
    changes: null,
    changesEditor: null,
    changesGeneration: 0,
    changesToggle: null,
    fill: null,
    outline: { headings: [], completion: { hasCheckboxes: false, total: 0, checked: 0, unchecked: 0, complete: false } },
  };

  const el = {};

  const facade = {
    mount,
    get ready() { return readyPromise; },
    setAttachmentHandler(handler) {
      validateAttachmentHandler(handler);
      pendingAttachmentHandler = handler;
      if (mountedApi) mountedApi.setAttachmentHandler(handler);
    },
  };
  Object.defineProperty(facade, 'documentComplete', {
    enumerable: true,
    get() { return mountedApi?.documentComplete || false; },
  });
  window.SlateMarkdownEditor = facade;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount, { once: true });
  } else {
    queueMicrotask(autoMount);
  }

  function autoMount() {
    if (initialisePromise) return;
    const target = document.querySelector('[data-slate-editor-autostart]');
    if (!target) return;
    const markdownNode = target.querySelector('script[type="text/markdown"]');
    const options = {};
    if (markdownNode) options.markdown = markdownNode.textContent || '';
    mount(target, options).catch(error => console.error(error));
  }

  function resolveMountTarget(target) {
    const resolved = typeof target === 'string' ? document.querySelector(target) : target;
    if (!(resolved instanceof Element)) {
      throw new TypeError('SlateMarkdownEditor.mount(target) requires an Element or matching selector.');
    }
    return resolved;
  }

  function validateAttachmentHandler(handler) {
    if (handler !== null && typeof handler !== 'function') {
      throw new TypeError('setAttachmentHandler requires a function or null.');
    }
  }

  async function mount(target, options = {}) {
    const resolved = resolveMountTarget(target);
    if (initialisePromise) {
      if (resolved !== mountHost) throw new Error(`Slate ${APP_VERSION} currently supports one mounted editor per page.`);
      return initialisePromise;
    }

    validateAttachmentHandler(options.attachmentHandler ?? pendingAttachmentHandler);
    mountHost = resolved;
    mountRoot = resolved;
    ownerDocument = resolved.ownerDocument || document;
    currentMountOptions = { ...options };

    state.persistDocument = options.persist !== false;
    state.persistSettings = options.persistSettings ?? state.persistDocument;
    state.attachmentHandler = options.attachmentHandler ?? pendingAttachmentHandler;
    state.interactiveTasks = Boolean(options.interactiveTasks);
    state.resolveUrl = typeof options.resolveUrl === 'function' ? options.resolveUrl : null;
    state.outlinePanel = options.outlinePanel !== false;
    state.diagramsUrl = typeof options.diagramsUrl === 'string' ? options.diagramsUrl : '';

    const requestedMode = normaliseWorkspaceMode(
      options.workspaceMode ?? readSetting('slate.workspaceMode') ?? 'edit'
    );
    state.view = requestedMode === 'source'
      ? 'source'
      : normaliseStoredView(readSetting('slate.editorView'));
    state.editorMode = requestedMode === 'preview'
      ? 'view'
      : normaliseStoredEditorMode(readSetting('slate.editorMode'));
    if (requestedMode === 'edit') { state.view = 'live'; state.editorMode = 'edit'; }
    if (requestedMode === 'source') { state.view = 'source'; state.editorMode = 'edit'; }
    state.outlineOpen = options.outlineOpen === undefined
      ? normaliseStoredOutlineOpen(readSetting('slate.outlineOpen'))
      : Boolean(options.outlineOpen);

    mountHost.classList.add('slate-editor-host');
    mountHost.dataset.slateVersion = APP_VERSION;
    mountHost.innerHTML = EDITOR_TEMPLATE;

    initialisePromise = initialise(options).then(() => mountedApi);
    return initialisePromise;
  }

  async function initialise(options = {}) {
    cacheElements();
    bindEvents();
    applyStoredTheme(options.theme);
    watchDiagramTheme();
    watchPrint();

    try {
      state.db = await openDatabase();
      let documentRecord = null;

      if (state.persistDocument) {
        documentRecord = await getRecord(NODE_STORE, DOCUMENT_ID);
      }
      if (!documentRecord) documentRecord = createDefaultDocument();
      if (Object.prototype.hasOwnProperty.call(options, 'markdown')) {
        documentRecord.content = String(options.markdown ?? '');
      }
      documentRecord.content = ensureTrailingBlankLine(documentRecord.content || '');
      documentRecord.updatedAt = Date.now();
      if (state.persistDocument) await putRecord(NODE_STORE, documentRecord);

      state.nodes = [documentRecord];
      state.selectedId = DOCUMENT_ID;
      el.markdownEditor.replaceDocument(documentRecord.content);
      updateDocumentStats();
      applyOutlineVisibility(state.outlineOpen, { persist: false, notify: false });
      applyView(state.view, { render: false });
      await renderPreview();
      applyEditorMode(state.editorMode, { render: false });
      state.lastWritableWorkspaceMode = getWorkspaceMode() === 'source' ? 'source' : 'edit';
      exposePublicApi();
      if (options.readOnly) await applyReadOnly(true);
      if (!state.persistDocument) el.saveStatus.textContent = 'Host controlled';
      if (options.showReadyToast !== false) {
        const storageNote = state.persistDocument
          ? (state.usingMemoryStorage ? ' · session storage' : '')
          : ' · host controlled';
        showToast(`Slate Markdown Editor ${APP_VERSION} ready${storageNote}`);
      }
      dispatchEditorEvent('slate:ready', { api: mountedApi, version: APP_VERSION });
      resolveReady(mountedApi);
    } catch (error) {
      console.error(error);
      showFatalError(error);
      rejectReady(error);
      throw error;
    }
  }

  function cacheElements() {
    const ids = [
      'app', 'noteWorkspace', 'formatToolbar', 'formatControls', 'workspaceBody', 'documentOutline', 'outlineToggle',
      'outlineClose', 'outlineNavigation', 'outlineSummary', 'editorGrid', 'editorPane', 'markdownEditor',
      'previewPane', 'dropOverlay', 'saveStatus', 'documentStats', 'attachButton',
      'attachInput', 'toastRegion', 'compareBar', 'compareLabel', 'compareSummary', 'compareUseAll', 'compareDone',
      'viewSwitcher', 'changesToggle', 'changesPane', 'changesTitle', 'changesSummary', 'changesPrevious', 'changesNext', 'changesClose', 'changesPreview', 'changesSource',
      'fillPane', 'fillTitle', 'fillStatus', 'fillSubmit', 'fillClose', 'fillForm'
    ];
    ids.forEach(id => { el[id] = mountRoot.querySelector(`#${id}`); });
    el.viewButtons = [...mountRoot.querySelectorAll('.view-button')];
    el.markdownEditor = createSourceEditor(el.markdownEditor, {
      placeholder: 'Start writing Markdown…',
      ariaLabel: 'Markdown source editor',
      onInput: handleSourceInput,
      keymap: [
        { key: 'Mod-b', run: () => runSourceFormatting('bold') },
        { key: 'Mod-i', run: () => runSourceFormatting('italic') },
        { key: 'Mod-k', run: () => runSourceFormatting('link') },
        { key: 'Enter', run: continueMarkdownLine },
      ],
      livePreview: {
        detectBlocks: detectLiveBlocks,
        renderBlock: renderLiveWidget,
        destroyBlock: dom => destroyMediaPlayers(dom),
        renderInlineImage: renderInlineImageWidget,
        linkAttributes: liveLinkAttributes,
      },
      domEventHandlers: {
        paste(event) {
          handlePaste(event);
          return event.defaultPrevented;
        },
        // Dropped files are attachments (handleDrop on the host), not text to insert.
        drop: event => hasFiles(event.dataTransfer),
        dragover: event => hasFiles(event.dataTransfer),
      },
    });
  }

  function runSourceFormatting(kind) {
    if (state.editorMode !== 'edit') return false;
    applyFormatting(kind);
    return true;
  }

  // Enter in Edit mode carries a list, task or quote on to the next line, as Edit always
  // has; on an item with nothing after its marker it ends the list instead.
  function continueMarkdownLine() {
    if (state.editorMode !== 'edit' || state.view !== 'live') return false;
    const editor = el.markdownEditor;
    const start = editor.selectionStart;
    if (start !== editor.selectionEnd) return false;
    const value = editor.value;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEndIndex = value.indexOf('\n', start);
    const line = value.slice(lineStart, lineEndIndex === -1 ? value.length : lineEndIndex);
    const before = value.slice(lineStart, start);
    const prefix = markdownContinuationPrefix(before);
    if (!prefix) return false;

    const marker = line.match(/^(\s*[-+*]\s+\[[ xX]\]\s+|\s*[-+*]\s+|\s*\d+\.\s+|\s*>\s?)/)?.[1] || '';
    if (marker && line.trim() === marker.trim()) {
      editor.setRangeText('', lineStart, lineStart + line.length, 'start');
    } else {
      editor.setRangeText(`\n${prefix}`, start, start, 'end');
    }
    handleSourceInput();
    return true;
  }

  // The user changed the Source text (or code here changed it and announces it).
  function handleSourceInput() {
    if (state.editorMode !== 'edit') return;
    const note = selectedNote();
    if (!note) return;

    const content = ensureTrailingBlankLine(el.markdownEditor.value);
    if (content !== el.markdownEditor.value) el.markdownEditor.value = content;

    note.content = content;
    note.updatedAt = Date.now();
    scheduleSave(note);
    schedulePreview();
    updateDocumentStats();
    dispatchDocumentChange();
  }

  function bindEvents() {
    el.previewPane.addEventListener('click', handlePreviewClick);
    el.previewPane.addEventListener('change', handlePreviewChange);

    el.formatToolbar.addEventListener('mousedown', event => {
      if (event.target.closest('button')) event.preventDefault();
    });
    el.formatToolbar.addEventListener('click', event => {
      if (state.editorMode !== 'edit') return;
      const button = event.target.closest('button[data-format]');
      if (button) applyFormatting(button.dataset.format);
    });

    el.attachButton.addEventListener('click', () => {
      if (state.editorMode === 'edit' && !state.attachmentBusy) el.attachInput.click();
    });
    el.attachInput.addEventListener('change', async event => {
      if (state.editorMode === 'edit') await insertFiles([...event.target.files], 'picker');
      event.target.value = '';
    });

    el.viewButtons.forEach(button => {
      button.addEventListener('click', () => applyWorkspaceMode(button.dataset.workspaceMode));
    });

    el.compareUseAll.addEventListener('click', useAllOfCompare);
    el.compareDone.addEventListener('click', () => finishCompare('done'));
    el.changesClose.addEventListener('click', () => hideChanges('done'));
    el.changesToggle.addEventListener('click', toggleChanges);
    el.changesPrevious.addEventListener('click', () => goToChange(-1));
    el.changesNext.addEventListener('click', () => goToChange(1));
    el.changesPreview.addEventListener('click', handlePreviewClick);
    el.fillForm.addEventListener('click', handlePreviewClick);
    el.fillForm.addEventListener('input', handleFillInput);
    el.fillForm.addEventListener('change', handleFillInput);
    el.fillSubmit.addEventListener('click', submitFill);
    el.fillClose.addEventListener('click', () => endFill('done'));
    el.outlineToggle.addEventListener('click', () => applyOutlineVisibility(!state.outlineOpen));
    el.outlineClose.addEventListener('click', () => applyOutlineVisibility(false));
    el.outlineNavigation.addEventListener('click', handleOutlineNavigationClick);

    mountRoot.addEventListener('keydown', handleGlobalKeydown);
    window.addEventListener('beforeunload', flushPendingSave);
    mountRoot.addEventListener('dragenter', handleDragEnter);
    mountRoot.addEventListener('dragover', handleDragOver);
    mountRoot.addEventListener('dragleave', handleDragLeave);
    mountRoot.addEventListener('drop', handleDrop);
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      let request;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (error) {
        state.usingMemoryStorage = true;
        resolve(null);
        return;
      }

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(NODE_STORE)) {
          db.createObjectStore(NODE_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(ATTACHMENT_STORE)) {
          db.createObjectStore(ATTACHMENT_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('Persistent browser storage is unavailable; using memory storage for this session.', request.error);
        state.usingMemoryStorage = true;
        resolve(null);
      };
      request.onblocked = () => reject(new Error('The editor database is open in another tab and cannot be upgraded.'));
    });
  }


  function transaction(storeName, mode = 'readonly') {
    if (!state.db) throw new Error('Persistent storage is unavailable.');
    return state.db.transaction(storeName, mode).objectStore(storeName);
  }


  function getRecord(storeName, id) {
    if (state.usingMemoryStorage || !state.db) {
      return Promise.resolve(state.memoryStores.get(storeName)?.get(id) || null);
    }
    return new Promise((resolve, reject) => {
      const request = transaction(storeName).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  function putRecord(storeName, record) {
    if (state.usingMemoryStorage || !state.db) {
      if (!state.memoryStores.has(storeName)) state.memoryStores.set(storeName, new Map());
      state.memoryStores.get(storeName).set(record.id, record);
      return Promise.resolve(record);
    }
    return new Promise((resolve, reject) => {
      const request = transaction(storeName, 'readwrite').put(record);
      request.onsuccess = () => resolve(record);
      request.onerror = () => reject(request.error);
    });
  }




  function uuid() {
    if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function selectedNode() {
    return state.nodes[0] || null;
  }


  function selectedNote() {
    return selectedNode();
  }

  function createDefaultDocument() {
    const now = Date.now();
    return {
      id: DOCUMENT_ID,
      type: 'document',
      content: ensureTrailingBlankLine(`# Slate Markdown Editor

This is a **reusable Markdown editor** with Obsidian-style Live Preview.

## Editing

- Use **Edit** for Obsidian-style Live Preview.
- Use **Preview** to view the rendered document without editing.
- Use **Source** to edit the complete raw Markdown.
- Drag or paste images, videos, and files into the editor.

## Video task

Use \`- [>] !video[Required training](url)\` for a locked watch-completion task.
`),
      createdAt: now,
      updatedAt: now,
    };
  }


  function ensureTrailingBlankLine(markdown) {
    const text = String(markdown ?? '').replace(/\r\n?/g, '\n');
    if (!text || text.endsWith('\n')) return text;
    return `${text}\n`;
  }

  function ensureTrailingLiveBlankBlock() {
    if (!el.previewPane) return null;
    const blocks = [...el.previewPane.querySelectorAll(':scope > .live-block')];
    const last = blocks.at(-1);
    if (last && (last.dataset.source || '') === '') return last;
    const trailing = createLiveBlock('');
    el.previewPane.appendChild(trailing);
    return trailing;
  }

















  function scheduleSave(note) {
    if (!state.persistDocument) {
      state.isSaving = false;
      el.saveStatus.textContent = 'Host controlled';
      return;
    }

    state.isSaving = true;
    el.saveStatus.textContent = 'Saving…';

    const existing = state.saveTimers.get(note.id);
    if (existing) clearTimeout(existing.timer);

    const snapshot = { ...note };
    const timer = setTimeout(async () => {
      state.saveTimers.delete(note.id);
      try {
        await putRecord(NODE_STORE, snapshot);
        state.isSaving = state.saveTimers.size > 0;
        el.saveStatus.textContent = state.isSaving ? 'Saving…' : 'Saved locally';
      } catch (error) {
        state.isSaving = state.saveTimers.size > 0;
        el.saveStatus.textContent = 'Save failed';
        showToast(`Could not save: ${error.message}`, true);
      }
    }, 350);

    state.saveTimers.set(note.id, { timer, snapshot });
  }

  async function flushPendingSave() {
    if (!state.persistDocument || !state.db || state.saveTimers.size === 0) return;
    const pending = [...state.saveTimers.values()];
    state.saveTimers.clear();
    pending.forEach(item => clearTimeout(item.timer));

    try {
      await Promise.all(pending.map(item => putRecord(NODE_STORE, item.snapshot)));
      state.isSaving = false;
      el.saveStatus.textContent = 'Saved locally';
    } catch (error) {
      state.isSaving = false;
      el.saveStatus.textContent = 'Save failed';
      console.error(error);
    }
  }

  // Preview is drawn only while it shows; Edit and Source are the CodeMirror editor.
  function schedulePreview() {
    clearTimeout(state.previewTimer);
    if (state.editorMode !== 'view') return;
    state.previewTimer = setTimeout(renderPreview, 120);
  }

  async function renderPreview() {
    const note = selectedNote();
    if (!note) return;

    destroyMediaPlayers(el.previewPane);
    const generation = ++state.liveRenderGeneration;
    const fragment = document.createDocumentFragment();

    const content = ensureTrailingBlankLine(note.content || '');
    splitMarkdownIntoLiveBlocks(content).forEach(source => {
      fragment.appendChild(createLiveBlock(source));
    });

    el.previewPane.replaceChildren(fragment);
    hydrateDiagrams(el.previewPane);
    ensureTrailingLiveBlankBlock();
    await hydrateAttachments();
    if (generation !== state.liveRenderGeneration) return;
    hydrateWikiLinks();
    await hydrateVideoPlayers();
    refreshLiveBlockLineIndexes();
    applyPreviewInteractivity();
    updateDocumentOutline();
  }


  function splitMarkdownIntoLiveBlocks(markdown) {
    const lines = String(markdown).replace(/\r\n?/g, '\n').split('\n');
    const blocks = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];

      if (/^\s*```/.test(line)) {
        const code = [line];
        index += 1;
        while (index < lines.length) {
          code.push(lines[index]);
          const isClosingFence = /^\s*```/.test(lines[index]);
          index += 1;
          if (isClosingFence) break;
        }
        blocks.push(code.join('\n'));
        continue;
      }

      // Front matter (--- … --- at the very start) is one block, hidden in Preview (see isFrontMatterBlock).
      if (index === 0 && line.trimEnd() === '---') {
        let end = 1;
        while (end < lines.length && lines[end].trimEnd() !== '---' && lines[end].trimEnd() !== '...') end += 1;
        if (end < lines.length) {
          blocks.push(lines.slice(0, end + 1).join('\n'));
          index = end + 1;
          continue;
        }
      }

      // An HTML comment over several lines is one block, hidden in Preview (see isCommentBlock).
      if (/^\s*<!--/.test(line) && !/^\s*<!--[\s\S]*?-->/.test(line)) {
        const comment = [line];
        index += 1;
        while (index < lines.length) {
          comment.push(lines[index]);
          const closes = lines[index].includes('-->');
          index += 1;
          if (closes) break;
        }
        blocks.push(comment.join('\n'));
        continue;
      }

      if (isTableStart(lines, index)) {
        const table = [lines[index], lines[index + 1]];
        index += 2;
        while (index < lines.length && lines[index].trim() && lines[index].includes('|')) {
          table.push(lines[index]);
          index += 1;
        }
        blocks.push(table.join('\n'));
        continue;
      }

      blocks.push(line);
      index += 1;
    }

    return blocks.length ? blocks : [''];
  }

  function createLiveBlock(source = '') {
    const block = document.createElement('div');
    block.className = 'live-block';
    block.dataset.source = String(source);
    block.dataset.placeholder = 'Start writing Markdown…';
    block.contentEditable = 'false';
    block.spellcheck = true;
    renderLiveBlock(block);
    return block;
  }

  function renderLiveBlock(block) {
    if (!block) return;
    const source = block.dataset.source ?? '';
    block.className = 'live-block is-rendered';
    block.contentEditable = 'false';
    block.spellcheck = true;
    block.dataset.liveMode = 'source-map';
    block.replaceChildren();

    if (source === '') {
      block.classList.add('is-empty');
      block.innerHTML = '<br>';
      return;
    }

    if (isFrontMatterBlock(source)) {
      block.classList.add('is-front-matter');
      block.dataset.liveMode = 'front-matter';
      return;
    }

    if (isCommentBlock(source)) {
      block.classList.add('is-comment');
      block.dataset.liveMode = 'comment';
      return;
    }

    if (renderSourcePreservingBlock(block, source)) return;

    block.dataset.liveMode = 'raw';
    block.innerHTML = renderMarkdown(source);
  }

  // HTML comments (<!-- … -->) are notes for whoever edits the file, such as a template's
  // instructions: Preview hides them, as GitHub and Obsidian do; Edit and Source show them.
  function isCommentBlock(source) {
    return /^\s*<!--/.test(source) && !stripComments(source).trim();
  }

  // Front matter holds settings for tools (a form's title, a policy's version), not reading:
  // Preview hides it like a comment. Only the splitter makes a block of several lines that
  // starts with ---, and only at the top of the document.
  function isFrontMatterBlock(source) {
    return /^---[ \t]*\n[\s\S]*\n(?:---|\.\.\.)[ \t]*$/.test(source);
  }

  /** The text without its HTML comments (an unclosed one runs to the end). */
  function stripComments(text) {
    return String(text).replace(/<!--[\s\S]*?(?:-->|$)/g, '');
  }

  function renderSourcePreservingBlock(block, source) {
    if (source.includes('\n')) return false;

    const video = parseStandaloneVideo(source);
    if (video) {
      renderLiveVideoBlock(block, source, video);
      return true;
    }

    const image = parseStandaloneImage(source);
    if (image) {
      renderLiveImageBlock(block, source, image);
      return true;
    }

    const heading = source.match(/^(#{1,6})(\s+)(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const headingElement = document.createElement(`h${level}`);
      headingElement.className = 'live-heading md-element md-block-element';
      setMarkdownRange(headingElement, 'heading', 0, source.length, heading[1].length + heading[2].length, source.length);
      headingElement.appendChild(createMarkdownMarker(heading[1] + heading[2]));
      appendInlineSource(headingElement, heading[3], heading[1].length + heading[2].length);
      block.appendChild(headingElement);
      return true;
    }

    const task = source.match(/^(\s*[-+*]\s+)\[([ xX])\](\s+)(.*)$/);
    if (task) {
      const prefix = `${task[1]}[${task[2]}]${task[3]}`;
      const row = document.createElement('div');
      row.className = 'live-task-line md-element md-block-element';
      setMarkdownRange(row, 'task', 0, source.length, prefix.length, source.length);

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'task-checkbox';
      checkbox.checked = task[2].toLowerCase() === 'x';
      checkbox.contentEditable = 'false';
      checkbox.dataset.sourceIgnore = 'true';
      row.appendChild(checkbox);
      row.appendChild(createMarkdownMarker(prefix));

      const content = document.createElement('span');
      content.className = 'live-line-content';
      appendInlineSource(content, task[4], prefix.length);
      row.appendChild(content);
      block.appendChild(row);
      return true;
    }

    const list = source.match(/^(\s*)((?:[-+*])|(?:\d+\.))(\s+)(.*)$/);
    if (list) {
      const prefix = `${list[1]}${list[2]}${list[3]}`;
      const row = document.createElement('div');
      row.className = `live-list-line ${/\d+\./.test(list[2]) ? 'ordered' : 'unordered'} md-element md-block-element`;
      row.dataset.renderedMarker = /\d+\./.test(list[2]) ? list[2] : '•';
      setMarkdownRange(row, 'list', 0, source.length, prefix.length, source.length);
      row.appendChild(createMarkdownMarker(prefix));

      const content = document.createElement('span');
      content.className = 'live-line-content';
      appendInlineSource(content, list[4], prefix.length);
      row.appendChild(content);
      block.appendChild(row);
      return true;
    }

    const quote = source.match(/^(\s*>\s?)(.*)$/);
    if (quote) {
      const row = document.createElement('blockquote');
      row.className = 'live-quote-line md-element md-block-element';
      setMarkdownRange(row, 'quote', 0, source.length, quote[1].length, source.length);
      row.appendChild(createMarkdownMarker(quote[1]));
      const content = document.createElement('span');
      content.className = 'live-line-content';
      appendInlineSource(content, quote[2], quote[1].length);
      row.appendChild(content);
      block.appendChild(row);
      return true;
    }

    if (/^\s*((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})\s*$/.test(source)) {
      block.dataset.liveMode = 'raw';
      block.innerHTML = '<hr>';
      return true;
    }

    const paragraph = document.createElement('p');
    paragraph.className = 'live-paragraph';
    appendInlineSource(paragraph, source, 0);
    block.appendChild(paragraph);
    return true;
  }

  function setMarkdownRange(element, kind, start, end, contentStart, contentEnd) {
    element.classList.add('md-element');
    element.dataset.mdElement = kind;
    element.dataset.mdStart = String(start);
    element.dataset.mdEnd = String(end);
    element.dataset.mdContentStart = String(contentStart);
    element.dataset.mdContentEnd = String(contentEnd);
  }

  function createMarkdownMarker(text) {
    const marker = document.createElement('span');
    marker.className = 'md-marker';
    marker.textContent = text;
    marker.setAttribute('aria-hidden', 'true');
    return marker;
  }

  function createEditableTextNode(text) {
    // Rendered text keeps a trailing space visible as NBSP.
    return document.createTextNode(String(text).replace(/ +$/g, spaces => '\u00a0'.repeat(spaces.length)));
  }

  function appendInlineSource(parent, source, baseOffset = 0) {
    let cursor = 0;
    while (cursor < source.length) {
      const token = readInlineToken(source, cursor, baseOffset);
      if (token) {
        parent.appendChild(token.node);
        cursor = token.end;
        continue;
      }

      let next = cursor + 1;
      while (next < source.length && !isInlineTokenStart(source, next)) next += 1;
      parent.appendChild(createEditableTextNode(source.slice(cursor, next)));
      cursor = next;
    }

    if (parent.lastElementChild?.classList.contains('md-inline-element') && parent.lastChild === parent.lastElementChild) {
      parent.appendChild(document.createTextNode('\u200B'));
    }
  }

  let insideLink = 0;

  function isInlineTokenStart(source, index) {
    const char = source[index];
    return (char === '<' && source.startsWith('<!--', index)) || (char === '<' && /^<\/?[a-z]+\s*\/?>/i.test(source.slice(index, index + 64))) || char === '`' || char === '*' || char === '_' || char === '~' || char === '[' || char === '!'
      || (char === '<' && /^<(?:https?|mailto):[^\s<>]+>/i.test(source.slice(index, index + 2048)))
      || bareUrlAt(source, index) !== null;
  }

  /** A bare web address starting at `index` (after a space, a bracket or emphasis), less trailing punctuation. */
  function bareUrlAt(source, index) {
    const char = source[index];
    if (insideLink || (char !== 'h' && char !== 'H' && char !== 'w' && char !== 'W')) return null;
    if (index > 0 && !/[\s(*_~]/.test(source[index - 1])) return null;
    const match = source.slice(index, index + 2048).match(/^(?:https?:\/\/|www\.)[^\s<>]+/i);
    if (!match) return null;
    const [url] = splitBareUrl(match[0]);
    return /^(?:https?:\/\/|www\.)[^/?#]/i.test(url) && !/^www\.$/i.test(url) ? url : null;
  }

  function createLinkElement(safe) {
    const wrapper = document.createElement('a');
    wrapper.className = 'md-inline-element';
    wrapper.href = displayUrl(safe, 'link');
    wrapper.dataset.mdUrl = safe;
    if (isWebUrl(safe)) wrapper.classList.add('external-link');
    wrapper.target = '_blank';
    wrapper.rel = 'noopener noreferrer';
    return wrapper;
  }

  function readInlineToken(source, index, baseOffset) {
    const rest = source.slice(index);

    // A comment inside a line is kept as a marker: hidden in Preview, like a whole-line one.
    if (rest.startsWith('<!--')) {
      const close = source.indexOf('-->', index + 4);
      const end = close === -1 ? source.length : close + 3;
      return { node: createMarkdownMarker(source.slice(index, end)), end };
    }

    // A few plain HTML tags (see INLINE_HTML_TAGS): <br>, or a tag with its closing tag later in the line.
    const html = rest.match(/^<(\/?)([a-z]+)\s*(\/?)>/i);
    if (html && !html[1]) {
      const tag = html[2].toLowerCase();
      if (tag === 'br' || tag === 'wbr') {
        const wrapper = document.createElement('span');
        wrapper.className = 'md-inline-element';
        setMarkdownRange(wrapper, 'html', baseOffset + index, baseOffset + index + html[0].length, baseOffset + index, baseOffset + index);
        wrapper.appendChild(createMarkdownMarker(html[0]));
        wrapper.appendChild(document.createElement(tag));
        return { node: wrapper, end: index + html[0].length };
      }
      const closing = !html[3] && INLINE_HTML_TAGS.has(tag)
        ? new RegExp(`</${tag}\\s*>`, 'i').exec(source.slice(index + html[0].length))
        : null;
      if (closing) {
        const contentStart = index + html[0].length;
        const contentEnd = contentStart + closing.index;
        const wrapper = document.createElement(tag);
        wrapper.className = 'md-inline-element';
        setMarkdownRange(wrapper, 'html', baseOffset + index, baseOffset + contentEnd + closing[0].length, baseOffset + contentStart, baseOffset + contentEnd);
        wrapper.appendChild(createMarkdownMarker(html[0]));
        appendInlineSource(wrapper, source.slice(contentStart, contentEnd), baseOffset + contentStart);
        wrapper.appendChild(createMarkdownMarker(closing[0]));
        return { node: wrapper, end: contentEnd + closing[0].length };
      }
    }

    const image = rest.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/);
    if (image) {
      const full = image[0];
      const wrapper = document.createElement('span');
      wrapper.className = 'md-inline-element live-inline-image';
      const contentStart = baseOffset + index + 2;
      const contentEnd = contentStart + image[1].length;
      setMarkdownRange(wrapper, 'image', baseOffset + index, baseOffset + index + full.length, contentStart, contentEnd);
      wrapper.appendChild(createMarkdownMarker(full));
      const imageElement = createRenderedImage(image[1], image[2], image[3] || '');
      imageElement.contentEditable = 'false';
      imageElement.dataset.sourceIgnore = 'true';
      wrapper.appendChild(imageElement);
      return { node: wrapper, end: index + full.length };
    }

    if (rest.startsWith('[[')) {
      const close = source.indexOf(']]', index + 2);
      if (close !== -1) {
        const inner = source.slice(index + 2, close);
        const pipe = inner.indexOf('|');
        const rawTarget = pipe === -1 ? inner : inner.slice(0, pipe);
        const noteName = rawTarget.trim();
        const display = pipe === -1 ? inner : inner.slice(pipe + 1);
        const wrapper = document.createElement('a');
        wrapper.href = '#';
        wrapper.className = 'wiki-link md-inline-element';
        wrapper.dataset.noteName = noteName;
        setMarkdownRange(wrapper, 'wikilink', baseOffset + index, baseOffset + close + 2, baseOffset + index + 2, baseOffset + close);
        wrapper.appendChild(createMarkdownMarker(pipe === -1 ? '[[' : `[[${inner.slice(0, pipe + 1)}`));
        wrapper.appendChild(createEditableTextNode(display));
        wrapper.appendChild(createMarkdownMarker(']]'));
        return { node: wrapper, end: close + 2 };
      }
    }

    if (rest.startsWith('[')) {
      const match = rest.match(/^\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/);
      if (match) {
        const full = match[0];
        const wrapper = document.createElement('a');
        const url = match[2];
        wrapper.className = 'md-inline-element';
        if (isAttachmentUrl(url)) {
          wrapper.classList.add('attachment-link');
          wrapper.dataset.attachmentId = attachmentIdFromUrl(url);
          wrapper.href = '#';
        } else {
          const safe = safeUrl(url, false);
          wrapper.href = safe ? displayUrl(safe, 'link') : '#';
          if (safe) wrapper.dataset.mdUrl = safe;
          if (isWebUrl(safe)) wrapper.classList.add('external-link');
          wrapper.target = '_blank';
          wrapper.rel = 'noopener noreferrer';
        }
        if (match[3]) wrapper.title = match[3];
        setMarkdownRange(wrapper, 'link', baseOffset + index, baseOffset + index + full.length, baseOffset + index + 1, baseOffset + index + 1 + match[1].length);
        wrapper.appendChild(createMarkdownMarker('['));
        // A web address in a link's text is just text (no link inside a link).
        insideLink += 1;
        try { appendInlineSource(wrapper, match[1], baseOffset + index + 1); } finally { insideLink -= 1; }
        wrapper.appendChild(createMarkdownMarker(full.slice(match[1].length + 1)));
        return { node: wrapper, end: index + full.length };
      }
    }

    // Autolinks: <https://…> and bare web addresses, as on GitHub.
    const angle = insideLink ? null : rest.match(/^<((?:https?|mailto):[^\s<>]+)>/i);
    const bare = angle ? null : bareUrlAt(source, index);
    if (angle || bare) {
      const text = angle ? angle[1] : bare;
      const full = angle ? angle[0] : bare;
      const safe = safeUrl(/^www\./i.test(text) ? `http://${text}` : text, false);
      if (safe) {
        const wrapper = createLinkElement(safe);
        const contentStart = baseOffset + index + (angle ? 1 : 0);
        setMarkdownRange(wrapper, 'link', baseOffset + index, baseOffset + index + full.length, contentStart, contentStart + text.length);
        if (angle) wrapper.appendChild(createMarkdownMarker('<'));
        wrapper.appendChild(createEditableTextNode(text));
        if (angle) wrapper.appendChild(createMarkdownMarker('>'));
        return { node: wrapper, end: index + full.length };
      }
    }

    if (rest.startsWith('`')) {
      const close = source.indexOf('`', index + 1);
      if (close !== -1) {
        const wrapper = document.createElement('code');
        wrapper.className = 'md-inline-element';
        setMarkdownRange(wrapper, 'code', baseOffset + index, baseOffset + close + 1, baseOffset + index + 1, baseOffset + close);
        wrapper.appendChild(createMarkdownMarker('`'));
        wrapper.appendChild(createEditableTextNode(source.slice(index + 1, close)));
        wrapper.appendChild(createMarkdownMarker('`'));
        return { node: wrapper, end: close + 1 };
      }
    }

    // A long run (a form's ______ blank, a **** divider) is text, not empty emphasis.
    const runChar = rest[0];
    if (runChar === '_' || runChar === '*' || runChar === '~') {
      let run = 1;
      while (rest[run] === runChar) run += 1;
      if (run >= (runChar === '*' ? 4 : 3)) return { node: createEditableTextNode(rest.slice(0, run)), end: index + run };
    }
    const emphasised = text => text.trim() !== '' && !/^\s|\s$/.test(text);

    for (const [delimiter, tagName, kind] of [['**', 'strong', 'bold'], ['__', 'strong', 'bold'], ['~~', 'del', 'strike']]) {
      if (!rest.startsWith(delimiter)) continue;
      const close = source.indexOf(delimiter, index + delimiter.length);
      if (close === -1 || !emphasised(source.slice(index + delimiter.length, close))) continue;
      const wrapper = document.createElement(tagName);
      wrapper.className = 'md-inline-element';
      setMarkdownRange(wrapper, kind, baseOffset + index, baseOffset + close + delimiter.length, baseOffset + index + delimiter.length, baseOffset + close);
      wrapper.appendChild(createMarkdownMarker(delimiter));
      appendInlineSource(wrapper, source.slice(index + delimiter.length, close), baseOffset + index + delimiter.length);
      wrapper.appendChild(createMarkdownMarker(delimiter));
      return { node: wrapper, end: close + delimiter.length };
    }

    for (const [delimiter, tagName, kind] of [['*', 'em', 'italic'], ['_', 'em', 'italic']]) {
      if (!rest.startsWith(delimiter) || rest.startsWith(delimiter + delimiter)) continue;
      const close = source.indexOf(delimiter, index + 1);
      if (close === -1 || !emphasised(source.slice(index + 1, close))) continue;
      const wrapper = document.createElement(tagName);
      wrapper.className = 'md-inline-element';
      setMarkdownRange(wrapper, kind, baseOffset + index, baseOffset + close + 1, baseOffset + index + 1, baseOffset + close);
      wrapper.appendChild(createMarkdownMarker(delimiter));
      appendInlineSource(wrapper, source.slice(index + 1, close), baseOffset + index + 1);
      wrapper.appendChild(createMarkdownMarker(delimiter));
      return { node: wrapper, end: close + 1 };
    }

    return null;
  }

  function parseStandaloneVideo(source) {
    const taskMatch = String(source).match(/^(\s*[-+*]\s+)\[([>xX])\](\s+)(!video\[[^\]]*\]\([^\n]+\))\s*$/);
    const videoSource = taskMatch ? taskMatch[4] : String(source).trim();
    const match = videoSource.match(/^!video\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/i);
    if (!match) return null;

    return {
      label: match[1] || 'Video',
      target: match[2],
      title: match[3] || '',
      task: taskMatch ? {
        prefix: taskMatch[1],
        marker: taskMatch[2].toLowerCase(),
        spacing: taskMatch[3],
      } : null,
    };
  }


  function videoTargetInfo(target) {
    const raw = String(target || '').trim();
    if (isAttachmentUrl(raw)) {
      return { provider: 'html5', attachmentId: attachmentIdFromUrl(raw), src: '' };
    }

    const remote = safeRemoteUrl(raw);
    if (!remote) return { provider: 'invalid', src: '' };

    const youtubeId = youtubeVideoId(remote);
    if (youtubeId) {
      const parameters = new URLSearchParams({ enablejsapi: '1', playsinline: '1', rel: '0' });
      if (/^https?:$/i.test(location.protocol)) parameters.set('origin', location.origin);
      return {
        provider: 'youtube',
        id: youtubeId,
        src: `https://www.youtube.com/embed/${encodeURIComponent(youtubeId)}?${parameters}`,
      };
    }

    const vimeoId = vimeoVideoId(remote);
    if (vimeoId) {
      return {
        provider: 'vimeo',
        id: vimeoId,
        src: `https://player.vimeo.com/video/${encodeURIComponent(vimeoId)}?dnt=1`,
      };
    }

    const loomId = loomVideoId(remote);
    if (loomId) {
      return {
        provider: 'generic',
        name: 'Loom',
        src: `https://www.loom.com/embed/${encodeURIComponent(loomId)}`,
      };
    }

    if (/\.(mp4|m4v|webm|ogv|ogg|mov)(?:$|[?#])/i.test(remote)) {
      return { provider: 'html5', src: remote };
    }

    return { provider: 'generic', name: 'embedded provider', src: remote };
  }

  function safeRemoteUrl(url) {
    try {
      const parsed = new URL(String(url).trim(), location.href);
      return /^(https?):$/i.test(parsed.protocol) ? parsed.href : '';
    } catch {
      return '';
    }
  }

  function youtubeVideoId(url) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
      if (host === 'youtu.be') return sanitiseVideoId(parsed.pathname.split('/').filter(Boolean)[0]);
      if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) return '';
      if (parsed.pathname === '/watch') return sanitiseVideoId(parsed.searchParams.get('v'));
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'live'].includes(segments[0])) return sanitiseVideoId(segments[1]);
    } catch {
      return '';
    }
    return '';
  }

  function vimeoVideoId(url) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
      if (!['vimeo.com', 'player.vimeo.com'].includes(host)) return '';
      const segments = parsed.pathname.split('/').filter(Boolean);
      const candidate = host === 'player.vimeo.com' && segments[0] === 'video' ? segments[1] : [...segments].reverse().find(value => /^\d+$/.test(value));
      return /^\d+$/.test(candidate || '') ? candidate : '';
    } catch {
      return '';
    }
  }

  function loomVideoId(url) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
      if (host !== 'loom.com') return '';
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (!['share', 'embed'].includes(segments[0])) return '';
      return sanitiseVideoId(segments[1]);
    } catch {
      return '';
    }
  }

  function sanitiseVideoId(value) {
    const candidate = String(value || '').trim();
    return /^[A-Za-z0-9_-]{5,64}$/.test(candidate) ? candidate : '';
  }

  function renderLiveVideoBlock(block, source, videoData) {
    block.classList.add('is-video-block');
    block.contentEditable = 'false';

    const figure = document.createElement('figure');
    figure.className = 'live-media-figure live-video-figure';

    const sourceRow = document.createElement('div');
    sourceRow.className = 'media-source-row video-source-row';
    const sourceEditor = document.createElement('span');
    sourceEditor.className = 'media-source-editor video-source-editor';
    sourceEditor.textContent = source;
    sourceEditor.contentEditable = 'false';
    sourceEditor.spellcheck = false;
    sourceRow.appendChild(sourceEditor);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'media-source-toggle video-source-toggle';
    toggle.title = 'Edit video Markdown';
    toggle.setAttribute('aria-label', 'Edit video Markdown');
    toggle.dataset.sourceIgnore = 'true';

    const frame = document.createElement('div');
    frame.className = 'live-media-frame live-video-frame';
    frame.dataset.sourceIgnore = 'true';

    const info = videoTargetInfo(videoData.target);
    frame.dataset.videoProvider = info.provider;
    frame.dataset.videoTarget = videoData.target;

    if (videoData.task) {
      const status = document.createElement('div');
      status.className = 'video-completion-status';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'video-completion-checkbox';
      checkbox.checked = videoData.task.marker === 'x';
      checkbox.disabled = true;
      checkbox.tabIndex = -1;
      checkbox.setAttribute('aria-label', checkbox.checked ? 'Video completed' : 'Completes automatically when video ends');
      const label = document.createElement('span');
      label.className = 'video-completion-label';
      label.textContent = videoData.label || 'Video';
      const note = document.createElement('span');
      note.className = 'video-completion-note';
      note.textContent = checkbox.checked ? 'Completed' : 'Locked · completes at the end';
      status.append(checkbox, label, note);
      figure.appendChild(status);
      block.classList.toggle('is-video-complete', checkbox.checked);
      block.dataset.videoTask = 'true';
    }

    if (info.provider === 'html5') {
      const video = document.createElement('video');
      video.className = 'embedded-video html5-video';
      video.controls = true;
      video.preload = 'metadata';
      video.playsInline = true;
      video.setAttribute('aria-label', videoData.label || 'Embedded video');
      if (info.attachmentId) video.dataset.attachmentId = info.attachmentId;
      else video.src = info.src;
      video.dataset.videoProvider = 'html5';
      frame.appendChild(video);
    } else if (info.provider === 'youtube') {
      const host = document.createElement('div');
      host.className = 'embedded-video video-iframe youtube-player-host';
      host.dataset.videoProvider = 'youtube';
      host.dataset.videoId = info.id;
      host.dataset.videoSrc = info.src;
      host.dataset.videoTitle = videoData.title || videoData.label || 'Embedded video';
      host.textContent = 'Loading YouTube player…';
      frame.appendChild(host);
    } else if (['vimeo', 'generic'].includes(info.provider)) {
      const iframe = document.createElement('iframe');
      iframe.className = 'embedded-video video-iframe';
      iframe.src = info.src;
      iframe.title = videoData.title || videoData.label || 'Embedded video';
      iframe.loading = 'lazy';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.dataset.videoProvider = info.provider;
      if (info.id) iframe.dataset.videoId = info.id;
      frame.appendChild(iframe);
    } else {
      const error = document.createElement('div');
      error.className = 'broken-attachment video-error';
      error.textContent = 'Blocked or invalid video target';
      frame.appendChild(error);
    }

    frame.appendChild(toggle);
    figure.append(sourceRow, frame);
    block.appendChild(figure);
  }

  function hydrateVideoPlayers(root = el.previewPane) {
    const blocks = [
      ...(root.matches?.('.live-block.is-video-block') ? [root] : []),
      ...root.querySelectorAll('.live-block.is-video-block'),
    ];
    blocks.forEach(block => {
      const playerElement = block.querySelector('[data-video-provider]');
      const provider = playerElement?.dataset.videoProvider || block.querySelector('.live-video-frame')?.dataset.videoProvider;
      if (!provider || provider === 'invalid') return;
      const tracker = createPlaybackTracker(block);

      if (provider === 'html5') {
        const video = block.querySelector('video.embedded-video');
        if (!video) return;
        video.addEventListener('timeupdate', () => tracker.observe(video.currentTime, video.duration, video.playbackRate));
        video.addEventListener('ended', () => {
          tracker.observe(video.currentTime, video.duration, video.playbackRate);
          tracker.finish({ naturalEnd: true });
        });
        return;
      }

      if (provider === 'youtube') {
        const host = block.querySelector('.youtube-player-host[data-video-provider="youtube"]');
        if (!host) return;
        loadYouTubeApi().then(YT => {
          if (!host.isConnected) return;
          let progressTimer = null;
          const stopProgress = () => {
            if (progressTimer !== null) clearInterval(progressTimer);
            progressTimer = null;
          };
          const sample = player => {
            try {
              tracker.observe(player.getCurrentTime(), player.getDuration(), player.getPlaybackRate?.() || 1);
            } catch (error) {
              console.debug('Could not sample YouTube playback', error);
            }
          };
          const playerVars = { playsinline: 1, rel: 0 };
          if (/^https?:$/i.test(location.protocol)) playerVars.origin = location.origin;

          const player = new YT.Player(host, {
            videoId: host.dataset.videoId,
            playerVars,
            events: {
              onReady: event => {
                const iframe = event.target.getIframe?.();
                if (iframe) {
                  iframe.classList.add('embedded-video', 'video-iframe');
                  iframe.title = host.dataset.videoTitle || 'Embedded video';
                  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
                }
              },
              onStateChange: event => {
                if (event.data === YT.PlayerState.PLAYING) {
                  sample(event.target);
                  if (progressTimer === null) progressTimer = setInterval(() => sample(event.target), 400);
                  return;
                }

                sample(event.target);
                stopProgress();
                if (event.data === YT.PlayerState.ENDED) tracker.finish({ naturalEnd: true });
              },
            },
          });
          registerMediaPlayer(block, () => {
            stopProgress();
            player.destroy?.();
          });
        }).catch(error => {
          console.warn('YouTube completion tracking unavailable:', error);
          const currentHost = block.querySelector('.youtube-player-host[data-video-provider="youtube"]');
          if (currentHost?.isConnected) {
            const fallback = document.createElement('iframe');
            fallback.className = 'embedded-video video-iframe';
            fallback.src = currentHost.dataset.videoSrc || '';
            fallback.title = currentHost.dataset.videoTitle || 'Embedded video';
            fallback.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
            fallback.allowFullscreen = true;
            fallback.referrerPolicy = 'strict-origin-when-cross-origin';
            currentHost.replaceWith(fallback);
          }
          markVideoTrackingUnavailable(block, 'YouTube completion tracking could not initialise, but the fallback player remains available.');
        });
        return;
      }

      if (provider === 'vimeo') {
        const iframe = block.querySelector('iframe[data-video-provider="vimeo"]');
        if (!iframe) return;
        loadVimeoApi().then(Vimeo => {
          if (!iframe.isConnected) return;
          const player = new Vimeo.Player(iframe);
          player.on('timeupdate', data => tracker.observe(data.seconds, data.duration, 1));
          player.on('ended', data => {
            if (data) tracker.observe(data.seconds, data.duration, 1);
            tracker.finish({ naturalEnd: true });
          });
          registerMediaPlayer(block, () => player.destroy?.());
        }).catch(error => {
          console.warn('Vimeo completion tracking unavailable:', error);
          markVideoTrackingUnavailable(block, 'Vimeo completion tracking is unavailable while its player API cannot load.');
        });
        return;
      }

      if (provider === 'generic') {
        markVideoTrackingUnavailable(block, 'This provider can be embedded, but it does not expose a supported completion event.');
      }
    });
  }

  function createPlaybackTracker(block) {
    const naturalEndGraceSeconds = 1.5;
    let lastTime = 0;
    let lastObservedAt = performance.now();
    let watchedSeconds = 0;
    let duration = 0;

    return {
      observe(currentTime, reportedDuration, playbackRate = 1) {
        const current = Number(currentTime);
        const nextDuration = Number(reportedDuration);
        const rate = Math.max(0.25, Number(playbackRate) || 1);
        const observedAt = performance.now();
        if (Number.isFinite(nextDuration) && nextDuration > 0) duration = nextDuration;
        if (!Number.isFinite(current) || current < 0) return;

        const delta = current - lastTime;
        const wallSeconds = Math.max(0, (observedAt - lastObservedAt) / 1000);
        // Allow delayed samples (for example, a throttled background timer), but
        // still reject an instantaneous seek that jumps well ahead of real time.
        const maximumContinuousStep = Math.max(5, rate * (wallSeconds + 1.5));
        if (delta >= 0 && delta <= maximumContinuousStep) watchedSeconds += delta;
        lastTime = current;
        lastObservedAt = observedAt;
        if (duration > 0) watchedSeconds = Math.min(watchedSeconds, duration);
      },
      finish({ naturalEnd = false } = {}) {
        if (block.dataset.videoTask !== 'true' || block.classList.contains('is-video-complete')) return;
        const completedRatio = duration > 0 ? watchedSeconds / duration : 1;
        const watchedToNaturalEnd = naturalEnd
          && duration > 0
          && watchedSeconds >= Math.max(0, duration - naturalEndGraceSeconds);
        if (completedRatio >= 0.95 || watchedToNaturalEnd) {
          markVideoTaskComplete(block);
        } else {
          markVideoPlaybackIncomplete(block, completedRatio);
        }
      },
    };
  }

  function markVideoPlaybackIncomplete(block, completedRatio) {
    if (!block?.isConnected || block.dataset.videoTask !== 'true') return;
    const percentage = Math.max(0, Math.min(99, Math.round(completedRatio * 100)));
    const note = block.querySelector('.video-completion-note');
    if (note) note.textContent = `Locked · ${percentage}% played without skipping`;
    showToast('Video not checked — play it through without skipping', true);
  }

  function registerMediaPlayer(block, destroy) {
    state.mediaPlayers.push({ block, destroy });
  }

  function destroyMediaPlayers(root = null) {
    const remaining = [];
    for (const record of state.mediaPlayers) {
      if (root && record.block !== root && !root.contains?.(record.block)) {
        remaining.push(record);
        continue;
      }
      try { record.destroy?.(); } catch (error) { console.debug('Could not destroy media player', error); }
    }
    state.mediaPlayers = root ? remaining : [];
  }

  function markVideoTrackingUnavailable(block, message) {
    if (!block?.dataset.videoTask || block.classList.contains('is-video-complete')) return;
    const note = block.querySelector('.video-completion-note');
    if (note) note.textContent = 'Locked · completion tracking unavailable';
    const status = block.querySelector('.video-completion-status');
    if (status) status.title = message;
  }

  function markVideoTaskComplete(block) {
    if (!block?.isConnected || block.dataset.videoTask !== 'true') return;
    const source = block.dataset.source || '';
    if (!/^(\s*[-+*]\s+)\[>\]/.test(source)) return;

    if (el.markdownEditor.dom.contains(block)) {
      // A video in Edit mode: tick its line in the editor, which redraws the block.
      const view = el.markdownEditor.view;
      const line = view.state.doc.lineAt(view.posAtDOM(block));
      const prefix = line.text.match(/^(\s*[-+*]\s+)\[>\]/)?.[1];
      if (prefix === undefined) return;
      const at = line.from + prefix.length;
      view.dispatch({ changes: { from: at, to: at + 3, insert: '[x]' }, userEvent: 'input.video-complete' });
      showToast('Video completed — task checked');
      return;
    }

    destroyMediaPlayers(block);
    block.dataset.source = source.replace(/^(\s*[-+*]\s+)\[>\]/, '$1[x]');
    renderLiveBlock(block);
    hydrateAttachments(block).then(() => hydrateVideoPlayers(block));
    persistRenderedDocument();
    showToast('Video completed — task checked');
  }

  function loadExternalScript(url, readyTest) {
    if (readyTest?.()) return Promise.resolve();
    if (externalScriptPromises.has(url)) return externalScriptPromises.get(url);

    const promise = new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(script => script.src === url);
      const script = existing || document.createElement('script');
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        readyTest?.() ? resolve() : reject(new Error(`Loaded ${url}, but its API was not available.`));
      };
      script.addEventListener('load', finish, { once: true });
      script.addEventListener('error', () => reject(new Error(`Could not load ${url}`)), { once: true });
      if (!existing) {
        script.src = url;
        script.async = true;
        document.head.appendChild(script);
      }
      setTimeout(() => {
        if (readyTest?.()) resolve();
        else if (!settled) reject(new Error(`Timed out loading ${url}`));
      }, 15000);
    });

    externalScriptPromises.set(url, promise);
    return promise;
  }

  function loadYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    const key = 'youtube-iframe-api';
    if (externalScriptPromises.has(key)) return externalScriptPromises.get(key);

    const promise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      const timeout = setTimeout(() => reject(new Error('Timed out loading the YouTube IFrame API.')), 15000);
      window.onYouTubeIframeAPIReady = () => {
        try { previous?.(); } catch (error) { console.debug(error); }
        clearTimeout(timeout);
        if (window.YT?.Player) resolve(window.YT);
        else reject(new Error('YouTube IFrame API did not initialise.'));
      };

      const existing = [...document.scripts].some(script => script.src.includes('youtube.com/iframe_api'));
      if (!existing) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Could not load the YouTube IFrame API.'));
        };
        document.head.appendChild(script);
      }
    });

    externalScriptPromises.set(key, promise);
    return promise;
  }

  async function loadVimeoApi() {
    await loadExternalScript('https://player.vimeo.com/api/player.js', () => Boolean(window.Vimeo?.Player));
    return window.Vimeo;
  }

  function parseStandaloneImage(source) {
    const match = source.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/);
    if (!match) return null;
    return { alt: match[1], url: match[2], title: match[3] || '' };
  }

  function createRenderedImage(alt, url, title = '') {
    const image = document.createElement('img');
    image.alt = alt;
    if (title) image.title = title;
    if (isAttachmentUrl(url)) {
      image.dataset.attachmentId = attachmentIdFromUrl(url);
    } else {
      const safe = safeUrl(url, true);
      if (safe) {
        image.src = displayUrl(safe, 'image');
        image.dataset.mdUrl = safe;
      } else image.classList.add('blocked-image');
    }
    return image;
  }

  function renderLiveImageBlock(block, source, imageData) {
    block.classList.add('is-image-block');
    block.contentEditable = 'false';

    const figure = document.createElement('figure');
    figure.className = 'live-media-figure live-image-figure';

    const sourceRow = document.createElement('div');
    sourceRow.className = 'media-source-row image-source-row';
    const sourceEditor = document.createElement('span');
    sourceEditor.className = 'media-source-editor image-source-editor';
    sourceEditor.textContent = source;
    sourceEditor.contentEditable = 'false';
    sourceEditor.spellcheck = false;
    sourceRow.appendChild(sourceEditor);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'media-source-toggle image-source-toggle';
    toggle.title = 'Edit image Markdown';
    toggle.setAttribute('aria-label', 'Edit image Markdown');
    toggle.dataset.sourceIgnore = 'true';

    const image = createRenderedImage(imageData.alt, imageData.url, imageData.title);
    image.contentEditable = 'false';
    image.dataset.sourceIgnore = 'true';

    const frame = document.createElement('div');
    frame.className = 'live-media-frame live-image-frame';
    frame.append(toggle, image);
    figure.append(sourceRow, frame);
    block.appendChild(figure);
  }

  // ---- Edit mode (CodeMirror live preview, src/live-preview.js) ----------------------

  // The lines Edit draws as blocks, found the way Preview splits blocks: tables, and lines
  // holding only an image or a video (outside fenced code).
  function detectLiveBlocks(markdown) {
    const lines = markdown.split('\n');
    const blocks = [];
    let inFence = false;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!inFence && /^\s*```/.test(line) && diagramLanguage(line.trim().slice(3))) {
        // A diagram, drawn as a block up to its closing fence (an unclosed one stays code).
        let last = index + 1;
        while (last < lines.length && !/^\s*```/.test(lines[last])) last += 1;
        if (last < lines.length) {
          blocks.push({ type: 'diagram', fromLine: index, toLine: last, source: lines.slice(index, last + 1).join('\n') });
          index = last;
          continue;
        }
      }
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;

      if (isTableStart(lines, index)) {
        let last = index + 1;
        while (last + 1 < lines.length && lines[last + 1].trim() && lines[last + 1].includes('|')) last += 1;
        blocks.push({ type: 'table', fromLine: index, toLine: last, source: lines.slice(index, last + 1).join('\n') });
        index = last;
        continue;
      }
      if (parseStandaloneVideo(line)) blocks.push({ type: 'video', fromLine: index, toLine: index, source: line });
      else if (parseStandaloneImage(line)) blocks.push({ type: 'image', fromLine: index, toLine: index, source: line });
    }
    return blocks;
  }

  function renderLiveWidget(block) {
    const element = document.createElement('div');
    element.className = 'live-block is-rendered';
    element.dataset.source = block.source;
    if (block.type === 'table') {
      element.classList.add('cm-slate-table', 'markdown-body');
      element.innerHTML = renderMarkdown(block.source);
    } else if (block.type === 'diagram') {
      element.classList.add('cm-slate-diagram');
      element.innerHTML = renderMarkdown(block.source);
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'media-source-toggle diagram-source-toggle';
      toggle.title = 'Edit the diagram source';
      toggle.setAttribute('aria-label', toggle.title);
      element.querySelector('.slate-diagram')?.prepend(toggle);
      hydrateDiagrams(element);
    } else if (block.type === 'video') {
      renderLiveVideoBlock(element, block.source, parseStandaloneVideo(block.source));
    } else {
      renderLiveImageBlock(element, block.source, parseStandaloneImage(block.source));
    }
    hydrateWikiLinks(element);
    hydrateAttachments(element).then(() => hydrateVideoPlayers(element));
    return element;
  }

  function renderInlineImageWidget(alt, url, title) {
    const wrapper = document.createElement('span');
    wrapper.className = 'live-inline-image';
    wrapper.appendChild(createRenderedImage(alt, url, title));
    hydrateAttachments(wrapper);
    return wrapper;
  }

  function liveLinkAttributes(url, title) {
    const attributes = {};
    if (title) attributes.title = title;
    if (isAttachmentUrl(url)) {
      attributes['data-attachment-id'] = attachmentIdFromUrl(url);
      attributes.href = '#';
      return attributes;
    }
    const safe = safeUrl(url, false);
    attributes.href = safe ? displayUrl(safe, 'link') : '#';
    if (safe) attributes['data-md-url'] = safe;
    attributes.target = '_blank';
    attributes.rel = 'noopener noreferrer';
    return attributes;
  }

  // ---- Diagrams (```mermaid) -------------------------------------------------------------
  // Drawn by Mermaid, which lives in mermaid/ next to slate.js and is loaded the first time a
  // document has a diagram. Until then (and if it can't load) the block shows its source.

  const DIAGRAM_LANGUAGES = new Set(['mermaid']);
  const diagramCache = new Map();
  let mermaidModule = null;
  let diagramCopies = 0;

  /** The diagram language of a code fence's info string ("mermaid"), or null for ordinary code. */
  function diagramLanguage(info) {
    const language = String(info || '').trim().split(/\s+/)[0].toLowerCase();
    return DIAGRAM_LANGUAGES.has(language) ? language : null;
  }

  function diagramHtml(language, code) {
    return `<div class="slate-diagram" data-diagram="${language}" data-diagram-source="${escapeAttribute(code)}">`
      + `<div class="slate-diagram-canvas"><pre class="slate-diagram-pending"><code>${escapeHtml(code)}</code></pre></div></div>`;
  }

  function diagramsUrl() {
    if (state.diagramsUrl) return state.diagramsUrl;
    try {
      return new URL('mermaid/mermaid.js', SCRIPT_URL || location.href).href;
    } catch {
      return 'mermaid/mermaid.js';
    }
  }

  function loadMermaid() {
    mermaidModule ??= import(/* webpackIgnore: true */ diagramsUrl()).catch(error => {
      mermaidModule = null;
      throw new Error(`Diagrams could not be loaded (${diagramsUrl()}): ${error.message || error}`);
    });
    return mermaidModule;
  }

  function diagramTheme() {
    const theme = mountHost?.dataset.theme;
    return theme === 'dark' || theme === 'paper' ? theme : 'light';
  }

  /** Draws the diagrams under `root` that aren't drawn yet (or were drawn for another theme). */
  async function hydrateDiagrams(root = el.previewPane) {
    const theme = diagramTheme();
    const elements = [...(root?.querySelectorAll('.slate-diagram') ?? [])].filter(element => element.dataset.renderedTheme !== theme);
    if (!elements.length) return;
    let mermaid;
    try {
      mermaid = await loadMermaid();
    } catch (error) {
      elements.forEach(element => showDiagramError(element, error.message));
      return;
    }
    for (const element of elements) {
      const source = element.dataset.diagramSource ?? '';
      const key = `${theme}\n${source}`;
      try {
        let drawn = diagramCache.get(key);
        if (!drawn) {
          drawn = await mermaid.render(source, theme);
          diagramCache.set(key, drawn);
          if (diagramCache.size > 60) diagramCache.delete(diagramCache.keys().next().value);
        }
        const canvas = element.querySelector('.slate-diagram-canvas');
        if (!canvas) continue;
        // Each copy gets its own id: the SVG's arrowheads and styles refer to it, and the same
        // diagram can show in Preview and Edit at once.
        diagramCopies += 1;
        canvas.innerHTML = drawn.svg.split(drawn.id).join(`${drawn.id}-${diagramCopies}`);
        element.classList.remove('has-error');
        element.dataset.renderedTheme = theme;
      } catch (error) {
        showDiagramError(element, error?.message || String(error));
      }
    }
  }

  function showDiagramError(element, text) {
    const canvas = element.querySelector('.slate-diagram-canvas');
    if (!canvas) return;
    element.classList.add('has-error');
    element.dataset.renderedTheme = diagramTheme();
    const message = document.createElement('div');
    message.className = 'slate-diagram-error';
    message.textContent = String(text).split('\n').slice(0, 6).join('\n');
    const code = document.createElement('pre');
    code.className = 'slate-diagram-pending';
    code.textContent = element.dataset.diagramSource ?? '';
    canvas.replaceChildren(message, code);
  }

  // ---- Printing ----------------------------------------------------------------------------
  // A printer can't see that a heading belongs with what follows it, so while the page prints,
  // Preview's blocks are grouped under their ## (and ### within it) headings. A group that would
  // spill onto the next page starts on a new one (slate.css), so no heading is left alone at the
  // bottom of a page. Afterwards the blocks go back as they were.

  function watchPrint() {
    window.addEventListener('beforeprint', groupForPrint);
    window.addEventListener('afterprint', ungroupAfterPrint);
  }

  function groupForPrint() {
    const pane = el.previewPane;
    if (!pane || pane.querySelector(':scope > .slate-print-section')) return;
    // Blank lines at the end would only push an empty last page out of the printer.
    for (let block = pane.lastElementChild; block?.classList.contains('is-empty'); block = block.previousElementSibling) {
      block.classList.add('slate-print-hidden');
    }
    let section = null;
    let subsection = null;
    for (const block of [...pane.children]) {
      const level = block.querySelector(':scope > h1, :scope > h2, :scope > h3')?.tagName;
      if (level === 'H1') section = subsection = null;
      if (level === 'H2') {
        section = printSection(pane, block);
        subsection = null;
      } else if (level === 'H3') {
        subsection = printSection(section ?? pane, block);
      }
      (subsection ?? section)?.append(block);
    }
    // A paragraph that is only links, such as a "Home" link at the top, is for finding your way
    // on screen and is left off paper.
    pane.querySelectorAll(':scope .live-block > p').forEach(paragraph => {
      const links = [...paragraph.querySelectorAll('a')];
      // Only letters and digits count: not separators, spaces or the editor's invisible characters.
      const bare = text => text.replace(/[^\p{L}\p{N}]/gu, '');
      const linksOnly = bare(paragraph.textContent) === bare(links.map(link => link.textContent).join(''));
      if (links.length && linksOnly && !paragraph.querySelector('img, video')) paragraph.parentElement.classList.add('slate-print-hidden');
    });
  }

  function printSection(parent, before) {
    const section = document.createElement('div');
    section.className = 'slate-print-section';
    parent.insertBefore(section, before);
    return section;
  }

  function ungroupAfterPrint() {
    const pane = el.previewPane;
    if (!pane) return;
    // Inner sections first, so each block goes back to where it was.
    [...pane.querySelectorAll('.slate-print-section')].reverse().forEach(section => section.replaceWith(...section.childNodes));
    pane.querySelectorAll('.slate-print-hidden').forEach(block => block.classList.remove('slate-print-hidden'));
  }

  // Hosts switch the theme by setting data-theme on the host; diagrams follow it.
  function watchDiagramTheme() {
    new MutationObserver(() => hydrateDiagrams(mountHost)).observe(mountHost, { attributes: true, attributeFilter: ['data-theme'] });
  }

  function renderMarkdown(markdown) {
    const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
    const html = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];

      if (/^\s*```/.test(line)) {
        const language = line.trim().slice(3).trim();
        const code = [];
        index += 1;
        while (index < lines.length && !/^\s*```/.test(lines[index])) {
          code.push(lines[index]);
          index += 1;
        }
        if (index < lines.length) index += 1;
        if (diagramLanguage(language)) {
          html.push(diagramHtml(diagramLanguage(language), code.join('\n')));
          continue;
        }
        const className = language ? ` class="language-${escapeAttribute(language)}"` : '';
        html.push(`<pre><code${className}>${escapeHtml(code.join('\n'))}</code></pre>`);
        continue;
      }

      if (/^\s*$/.test(line)) {
        index += 1;
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        const level = heading[1].length;
        html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
        index += 1;
        continue;
      }

      if (/^\s*((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})\s*$/.test(line)) {
        html.push('<hr>');
        index += 1;
        continue;
      }

      if (/^\s*>/.test(line)) {
        const quoteLines = [];
        while (index < lines.length && /^\s*>/.test(lines[index])) {
          quoteLines.push(lines[index].replace(/^\s*>\s?/, ''));
          index += 1;
        }
        html.push(`<blockquote>${quoteLines.map(value => `<p>${inlineMarkdown(value)}</p>`).join('')}</blockquote>`);
        continue;
      }

      if (isTableStart(lines, index)) {
        const headers = splitTableRow(lines[index]);
        const aligns = splitTableRow(lines[index + 1]).map(cell => {
          const text = cell.trim();
          if (text.startsWith(':') && text.endsWith(':')) return 'center';
          if (text.endsWith(':')) return 'right';
          return 'left';
        });
        index += 2;
        const rows = [];
        while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
          rows.push(splitTableRow(lines[index]));
          index += 1;
        }
        const head = headers.map((cell, i) => `<th style="text-align:${aligns[i] || 'left'}">${inlineMarkdown(cell.trim())}</th>`).join('');
        const body = rows.map(row => `<tr>${headers.map((_, i) => `<td style="text-align:${aligns[i] || 'left'}">${inlineMarkdown((row[i] || '').trim())}</td>`).join('')}</tr>`).join('');
        html.push(`<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`);
        continue;
      }

      const listMatch = line.match(/^\s*((?:[-+*])|(?:\d+\.))\s+(.+)$/);
      if (listMatch) {
        const ordered = /\d+\./.test(listMatch[1]);
        const tag = ordered ? 'ol' : 'ul';
        const items = [];
        while (index < lines.length) {
          const match = lines[index].match(/^\s*((?:[-+*])|(?:\d+\.))\s+(.+)$/);
          if (!match || /\d+\./.test(match[1]) !== ordered) break;
          const sourceLine = index;
          const task = match[2].match(/^\[([ xX])\]\s*(.*)$/);
          if (task) {
            const checked = task[1].toLowerCase() === 'x';
            items.push(`<li class="task-item"><input class="task-checkbox" type="checkbox" data-line="${sourceLine}" contenteditable="false" ${checked ? 'checked' : ''}>${inlineMarkdown(task[2])}</li>`);
          } else {
            items.push(`<li>${inlineMarkdown(match[2])}</li>`);
          }
          index += 1;
        }
        html.push(`<${tag}>${items.join('')}</${tag}>`);
        continue;
      }

      const paragraph = [line.trim()];
      index += 1;
      while (index < lines.length && lines[index].trim() && !isBlockStart(lines, index)) {
        paragraph.push(lines[index].trim());
        index += 1;
      }
      html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    }

    return html.join('\n');
  }







  function isBlockStart(lines, index) {
    const line = lines[index];
    return /^\s*```/.test(line) || /^(#{1,6})\s+/.test(line) || /^\s*>/.test(line) ||
      /^\s*((?:[-+*])|(?:\d+\.))\s+/.test(line) ||
      /^\s*((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})\s*$/.test(line) ||
      isTableStart(lines, index);
  }

  function isTableStart(lines, index) {
    if (index + 1 >= lines.length || !lines[index].includes('|')) return false;
    const delimiter = lines[index + 1].trim();
    return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(delimiter);
  }

  function splitTableRow(line) {
    let value = line.trim();
    if (value.startsWith('|')) value = value.slice(1);
    if (value.endsWith('|')) value = value.slice(0, -1);
    return value.split(/(?<!\\)\|/).map(cell => cell.replace(/\\\|/g, '|'));
  }

  function inlineMarkdown(raw) {
    const tokens = [];
    let value = escapeHtml(stripComments(raw));

    value = value.replace(/`([^`]+)`/g, (_, code) => tokenise(tokens, `<code>${code}</code>`));

    // A few plain HTML tags, such as <br> to break a line inside a table cell. Only the bare tag
    // names in INLINE_HTML_TAGS, with no attributes; anything else stays as literal text.
    value = value.replace(/&lt;(\/?)([a-z]+)\s*(\/?)&gt;/gi, (whole, close, name, selfClose) => {
      const tag = name.toLowerCase();
      if (tag === 'br' || tag === 'wbr') return close ? whole : tokenise(tokens, `<${tag}>`);
      if (!INLINE_HTML_TAGS.has(tag) || selfClose) return whole;
      return tokenise(tokens, `<${close}${tag}>`);
    });

    value = value.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+[&quot;]*([^&]*?)[&quot;]*)?\)/g, (_, alt, rawUrl, title) => {
      const url = decodeHtmlEntities(rawUrl);
      if (isAttachmentUrl(url)) {
        return tokenise(tokens, `<img data-attachment-id="${escapeAttribute(attachmentIdFromUrl(url))}" alt="${escapeAttribute(decodeHtmlEntities(alt))}">`);
      }
      const safe = safeUrl(url, true);
      if (!safe) return tokenise(tokens, `<span class="broken-attachment">Blocked image</span>`);
      const titleAttr = title ? ` title="${escapeAttribute(decodeHtmlEntities(title))}"` : '';
      return tokenise(tokens, `<img src="${escapeAttribute(displayUrl(safe, 'image'))}" data-md-url="${escapeAttribute(safe)}" alt=""${escapeAttribute(decodeHtmlEntities(alt))}"${titleAttr}>`);
    });

    value = value.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+[&quot;]*([^&]*?)[&quot;]*)?\)/g, (_, label, rawUrl, title) => {
      const url = decodeHtmlEntities(rawUrl);
      const titleAttr = title ? ` title="${escapeAttribute(decodeHtmlEntities(title))}"` : '';
      if (isAttachmentUrl(url)) {
        return tokenise(tokens, `<a class="attachment-link" data-attachment-id="${escapeAttribute(attachmentIdFromUrl(url))}" href="#"${titleAttr}>${label}</a>`);
      }
      const safe = safeUrl(url, false);
      if (!safe) return label;
      return tokenise(tokens, linkHtml(safe, label, titleAttr));
    });

    value = value.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, noteName, displayName) => {
      const name = decodeHtmlEntities(noteName.trim());
      const display = displayName || noteName;
      return tokenise(tokens, `<a href="#" class="wiki-link" data-note-name="${escapeAttribute(name)}">${display}</a>`);
    });

    // Autolinks: <https://…> and bare web addresses (GitHub's extended autolinks).
    value = value.replace(/&lt;((?:https?|mailto):[^\s\u0000]*?)&gt;/gi, (_, rawUrl) => {
      const safe = safeUrl(decodeHtmlEntities(rawUrl), false);
      return safe ? tokenise(tokens, linkHtml(safe, rawUrl, '')) : _;
    });
    value = value.replace(/(^|[\s(*_~])((?:https?:\/\/|www\.)(?:(?!&(?:quot|#039|lt|gt);)[^\s\u0000])+)/gi, (_, before, found) => {
      const [label, trailing] = splitBareUrl(found);
      const url = decodeHtmlEntities(label);
      return before + tokenise(tokens, linkHtml(/^www\./i.test(url) ? `http://${url}` : url, label, '')) + trailing;
    });

    value = value
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>')
      .replace(/  $/g, '<br>');

    return restoreTokens(value, tokens);
  }

  const INLINE_HTML_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'del', 'ins', 'mark', 'sub', 'sup', 'small', 'kbd', 'code']);

  function linkHtml(safe, label, titleAttr) {
    const external = isWebUrl(safe) ? ' class="external-link"' : '';
    return `<a href="${escapeAttribute(displayUrl(safe, 'link'))}" data-md-url="${escapeAttribute(safe)}"${external} target="_blank" rel="noopener noreferrer"${titleAttr}>${label}</a>`;
  }

  /** A bare address found in text, less the punctuation that ends a sentence: [url, punctuation]. */
  function splitBareUrl(found) {
    let end = found.length;
    while (end > 0) {
      const last = found[end - 1];
      if (/[.,:;!?*_~'"]/.test(last)) end -= 1;
      else if (last === ')' && (found.slice(0, end).match(/\(/g) || []).length < (found.slice(0, end).match(/\)/g) || []).length) end -= 1;
      else break;
    }
    return [found.slice(0, end), found.slice(end)];
  }

  function isWebUrl(url) {
    return /^https?:\/\//i.test(String(url));
  }

  function tokenise(tokens, html) {
    const id = tokens.push(html) - 1;
    return `\u0000TOKEN${id}\u0000`;
  }

  function restoreTokens(value, tokens) {
    return value.replace(/\u0000TOKEN(\d+)\u0000/g, (_, id) => tokens[Number(id)] || '');
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttribute(value) {
    return escapeHtml(String(value)).replace(/`/g, '&#096;');
  }

  function decodeHtmlEntities(value) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  }

  function safeUrl(url, isImage) {
    const trimmed = String(url).trim();
    if (!trimmed) return '';
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) return '';
    if (lower.startsWith('data:')) {
      return isImage && /^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(trimmed) ? trimmed : '';
    }
    return trimmed;
  }

  // Maps a Markdown URL to the URL the webview should load. The Markdown keeps
  // the original value (stored in data-md-url); only the rendered DOM changes.
  function displayUrl(url, kind) {
    if (!state.resolveUrl) return url;
    try {
      const resolved = state.resolveUrl(url, { kind });
      return typeof resolved === 'string' && resolved ? resolved : url;
    } catch (error) {
      console.error(error);
      return url;
    }
  }

  function isAttachmentUrl(url) {
    return String(url).toLowerCase().startsWith('attachment://');
  }

  function attachmentIdFromUrl(url) {
    return String(url).slice('attachment://'.length).split(/[?#]/)[0];
  }

  async function hydrateAttachments(root = el.previewPane) {
    const elements = [...root.querySelectorAll('[data-attachment-id]')];
    await Promise.all(elements.map(async element => {
      const attachment = await attachmentObjectUrl(element.dataset.attachmentId);
      if (!attachment) {
        element.replaceWith(makeBrokenAttachment(element));
        return;
      }
      const { record, objectUrl } = attachment;
      if (element.tagName === 'IMG' || element.tagName === 'VIDEO') {
        element.src = objectUrl;
        element.title = record.name;
      } else {
        element.href = objectUrl;
        element.download = record.name;
        element.title = `${record.name} (${formatBytes(record.size)})`;
      }
    }));
  }

  // One object URL per stored attachment, shared by Preview and Edit and kept for the page's
  // life, so a redraw of either never leaves the other showing a revoked URL.
  function attachmentObjectUrl(id) {
    if (!state.attachmentUrls.has(id)) {
      state.attachmentUrls.set(id, getRecord(ATTACHMENT_STORE, id).then(record => {
        if (!record?.blob) {
          state.attachmentUrls.delete(id);
          return null;
        }
        return { record, objectUrl: URL.createObjectURL(record.blob) };
      }));
    }
    return state.attachmentUrls.get(id);
  }

  function makeBrokenAttachment(element) {
    const span = document.createElement('span');
    span.className = 'broken-attachment';
    span.textContent = element.tagName === 'IMG' ? 'Missing image' : element.tagName === 'VIDEO' ? 'Missing video' : element.textContent || 'Missing attachment';
    return span;
  }


  function hydrateWikiLinks(root = el.previewPane) {
    root.querySelectorAll('.wiki-link').forEach(link => {
      link.title = `[[${link.dataset.noteName || link.textContent || ''}]]`;
    });
  }


  function handlePreviewClick(event) {
    if (event.target.closest('.wiki-link')) event.preventDefault();
  }


  function handlePreviewChange(event) {
    const checkbox = event.target.closest('.task-checkbox');
    if (!checkbox) return;
    if (!state.interactiveTasks) return;
    const block = checkbox.closest('.live-block');
    if (!block || block.dataset.videoTask === 'true') return;

    const mark = checkbox.checked ? 'x' : ' ';
    block.dataset.source = (block.dataset.source || '').replace(
      /^(\s*[-+*]\s+\[)[ xX](\])/,
      (_, before, after) => `${before}${mark}${after}`
    );
    persistRenderedDocument();
  }












  function normaliseStoredOutlineOpen(value) {
    return value !== 'false';
  }

  function applyOutlineVisibility(open, options = {}) {
    state.outlineOpen = Boolean(open);
    el.workspaceBody?.classList.toggle('outline-closed', !state.outlineOpen);
    el.workspaceBody?.classList.toggle('outline-external', !state.outlinePanel);
    el.documentOutline?.setAttribute('aria-hidden', String(!state.outlineOpen));
    el.outlineToggle?.setAttribute('aria-expanded', String(state.outlineOpen));
    el.outlineClose?.setAttribute('aria-expanded', String(state.outlineOpen));
    updateOutlineControlState();
    if (options.persist !== false) writeSetting('slate.outlineOpen', state.outlineOpen);
    if (options.notify !== false) dispatchEditorEvent('slate:outline-toggle', { open: state.outlineOpen });
  }

  function updateOutlineControlState() {
    const complete = state.completionState.complete;
    const completionSuffix = complete ? ' · all tasks complete' : '';
    const gutterAction = state.outlineOpen ? 'Document outline is open' : 'Open document outline';
    const panelAction = 'Close document outline';

    if (el.outlineToggle) {
      el.outlineToggle.setAttribute('aria-label', `${gutterAction}${completionSuffix}`);
      el.outlineToggle.title = `${gutterAction}${completionSuffix}`;
    }
    if (el.outlineClose) {
      el.outlineClose.setAttribute('aria-label', `${panelAction}${completionSuffix}`);
      el.outlineClose.title = `${panelAction}${completionSuffix}`;
    }
  }

  function scheduleDocumentOutlineUpdate() {
    clearTimeout(state.outlineTimer);
    const markdown = selectedNote()?.content || '';
    state.outlineTimer = setTimeout(() => {
      state.outlineTimer = null;
      updateDocumentOutline(markdown);
    }, 40);
  }

  function refreshLiveBlockLineIndexes() {
    if (!el.previewPane) return;
    let lineIndex = 0;
    el.previewPane.querySelectorAll(':scope > .live-block').forEach(block => {
      block.dataset.lineIndex = String(lineIndex);
      lineIndex += String(block.dataset.source ?? '').split('\n').length;
    });
  }

  function parseDocumentOutline(markdown) {
    const lines = String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n');
    const roots = [];
    const flat = [];
    const stack = [];
    let inFence = false;
    let inComment = false;
    let total = 0;
    let checked = 0;
    // Front matter is settings, not headings or tasks (Preview hides it).
    let frontMatterEnd = -1;
    if (lines[0]?.trimEnd() === '---') {
      frontMatterEnd = lines.findIndex((line, i) => i > 0 && (line.trimEnd() === '---' || line.trimEnd() === '...'));
    }

    lines.forEach((line, lineIndex) => {
      if (lineIndex <= frontMatterEnd) return;
      if (inComment) {
        if (line.includes('-->')) inComment = false;
        return;
      }
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return;
      }
      if (inFence) return;
      if (/^\s*<!--/.test(line) && !/^\s*<!--[\s\S]*?-->/.test(line)) {
        inComment = true;
        return;
      }

      const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const rawTitle = headingMatch[2].replace(/\s+#+\s*$/, '');
        const node = {
          id: `slate-heading-${flat.length + 1}`,
          level,
          lineIndex,
          source: line,
          title: outlineHeadingText(rawTitle),
          directTotal: 0,
          directChecked: 0,
          total: 0,
          checked: 0,
          children: [],
        };

        while (stack.length && stack.at(-1).level >= level) stack.pop();
        if (stack.length) stack.at(-1).children.push(node);
        else roots.push(node);
        stack.push(node);
        flat.push(node);
        return;
      }

      const taskMatch = line.match(/^\s*[-+*]\s+\[([ xX>])\](?:\s+|$)/);
      if (!taskMatch) return;
      const isChecked = taskMatch[1].toLowerCase() === 'x';
      total += 1;
      if (isChecked) checked += 1;
      const section = stack.at(-1);
      if (section) {
        section.directTotal += 1;
        if (isChecked) section.directChecked += 1;
      }
    });

    const aggregate = node => {
      let nodeTotal = node.directTotal;
      let nodeChecked = node.directChecked;
      node.children.forEach(child => {
        aggregate(child);
        nodeTotal += child.total;
        nodeChecked += child.checked;
      });
      node.total = nodeTotal;
      node.checked = nodeChecked;
    };
    roots.forEach(aggregate);

    return {
      roots,
      flat,
      completion: {
        hasCheckboxes: total > 0,
        total,
        checked,
        unchecked: total - checked,
        complete: total > 0 && checked === total,
      },
    };
  }

  function outlineHeadingText(source) {
    const text = String(source ?? '')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/[*_~`]/g, '')
      .replace(/\\([\\`*_[\]{}()#+.!-])/g, '$1')
      .trim();
    return text || 'Untitled section';
  }

  function updateDocumentOutline(markdown = selectedNote()?.content || '') {
    if (!el.outlineNavigation) return;
    const result = parseDocumentOutline(markdown);
    const fragment = document.createDocumentFragment();

    if (!result.roots.length) {
      const empty = document.createElement('p');
      empty.className = 'outline-empty';
      empty.textContent = 'Add Markdown headings to create document navigation.';
      fragment.appendChild(empty);
    } else {
      fragment.appendChild(createOutlineList(result.roots));
    }
    el.outlineNavigation.replaceChildren(fragment);

    const headingCount = result.flat.length;
    if (!headingCount) el.outlineSummary.textContent = 'No headings';
    else if (!result.completion.hasCheckboxes) {
      el.outlineSummary.textContent = `${headingCount} heading${headingCount === 1 ? '' : 's'} · no tasks`;
    } else {
      el.outlineSummary.textContent = `${headingCount} heading${headingCount === 1 ? '' : 's'} · ${result.completion.checked}/${result.completion.total} checked`;
    }

    refreshLiveBlockLineIndexes();
    el.previewPane?.querySelectorAll('[data-outline-id]').forEach(element => {
      element.removeAttribute('data-outline-id');
      element.querySelector?.('[id^="slate-heading-"]')?.removeAttribute('id');
    });
    result.flat.forEach(node => {
      const block = el.previewPane?.querySelector(`:scope > .live-block[data-line-index="${node.lineIndex}"]`);
      if (!block) return;
      block.dataset.outlineId = node.id;
      const heading = block.querySelector('h1, h2, h3, h4, h5, h6');
      if (heading) heading.id = node.id;
    });

    applyDocumentCompletionState(result.completion);

    state.outline = { headings: result.roots.map(publicOutlineNode), completion: { ...result.completion } };
    dispatchEditorEvent('slate:outline', getOutline());
  }

  function publicOutlineNode(node) {
    return {
      id: node.id,
      level: node.level,
      line: node.lineIndex,
      title: node.title,
      checked: node.checked,
      total: node.total,
      children: node.children.map(publicOutlineNode),
    };
  }

  function getOutline() {
    return structuredClone(state.outline);
  }

  function createOutlineList(nodes) {
    const list = document.createElement('ul');
    list.className = 'outline-list';
    nodes.forEach(node => {
      const item = document.createElement('li');
      item.className = 'outline-item';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'outline-link';
      button.dataset.outlineId = node.id;
      button.dataset.lineIndex = String(node.lineIndex);
      button.title = node.title;

      const status = document.createElement('span');
      status.className = 'outline-status';
      status.setAttribute('aria-hidden', 'true');
      if (node.total === 0) {
        button.classList.add('no-status');
        button.setAttribute('aria-label', `${node.title}; no checkboxes`);
      } else if (node.checked === node.total) {
        status.classList.add('complete');
        button.setAttribute('aria-label', `${node.title}; all ${node.total} checkboxes checked`);
      } else {
        button.setAttribute('aria-label', `${node.title}; ${node.checked} of ${node.total} checkboxes checked`);
      }

      const title = document.createElement('span');
      title.className = 'outline-title';
      title.textContent = node.title;
      if (node.total > 0) button.appendChild(status);
      button.appendChild(title);
      item.appendChild(button);
      if (node.children.length) item.appendChild(createOutlineList(node.children));
      list.appendChild(item);
    });
    return list;
  }

  function handleOutlineNavigationClick(event) {
    const button = event.target.closest('.outline-link');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    revealLine(Number(button.dataset.lineIndex));
  }

  function revealLine(lineIndex) {
    if (!Number.isInteger(lineIndex) || lineIndex < 0) return;

    if (state.editorMode === 'edit' && state.view === 'source') {
      el.markdownEditor.revealLine(lineIndex);
      return;
    }
    // In Edit, selecting the heading would show its Markdown, so it only scrolls.
    if (state.editorMode === 'edit') {
      el.markdownEditor.scrollToLine(lineIndex);
      return;
    }

    refreshLiveBlockLineIndexes();
    const block = el.previewPane.querySelector(`:scope > .live-block[data-line-index="${lineIndex}"]`);
    if (!block) return;
    scrollPreviewElementIntoView(block, { behavior: 'smooth', block: 'start' });
    block.classList.remove('outline-target');
    requestAnimationFrame(() => {
      block.classList.add('outline-target');
      setTimeout(() => block.classList.remove('outline-target'), 900);
    });
  }

  /**
   * Puts a host's saved place back: the cursor or selection (offsets into the Markdown, kept in
   * every mode) without scrolling to it, then `topLine` at the top of the view, in any mode.
   */
  function restoreView({ selection, topLine, focus = false } = {}) {
    if (Array.isArray(selection) && selection.length) {
      const length = el.markdownEditor.value.length;
      const clampOffset = value => Math.max(0, Math.min(length, Math.floor(Number(value)) || 0));
      el.markdownEditor.setSelectionRange(clampOffset(selection[0]), clampOffset(selection[1] ?? selection[0]), { scroll: false });
    }
    if (focus && state.editorMode === 'edit') el.markdownEditor.focus();
    const line = Number(topLine);
    if (Number.isInteger(line) && line >= 0) {
      if (state.editorMode === 'edit') el.markdownEditor.scrollToLine(line);
      else scrollPreviewToLine(line);
    }
  }

  /** The zero-based Markdown line at the top of the visible document (24px down). */
  function getTopLine() {
    if (state.editorMode === 'edit') return el.markdownEditor.topLine();
    const top = el.previewPane.getBoundingClientRect().top + 24;
    let line = 0;
    for (const block of el.previewPane.querySelectorAll(':scope > .live-block[data-line-index]')) {
      if (block.getBoundingClientRect().top > top) break;
      line = Number(block.dataset.lineIndex);
    }
    return line;
  }

  function scrollPreviewToLine(lineIndex) {
    let target = null;
    for (const block of el.previewPane.querySelectorAll(':scope > .live-block[data-line-index]')) {
      if (Number(block.dataset.lineIndex) > lineIndex) break;
      target = block;
    }
    if (target) scrollPreviewElementIntoView(target, { block: 'start' });
  }

  function scrollPreviewElementIntoView(target, options = {}) {
    const pane = el.previewPane;
    if (!pane || !target || !pane.contains(target)) return;

    const behavior = options.behavior === 'smooth' ? 'smooth' : 'auto';
    const alignment = options.block === 'start' ? 'start' : 'nearest';
    const paneRect = pane.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    let top = pane.scrollTop;

    if (alignment === 'start') {
      top += targetRect.top - paneRect.top;
    } else if (targetRect.top < paneRect.top) {
      top += targetRect.top - paneRect.top;
    } else if (targetRect.bottom > paneRect.bottom) {
      top += targetRect.bottom - paneRect.bottom;
    } else {
      return;
    }

    pane.scrollTo({ top: Math.max(0, top), behavior });
  }

  function applyDocumentCompletionState(next) {
    const previous = state.completionState;
    const stateChanged = previous.hasCheckboxes !== next.hasCheckboxes
      || previous.total !== next.total
      || previous.checked !== next.checked
      || previous.complete !== next.complete;
    state.completionState = Object.freeze({ ...next });
    el.app?.setAttribute('data-document-complete', String(next.complete));
    updateOutlineControlState();
    if (!stateChanged) return;

    dispatchEditorEvent('slate:completion-change', { ...state.completionState });

    if (next.complete && !previous.complete) {
      dispatchEditorEvent('slate:document-complete', { ...state.completionState });
      state.completionCallbacks.forEach(callback => {
        try { callback({ ...state.completionState }); }
        catch (error) { console.error('Slate document-complete callback failed:', error); }
      });
    }
  }

  function normaliseStoredView(view) {
    return view === 'source' ? 'source' : 'live';
  }

  function normaliseWorkspaceMode(mode) {
    return mode === 'preview' || mode === 'source' ? mode : 'edit';
  }

  function getWorkspaceMode() {
    if (state.editorMode === 'view') return 'preview';
    return state.view === 'source' ? 'source' : 'edit';
  }

  function updateWorkspaceModeControls() {
    const workspaceMode = getWorkspaceMode();
    el.app.dataset.workspaceMode = workspaceMode;
    el.viewButtons.forEach(button => {
      const active = button.dataset.workspaceMode === workspaceMode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
      button.disabled = state.readOnly;
    });
  }

  async function applyWorkspaceMode(mode, options = {}) {
    const before = getWorkspaceMode();
    const result = await applyWorkspaceModeNow(mode, options);
    const after = getWorkspaceMode();
    if (after !== before) dispatchEditorEvent('slate:mode-change', { mode: after, previous: before });
    return result;
  }

  async function applyWorkspaceModeNow(mode, options = {}) {
    mode = normaliseWorkspaceMode(mode);
    // A form filled in as its Preview stays in Preview; the host starts it again there.
    if (state.fill?.inPreview && mode !== 'preview' && !(state.readOnly && !options.allowReadOnly)) endFill('mode');
    if (state.compare && !options.keepCompare) finishCompare('mode');
    if (state.readOnly && mode !== 'preview' && !options.allowReadOnly) return getWorkspaceMode();
    if (mode === 'preview') {
      await applyEditorMode('view', options);
      return;
    }

    const targetView = mode === 'source' ? 'source' : 'live';
    if (state.editorMode === 'view') {
      state.view = targetView;
      writeSetting('slate.editorView', targetView);
      await applyEditorMode('edit', options);
    } else {
      applyView(targetView, options);
    }
  }

  async function applyReadOnly(readOnly) {
    const next = Boolean(readOnly);
    if (next === state.readOnly) return getWorkspaceMode();
    if (next && state.compare) finishCompare('read-only');

    if (next) {
      const currentMode = getWorkspaceMode();
      if (currentMode !== 'preview') state.lastWritableWorkspaceMode = currentMode;
      state.readOnly = true;
      el.app.dataset.readOnly = 'true';
      updateToolbarVisibility();
      await applyWorkspaceMode('preview', { allowReadOnly: true });
    } else {
      state.readOnly = false;
      el.app.dataset.readOnly = 'false';
      updateToolbarVisibility();
      await applyWorkspaceMode(state.lastWritableWorkspaceMode || 'edit', { allowReadOnly: true });
    }

    updateWorkspaceModeControls();
    return getWorkspaceMode();
  }

  // Read only hides the toolbar, except for the Changes toggle when the host offers one.
  function updateToolbarVisibility() {
    const toggle = Boolean(state.changesToggle);
    el.changesToggle.hidden = !toggle;
    el.viewSwitcher.hidden = state.readOnly;
    el.formatToolbar.hidden = state.readOnly && !toggle;
  }

  function applyView(view, options = {}) {
    view = normaliseStoredView(view);
    if (state.editorMode !== 'edit' && !options.force) return;

    // Edit and Source are one CodeMirror editor; Edit adds the live preview. Their text sizes
    // differ, so a switch between them keeps the line at the top rather than the scroll offset.
    const switching = state.editorMode === 'edit' && state.view !== view && el.markdownEditor.livePreview !== (view === 'live');
    const topLine = switching ? el.markdownEditor.topLine() : null;
    state.view = view;
    writeSetting('slate.editorView', view);
    el.editorGrid.className = view === 'live' ? 'editor-grid source-view edit-view' : 'editor-grid source-view';
    el.markdownEditor.livePreview = view === 'live';
    if (topLine !== null) el.markdownEditor.scrollToLine(topLine);
    updateWorkspaceModeControls();

    if (options.render === false) return;
    clearTimeout(state.previewTimer);
    const note = selectedNote();
    if (note) el.markdownEditor.value = note.content || '';
    el.markdownEditor.readOnly = state.attachmentBusy;
  }


  function normaliseStoredEditorMode(mode) {
    return mode === 'view' ? 'view' : 'edit';
  }

  async function applyEditorMode(mode, options = {}) {
    mode = normaliseStoredEditorMode(mode);
    // Preview and the editor scroll separately; the line at the top carries across.
    const topLine = options.render !== false && state.editorMode !== mode ? getTopLine() : null;

    state.editorMode = mode;
    writeSetting('slate.editorMode', mode);
    el.app.dataset.editorMode = mode;
    el.formatControls.hidden = mode === 'view';
    el.formatToolbar.classList.toggle('preview-mode', mode === 'view');
    el.markdownEditor.readOnly = mode === 'view';

    if (mode === 'view') {
      el.editorGrid.className = 'editor-grid live-view view-only';
      if (options.render !== false) await renderPreview();
      if (topLine !== null) scrollPreviewToLine(topLine);
    } else {
      applyView(state.view, { force: true, render: options.render !== false });
      applyPreviewInteractivity();
      if (topLine !== null) el.markdownEditor.scrollToLine(topLine);
    }
    updateWorkspaceModeControls();
    if (state.changes) await renderChanges();
  }

  // The preview pane is read only (Preview mode); with interactiveTasks its boxes still tick.
  function applyPreviewInteractivity() {
    const taskInteractionAllowed = state.interactiveTasks;
    el.previewPane.classList.toggle('tasks-interactive', taskInteractionAllowed);
    el.previewPane.querySelectorAll('.task-checkbox').forEach(checkbox => {
      checkbox.disabled = !taskInteractionAllowed || checkbox.closest('.live-block')?.dataset.videoTask === 'true';
    });
    el.previewPane.querySelectorAll('.media-source-toggle').forEach(button => {
      button.hidden = true;
    });
  }


  function persistRenderedDocument() {
    const note = selectedNote();
    if (!note) return;
    ensureTrailingLiveBlankBlock();
    const markdown = ensureTrailingBlankLine([...el.previewPane.querySelectorAll(':scope > .live-block')]
      .map(block => block.dataset.source || '')
      .join('\n'));
    note.content = markdown;
    note.updatedAt = Date.now();
    el.markdownEditor.value = markdown;
    scheduleSave(note);
    updateDocumentStats();
    refreshLiveBlockLineIndexes();
    dispatchDocumentChange();
  }







  function markdownContinuationPrefix(before) {
    const task = before.match(/^(\s*[-+*]\s+)\[[ xX]\]\s+/);
    if (task) return `${task[1]}[ ] `;

    const unordered = before.match(/^(\s*[-+*]\s+)/);
    if (unordered) return unordered[1];

    const ordered = before.match(/^(\s*)(\d+)\.\s+/);
    if (ordered) return `${ordered[1]}${Number(ordered[2]) + 1}. `;

    const quote = before.match(/^(\s*>\s?)/);
    return quote ? quote[1] : '';
  }








  function applyStoredTheme(requestedTheme = 'auto') {
    const theme = requestedTheme === 'dark' || requestedTheme === 'light' || requestedTheme === 'paper'
      ? requestedTheme
      : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    mountHost.dataset.theme = theme;
  }



  function updateDocumentStats() {
    const text = el.markdownEditor.value || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    el.documentStats.textContent = `${words} word${words === 1 ? '' : 's'} · ${text.length} character${text.length === 1 ? '' : 's'}`;
  }


  function handleGlobalKeydown(event) {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === 's') {
      event.preventDefault();
      if (!state.persistDocument) {
        dispatchEditorEvent('slate:save-request', { markdown: selectedNote()?.content || '', saveAs: event.shiftKey });
        return;
      }
      flushPendingSave();
      showToast('Saved locally');
    } else if (key === 'e' && !event.shiftKey) {
      event.preventDefault();
      if (state.readOnly) return;
      applyWorkspaceMode(state.editorMode === 'view' ? (state.view === 'source' ? 'source' : 'edit') : 'preview');
    } else if (key === 'o' && event.shiftKey) {
      event.preventDefault();
      applyOutlineVisibility(!state.outlineOpen);
    }
  }


  function applyFormatting(kind) {
    if (state.editorMode !== 'edit' || state.changes || state.fill) return;

    if (!selectedNote()) return;
    if (kind === 'video' || kind === 'video-task') {
      insertVideoTemplate(kind === 'video-task');
      return;
    }
    const selections = {
      bold: ['**', '**', 'bold text'],
      italic: ['*', '*', 'italic text'],
      strike: ['~~', '~~', 'struck text'],
      code: ['`', '`', 'code'],
      link: ['[', '](https://example.com)', 'link text'],
      wikilink: ['[[', ']]', 'Note Name'],
    };
    if (selections[kind]) {
      replaceSelection(...selections[kind]);
      return;
    }

    if (kind === 'heading') prefixSelectedLines('## ');
    if (kind === 'quote') prefixSelectedLines('> ');
    if (kind === 'task') prefixSelectedLines('- [ ] ');
    if (kind === 'codeblock') replaceSelection('```\n', '\n```', 'code');
  }

  function insertVideoTemplate(tracked = false) {
    const snippet = `${tracked ? '- [>] ' : ''}!video[title](url)`;
    const urlStart = snippet.lastIndexOf('(url)') + 1;
    const editor = el.markdownEditor;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const before = editor.value.slice(0, start);
    const after = editor.value.slice(end);
    const prefix = before && !before.endsWith('\n') ? '\n' : '';
    const suffix = after && !after.startsWith('\n') ? '\n' : '';
    editor.setRangeText(`${prefix}${snippet}${suffix}`, start, end, 'end');
    const selectionStart = start + prefix.length + urlStart;
    editor.value = ensureTrailingBlankLine(editor.value);
    editor.setSelectionRange(selectionStart, selectionStart + 3);
    editor.focus();
    handleSourceInput();
  }








  function replaceSelection(before, after, placeholder) {
    const editor = el.markdownEditor;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = editor.value.slice(start, end) || placeholder;
    const replacement = `${before}${selected}${after}`;
    editor.setRangeText(replacement, start, end, 'end');
    const selectionStart = start + before.length;
    editor.setSelectionRange(selectionStart, selectionStart + selected.length);
    editor.focus();
    handleSourceInput();
  }

  function prefixSelectedLines(prefix) {
    const editor = el.markdownEditor;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const value = editor.value;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const nextNewline = value.indexOf('\n', end);
    const lineEnd = nextNewline === -1 ? value.length : nextNewline;
    const selected = value.slice(lineStart, lineEnd);
    const replacement = selected.split('\n').map(line => `${prefix}${line}`).join('\n');
    editor.setRangeText(replacement, lineStart, lineEnd, 'select');
    editor.focus();
    handleSourceInput();
  }

  async function handlePaste(event) {
    if (state.editorMode !== 'edit') return;

    const files = clipboardFiles(event.clipboardData);
    if (files.length > 0) {
      event.preventDefault();
      await insertFiles(files, 'paste');
      return;
    }

    // Some applications copy images as data URLs inside HTML rather than as a File.
    const html = event.clipboardData?.getData('text/html') || '';
    const dataImage = html.match(/<img[^>]+src=["'](data:image\/[^"']+)["']/i)?.[1];
    if (dataImage) {
      event.preventDefault();
      try {
        const blob = await fetch(dataImage).then(response => response.blob());
        const extension = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
        await insertFiles([new File([blob], `pasted-image-${timestampForName()}.${extension}`, { type: blob.type })], 'paste');
      } catch (error) {
        showToast(`Could not paste image: ${error.message}`, true);
      }
      return;
    }
  }

  function clipboardFiles(clipboardData) {
    if (!clipboardData) return [];
    const files = [];
    for (const item of clipboardData.items || []) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    return files.length ? files : [...(clipboardData.files || [])];
  }

  function handleDragEnter(event) {
    if (state.editorMode !== 'edit' || !hasFiles(event.dataTransfer)) return;
    event.preventDefault();
    state.dragDepth += 1;
    el.dropOverlay.hidden = false;
  }


  function handleDragOver(event) {
    if (state.editorMode !== 'edit' || !hasFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }


  function handleDragLeave(event) {
    if (state.editorMode !== 'edit' || !hasFiles(event.dataTransfer)) return;
    state.dragDepth = Math.max(0, state.dragDepth - 1);
    if (state.dragDepth === 0) el.dropOverlay.hidden = true;
  }


  async function handleDrop(event) {
    if (!hasFiles(event.dataTransfer)) return;
    event.preventDefault();
    state.dragDepth = 0;
    el.dropOverlay.hidden = true;
    if (state.editorMode !== 'edit') {
      showToast('Switch to Edit mode to insert files.');
      return;
    }
    await insertFiles([...event.dataTransfer.files], 'drop');
  }


  function hasFiles(dataTransfer) {
    return [...(dataTransfer?.types || [])].includes('Files');
  }

  function captureAttachmentInsertionPoint() {
    return {
      start: el.markdownEditor.selectionStart,
      end: el.markdownEditor.selectionEnd,
    };
  }

  function setAttachmentBusy(busy) {
    state.attachmentBusy = Boolean(busy);
    el.app.dataset.attachmentBusy = String(state.attachmentBusy);
    el.attachButton.disabled = state.attachmentBusy;
    el.attachInput.disabled = state.attachmentBusy;
    el.markdownEditor.readOnly = state.attachmentBusy || state.editorMode === 'view';
    el.previewPane.inert = state.attachmentBusy;
  }

  async function insertFiles(files, source = 'picker') {
    if (state.editorMode !== 'edit' || state.attachmentBusy || state.changes || state.fill) return;
    files = [...(files || [])].filter(file => file instanceof File);
    if (files.length === 0) return;

    const bookmark = captureAttachmentInsertionPoint();
    setAttachmentBusy(true);

    try {
      const inserted = state.attachmentHandler
        ? await uploadAttachmentsThroughHost(files, source)
        : await createStandaloneAttachments(files);

      if (!inserted.length) {
        showToast('Attachment upload was cancelled or returned no usable files.');
        return;
      }

      insertAttachmentsIntoSourceEditor(inserted, bookmark);

      showToast(`${inserted.length} attachment${inserted.length === 1 ? '' : 's'} inserted`);
    } catch (error) {
      console.error(error);
      showToast(`Attachment upload failed: ${error.message || error}`, true);
    } finally {
      setAttachmentBusy(false);
    }
  }

  async function createStandaloneAttachments(files) {
    const inserted = [];
    for (const file of files) {
      try {
        const record = await storeAttachment(file);
        const label = escapeMarkdownLabel(record.name || 'attachment');
        const kind = isImageFile(file) ? 'image' : isVideoFile(file) ? 'video' : 'file';
        const target = `attachment://${record.id}`;
        inserted.push({
          file,
          kind,
          label,
          url: target,
          snippet: attachmentMarkdown(kind, label, target),
        });
      } catch (error) {
        console.error(error);
        showToast(`Could not store ${file.name}: ${error.message}`, true);
      }
    }
    return inserted;
  }

  async function uploadAttachmentsThroughHost(files, source) {
    let returned;
    try {
      returned = await state.attachmentHandler([...files], { source });
    } catch (error) {
      throw new Error(error?.message || 'The host attachment handler rejected the files.');
    }

    if (returned == null) return [];
    if (!Array.isArray(returned)) {
      throw new TypeError('The host attachment handler must return an array of uploaded attachments.');
    }

    const inserted = [];
    let invalidCount = 0;
    returned.forEach((result, index) => {
      if (!result) return;
      const original = result.file instanceof File ? result.file : files[index] || null;
      const markdown = typeof result.markdown === 'string' ? result.markdown.trim() : '';
      if (markdown) {
        inserted.push({
          file: original,
          kind: normaliseAttachmentKind(result.kind, original),
          label: result.label || original?.name || 'attachment',
          url: typeof result.url === 'string' ? result.url : '',
          snippet: markdown,
        });
        return;
      }

      const url = typeof result.url === 'string' ? result.url.trim() : '';
      if (!url) {
        invalidCount += 1;
        return;
      }
      const kind = normaliseAttachmentKind(result.kind, original);
      const label = escapeMarkdownLabel(result.label || original?.name || 'attachment');
      inserted.push({ file: original, kind, label, url, snippet: attachmentMarkdown(kind, label, url) });
    });

    if (invalidCount) {
      showToast(`${invalidCount} uploaded attachment${invalidCount === 1 ? '' : 's'} had no URL or Markdown and were skipped.`, true);
    }
    return inserted;
  }

  function normaliseAttachmentKind(kind, file) {
    if (kind === 'image' || kind === 'video' || kind === 'file') return kind;
    if (file && isImageFile(file)) return 'image';
    if (file && isVideoFile(file)) return 'video';
    return 'file';
  }

  function attachmentMarkdown(kind, label, url) {
    if (kind === 'image') return `![${label}](${url})`;
    if (kind === 'video') return `!video[${label}](${url})`;
    return `[${label}](${url})`;
  }

  function insertAttachmentsIntoSourceEditor(inserted, bookmark) {
    const editor = el.markdownEditor;
    const start = Math.max(0, Math.min(editor.value.length, bookmark.start));
    const end = Math.max(start, Math.min(editor.value.length, bookmark.end));
    const snippets = inserted.map(item => item.snippet);
    const prefix = start > 0 && !/\s$/.test(editor.value.slice(0, start)) ? '\n\n' : '';
    const suffix = start < editor.value.length && !/^\s/.test(editor.value.slice(start)) ? '\n\n' : '';
    editor.setRangeText(prefix + snippets.join('\n\n') + suffix, start, end, 'end');
    editor.focus();
    handleSourceInput();
  }


  async function storeAttachment(file) {
    const id = uuid();
    const name = cleanFileName(file.name || `attachment-${timestampForName()}`);
    const record = {
      id,
      name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      blob: file.slice(0, file.size, file.type || 'application/octet-stream'),
      createdAt: Date.now(),
    };
    await putRecord(ATTACHMENT_STORE, record);
    return record;
  }

  function cleanFileName(name) {
    return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 220) || 'attachment';
  }

  function escapeMarkdownLabel(name) {
    return cleanFileName(name).replace(/([\[\]])/g, '\\$1');
  }

  function isImageFile(file) {
    return file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(file.name);
  }

  function isVideoFile(file) {
    return file.type.startsWith('video/') || /\.(mp4|m4v|webm|ogv|ogg|mov)$/i.test(file.name);
  }








  function timestampForName() {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  }


  // Compare shows another version of the document inline (CodeMirror's merge view): text only
  // in the other version is red, text only in this document green, and each difference has
  // buttons to keep this document's text or take the other version's. The document is edited
  // in place, so saving works as usual; Done (or endCompare) closes the comparison.
  async function startCompare(markdown, options = {}) {
    if (state.readOnly) throw new Error('Compare needs an editable document; call setReadOnly(false) first.');
    const other = ensureTrailingBlankLine(String(markdown ?? '').replace(/\r\n?/g, '\n'));
    const label = String(options.label || 'Other version').trim() || 'Other version';
    if (state.compare) finishCompare('restart', { notify: false });
    if (state.changes) hideChanges('compare');
    if (state.fill) endFill('compare');
    const previousMode = getWorkspaceMode();
    if (previousMode !== 'source') await applyWorkspaceMode('source', { keepCompare: true });
    state.compare = { label, previousMode, other };
    el.compareLabel.textContent = label;
    el.compareUseAll.textContent = `Use all of ${label}`;
    el.compareBar.hidden = false;
    el.app.dataset.comparing = 'true';
    el.markdownEditor.startCompare(other, {
      control: compareControl,
      onChange: () => queueMicrotask(updateCompareSummary),
    });
    updateCompareSummary();
    el.markdownEditor.focus();
    return compareSnapshot();
  }

  function compareControl(type, action) {
    const button = ownerDocument.createElement('button');
    button.type = 'button';
    // CodeMirror colours name=accept green and name=reject red, matching the legend.
    button.name = type;
    button.className = `compare-chunk-button compare-chunk-${type === 'accept' ? 'keep' : 'take'}`;
    button.textContent = type === 'accept' ? 'Keep this' : `Use ${state.compare?.label || 'theirs'}`;
    button.title = type === 'accept'
      ? 'Keep this document\'s text here'
      : `Replace this part with ${state.compare?.label || 'the other version'}`;
    button.onmousedown = event => {
      event.preventDefault();
      action(event);
    };
    return button;
  }

  function compareSnapshot() {
    if (!state.compare) return { comparing: false, label: '', differences: 0 };
    return { comparing: true, label: state.compare.label, differences: el.markdownEditor.differences };
  }

  function updateCompareSummary() {
    if (!state.compare) return;
    const count = el.markdownEditor.differences;
    el.compareSummary.textContent = count === 0
      ? 'No differences left'
      : `${count} ${count === 1 ? 'difference' : 'differences'}`;
    el.compareBar.classList.toggle('compare-resolved', count === 0);
    el.compareUseAll.disabled = count === 0;
  }

  function useAllOfCompare() {
    if (!state.compare || state.editorMode !== 'edit') return;
    el.markdownEditor.value = state.compare.other;
    handleSourceInput();
    updateCompareSummary();
  }

  // Ends the comparison, keeping the document as it now stands. Returns what was left.
  function finishCompare(reason = 'done', options = {}) {
    if (!state.compare) return compareSnapshot();
    const snapshot = compareSnapshot();
    const { previousMode } = state.compare;
    state.compare = null;
    el.markdownEditor.endCompare();
    el.compareBar.hidden = true;
    delete el.app.dataset.comparing;
    if (reason === 'done' && previousMode !== 'source') applyWorkspaceMode(previousMode);
    if (options.notify !== false) {
      dispatchEditorEvent('slate:compare-end', {
        reason,
        label: snapshot.label,
        differences: snapshot.differences,
        markdown: selectedNote()?.content || '',
      });
    }
    return snapshot;
  }

  // Show Changes is for reading: how the document differs from another version (or one version
  // from another), drawn read only in place of the document. Preview draws it rendered, word by
  // word (changes.js); Edit and Source show the Markdown, with the merge view used by Compare.
  async function showChanges(markdown, options = {}) {
    if (state.compare) finishCompare('changes');
    if (state.fill) endFill('changes');
    const normalise = text => ensureTrailingBlankLine(String(text ?? '').replace(/\r\n?/g, '\n'));
    const label = String(options.label || '').trim() || 'the other version';
    const toLabel = String(options.toLabel || '').trim();
    state.changes = {
      from: normalise(markdown),
      to: options.to === undefined || options.to === null ? null : normalise(options.to),
      label,
      toLabel,
      count: 0,
    };
    updateChangesToggle();
    el.changesTitle.textContent = toLabel ? `Changes from ${label} to ${toLabel}` : `Changes since ${label}`;
    el.app.dataset.showingChanges = 'true';
    el.changesPane.hidden = false;
    await renderChanges();
    el.changesPreview.scrollTop = 0;
    return changesSnapshot();
  }

  async function renderChanges() {
    const changes = state.changes;
    if (!changes) return;
    const generation = ++state.changesGeneration;
    const to = changes.to ?? ensureTrailingBlankLine(selectedNote()?.content || '');
    const form = state.editorMode === 'view' ? 'preview' : 'source';
    el.changesPane.dataset.form = form;
    let count;
    if (form === 'preview') {
      count = await renderChangesPreview(changes.from, to, generation);
      if (generation !== state.changesGeneration) return;
    } else {
      if (!state.changesEditor) {
        state.changesEditor = createSourceEditor(el.changesSource, { ariaLabel: 'Changes in the Markdown source' });
        state.changesEditor.readOnly = true;
      }
      const editor = state.changesEditor;
      editor.endCompare();
      editor.replaceDocument(to);
      editor.startCompare(changes.from, { control: false });
      count = editor.differences;
    }
    changes.count = count;
    el.changesSummary.textContent = count === 0 ? 'No changes' : `${count} ${count === 1 ? 'change' : 'changes'}`;
    el.changesPrevious.disabled = count === 0;
    el.changesNext.disabled = count === 0;
  }

  /** Draws the change from `from` to `to` in the changes pane; returns how many changes there are. */
  async function renderChangesPreview(from, to, generation) {
    const pane = el.changesPreview;
    destroyMediaPlayers(pane);
    const plan = planChanges(splitMarkdownIntoLiveBlocks(from), splitMarkdownIntoLiveBlocks(to));
    const fragment = document.createDocumentFragment();
    plan.items.forEach(item => {
      let block;
      if (item.type === 'changed') {
        block = createLiveBlock(item.to);
        markWordChanges(block, createLiveBlock(item.from));
        block.classList.add('slate-diff-changed');
      } else {
        block = createLiveBlock(item.source);
        if (item.type !== 'same') block.classList.add(`slate-diff-${item.type}`);
      }
      if (item.first) block.classList.add('slate-diff-first');
      fragment.appendChild(block);
    });
    pane.replaceChildren(fragment);
    hydrateDiagrams(pane);
    await hydrateAttachments(pane);
    if (generation !== state.changesGeneration) return plan.changes;
    hydrateWikiLinks(pane);
    // Read only: boxes don't tick and videos don't count as watched here.
    pane.querySelectorAll('.task-checkbox').forEach(checkbox => { checkbox.disabled = true; });
    pane.querySelectorAll('.media-source-toggle').forEach(button => { button.hidden = true; });
    return plan.changes;
  }

  /** Scrolls to the next (1) or previous (-1) change. */
  function goToChange(direction) {
    if (!state.changes) return;
    if (el.changesPane.dataset.form === 'source') {
      state.changesEditor?.goToChange(direction);
      return;
    }
    const pane = el.changesPreview;
    const top = pane.getBoundingClientRect().top + 24;
    const marks = [...pane.querySelectorAll('.slate-diff-first')];
    const target = direction > 0
      ? marks.find(mark => mark.getBoundingClientRect().top > top + 8)
      : marks.findLast(mark => mark.getBoundingClientRect().top < top - 8);
    if (!target) return;
    pane.scrollTo({ top: Math.max(0, pane.scrollTop + target.getBoundingClientRect().top - top) });
    target.classList.remove('outline-target');
    requestAnimationFrame(() => target.classList.add('outline-target'));
    setTimeout(() => target.classList.remove('outline-target'), 1400);
  }

  // The toolbar's Changes button: the host decides what to compare with (setChangesToggle).
  async function toggleChanges() {
    if (state.changes) {
      hideChanges('done');
      return;
    }
    if (!state.changesToggle) return;
    el.changesToggle.disabled = true;
    try {
      await state.changesToggle();
    } catch (error) {
      console.error('Slate changes toggle failed:', error);
    } finally {
      el.changesToggle.disabled = false;
    }
  }

  function updateChangesToggle() {
    const on = Boolean(state.changes);
    el.changesToggle.classList.toggle('active', on);
    el.changesToggle.setAttribute('aria-pressed', String(on));
  }

  function changesSnapshot() {
    if (!state.changes) return { showing: false, label: '', toLabel: '', changes: 0 };
    const { label, toLabel, count } = state.changes;
    return { showing: true, label, toLabel, changes: count };
  }

  // Goes back to the document. Returns what was shown.
  function hideChanges(reason = 'done', options = {}) {
    if (!state.changes) return changesSnapshot();
    const snapshot = changesSnapshot();
    state.changes = null;
    state.changesGeneration += 1;
    el.changesPane.hidden = true;
    delete el.app.dataset.showingChanges;
    destroyMediaPlayers(el.changesPreview);
    el.changesPreview.replaceChildren();
    state.changesEditor?.endCompare();
    updateChangesToggle();
    if (options.notify !== false) {
      dispatchEditorEvent('slate:changes-end', { reason, label: snapshot.label, toLabel: snapshot.toLabel });
    }
    return snapshot;
  }

  // Fill mode (forms, see forms.js): the template drawn as in Preview, with real inputs for its
  // fields and its <!-- comments --> shown as hints for the person filling it in. The answers
  // stay here; Send checks them and hands them to the host (slate:form-submit), which sends them.
  async function startFill(options = {}) {
    const form = parseForm(selectedNote()?.content || '');
    if (!form) throw new Error('This document is not a form template: its front matter has no form key.');
    if (form.error) throw new Error(form.error);
    if (state.compare) finishCompare('fill');
    if (state.changes) hideChanges('fill');
    const inPreview = Boolean(options.inPreview);
    const readOnly = Boolean(options.readOnly);
    if (inPreview && getWorkspaceMode() !== 'preview') await applyWorkspaceModeNow('preview', { allowReadOnly: true });
    if (state.fill) endFill('restart', { notify: false });
    state.fill = { form, answers: {}, problems: new Map(), generation: 0, uid: uuid().slice(0, 8), busy: false, inPreview, readOnly };
    setFillAnswers(options.answers);
    el.fillTitle.textContent = fillTitle(state.fill);
    el.fillSubmit.textContent = String(options.submitLabel || 'Send');
    el.fillSubmit.hidden = readOnly || options.submit === false;
    el.fillSubmit.disabled = false;
    el.fillClose.hidden = inPreview;
    setFillStatus(options.status || '');
    el.app.dataset.filling = 'true';
    if (inPreview) el.app.dataset.fillInPreview = 'true';
    else delete el.app.dataset.fillInPreview;
    el.fillPane.hidden = false;
    await renderFill();
    el.fillForm.scrollTop = 0;
    return fillSnapshot();
  }

  /** Answers as the host gave them, kept only for fields the form has, in the right shape. */
  function setFillAnswers(answers) {
    const fill = state.fill;
    if (!fill) return;
    const given = answers && typeof answers === 'object' ? answers : {};
    fill.answers = {};
    fill.form.fields.forEach(field => {
      const value = given[field.name];
      if (field.multi) fill.answers[field.name] = Array.isArray(value) ? value.map(String).filter(v => field.options.includes(v)) : [];
      else fill.answers[field.name] = value === undefined || value === null || Array.isArray(value) ? '' : String(value);
    });
  }

  // The template changed while it was being filled in: draw the new one, keeping the answers.
  async function refreshFill() {
    const fill = state.fill;
    const form = parseForm(selectedNote()?.content || '');
    if (!form || form.error) {
      endFill('replaced');
      return;
    }
    const answers = fill.answers;
    fill.form = form;
    setFillAnswers(answers);
    el.fillTitle.textContent = fillTitle(fill);
    await renderFill();
  }

  function fillTitle(fill) {
    return fill.readOnly || fill.inPreview ? fill.form.title : `Filling in: ${fill.form.title}`;
  }

  async function renderFill() {
    const fill = state.fill;
    if (!fill) return;
    const generation = ++fill.generation;
    const pane = el.fillForm;
    destroyMediaPlayers(pane);
    const { markdown, hints } = fillMarkdown(fill.form);
    const fragment = document.createDocumentFragment();
    splitMarkdownIntoLiveBlocks(markdown).forEach(source => fragment.appendChild(createLiveBlock(source)));
    pane.replaceChildren(fragment);
    placeFormMarks(pane, fill, hints);
    hydrateDiagrams(pane);
    await hydrateAttachments(pane);
    if (state.fill !== fill || generation !== fill.generation) return;
    hydrateWikiLinks(pane);
    // The document's own task boxes and videos are not answers.
    pane.querySelectorAll('.task-checkbox').forEach(checkbox => { checkbox.disabled = true; });
    pane.querySelectorAll('.media-source-toggle').forEach(button => { button.hidden = true; });
    // Read only (a page that can't send it): the fields show, greyed out.
    pane.classList.toggle('form-read-only', fill.readOnly);
    if (fill.readOnly) pane.querySelectorAll('.form-field input, .form-field textarea, .form-field select').forEach(control => { control.disabled = true; });
    showFillProblems();
  }

  /** Puts a field's inputs in place of each field mark and a hint in place of each comment mark. */
  function placeFormMarks(pane, fill, hints) {
    const walker = document.createTreeWalker(pane, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      if (/[]/.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode);
    }
    nodes.forEach(node => {
      const text = node.nodeValue;
      const fragment = document.createDocumentFragment();
      let last = 0;
      for (const match of text.matchAll(/(\d+)|(\d+)/g)) {
        if (match.index > last) fragment.appendChild(document.createTextNode(text.slice(last, match.index)));
        if (match[1] !== undefined) {
          const field = fill.form.fields[Number(match[1])];
          if (field) fragment.appendChild(createFieldWidget(fill, field));
        } else {
          const hint = document.createElement('span');
          hint.className = 'form-hint';
          hint.textContent = hints[Number(match[2])] || '';
          fragment.appendChild(hint);
        }
        last = match.index + match[0].length;
      }
      if (last < text.length) fragment.appendChild(document.createTextNode(text.slice(last)));
      node.replaceWith(fragment);
    });
    pane.querySelectorAll('.form-hint').forEach(hint => {
      const block = hint.closest('.live-block');
      if (block && block.textContent.trim() === hint.textContent.trim()) hint.classList.add('form-hint-block');
    });
  }

  function fieldLabel(field) {
    return field.label || field.name.replace(/_/g, ' ');
  }

  function createFieldWidget(fill, field) {
    const wrap = document.createElement('span');
    wrap.className = `form-field form-field-${field.type}${field.multi ? ' form-field-multi' : ''}`;
    wrap.dataset.field = field.name;
    const id = `slate-${fill.uid}-${field.name}`;
    const label = fieldLabel(field);
    const value = fill.answers[field.name];
    const error = document.createElement('span');
    error.className = 'form-error';
    error.id = `${id}-error`;
    error.hidden = true;
    const describe = control => {
      control.setAttribute('aria-describedby', error.id);
      if (field.required) control.setAttribute('aria-required', 'true');
    };
    const option = (type, name, optionValue, text, checked) => {
      const item = document.createElement('label');
      item.className = 'form-option';
      const input = document.createElement('input');
      input.type = type;
      input.name = name;
      input.value = optionValue;
      input.checked = checked;
      const caption = document.createElement('span');
      caption.textContent = text;
      item.append(input, caption);
      return item;
    };
    if (field.type === 'choice' || field.type === 'yesno') {
      const group = document.createElement('span');
      group.className = 'form-options';
      group.setAttribute('role', field.multi ? 'group' : 'radiogroup');
      group.setAttribute('aria-label', label);
      describe(group);
      const options = field.type === 'yesno' ? ['Yes', 'No'] : field.options;
      options.forEach(text => {
        const checked = field.multi ? value.includes(text) : value === text;
        group.appendChild(option(field.multi ? 'checkbox' : 'radio', id, text, text, checked));
      });
      wrap.appendChild(group);
    } else if (field.type === 'sign') {
      const item = option('checkbox', id, 'true', 'Sign: your name and the time are added when you send it', value === 'true');
      item.classList.add('form-sign');
      describe(item.querySelector('input'));
      wrap.appendChild(item);
    } else {
      let control;
      if (field.type === 'textarea') {
        control = document.createElement('textarea');
        control.rows = Number(field.attrs.rows) || 4;
      } else if (field.type === 'select') {
        control = document.createElement('select');
        const none = document.createElement('option');
        none.value = '';
        none.textContent = field.placeholder || 'Choose…';
        control.appendChild(none);
        field.options.forEach(text => {
          const item = document.createElement('option');
          item.value = text;
          item.textContent = text;
          control.appendChild(item);
        });
      } else {
        control = document.createElement('input');
        const types = { email: 'email', phone: 'tel', date: 'date', time: 'time' };
        control.type = types[field.type] || 'text';
        if (field.type === 'number') control.inputMode = 'decimal';
        if (field.type === 'date' || field.type === 'time') {
          const today = localToday();
          if (field.attrs.min) control.min = field.attrs.min === 'today' ? today : field.attrs.min;
          if (field.attrs.max) control.max = field.attrs.max === 'today' ? today : field.attrs.max;
        }
      }
      if (field.type === 'text' || field.type === 'textarea') {
        const max = Number(field.attrs.max) || (field.type === 'textarea' ? 5000 : 200);
        control.maxLength = max;
        if (field.type === 'text') control.size = Math.max(12, Math.min(48, max));
      }
      control.id = id;
      control.className = 'form-control';
      control.setAttribute('aria-label', label);
      if (field.placeholder && field.type !== 'select') control.placeholder = field.placeholder;
      control.value = value;
      describe(control);
      wrap.appendChild(control);
    }
    wrap.appendChild(error);
    return wrap;
  }

  function readFieldValue(wrap, field) {
    if (field.type === 'choice' || field.type === 'yesno') {
      const checked = [...wrap.querySelectorAll('input:checked')].map(input => input.value);
      return field.multi ? checked : (checked[0] || '');
    }
    if (field.type === 'sign') return wrap.querySelector('input').checked ? 'true' : '';
    return wrap.querySelector('.form-control')?.value ?? '';
  }

  function handleFillInput(event) {
    const fill = state.fill;
    const wrap = event.target.closest('.form-field');
    if (!fill || !wrap || fill.readOnly) return;
    const field = fill.form.fields.find(f => f.name === wrap.dataset.field);
    if (!field) return;
    const value = readFieldValue(wrap, field);
    const before = JSON.stringify(fill.answers[field.name]);
    fill.answers[field.name] = value;
    if (fill.problems.delete(field.name)) {
      showFillProblems();
      if (!fill.problems.size && el.fillStatus.dataset.kind === 'error') setFillStatus('');
    }
    if (JSON.stringify(value) !== before) dispatchEditorEvent('slate:form-input', { name: field.name, answers: fillAnswers() });
  }

  function fillAnswers() {
    if (!state.fill) return {};
    return JSON.parse(JSON.stringify(state.fill.answers));
  }

  /** Checks every answer as the server will; shows the problems and returns them. */
  function checkFill(options = {}) {
    const fill = state.fill;
    if (!fill) return [];
    const problems = checkAnswers(fill.form, fill.answers, localToday());
    fill.problems = new Map(problems.map(p => [p.name, p.message]));
    showFillProblems({ focus: options.focus !== false });
    return problems;
  }

  /** Shows problems the host was given (the server's, by field); returns those of unknown fields. */
  function setFillProblems(problems = []) {
    const fill = state.fill;
    if (!fill) return [];
    const names = new Set(fill.form.fields.map(f => f.name));
    const known = (Array.isArray(problems) ? problems : []).filter(p => names.has(p?.name));
    fill.problems = new Map(known.map(p => [p.name, String(p.message || 'This answer needs fixing.')]));
    showFillProblems({ focus: true });
    return (Array.isArray(problems) ? problems : []).filter(p => !names.has(p?.name));
  }

  function showFillProblems(options = {}) {
    const fill = state.fill;
    if (!fill) return;
    let first = null;
    el.fillForm.querySelectorAll('.form-field').forEach(wrap => {
      const message = fill.problems.get(wrap.dataset.field) || '';
      const error = wrap.querySelector('.form-error');
      error.textContent = message;
      error.hidden = !message;
      wrap.classList.toggle('has-error', Boolean(message));
      wrap.querySelectorAll('input, textarea, select, .form-options').forEach(control => {
        if (message) control.setAttribute('aria-invalid', 'true');
        else control.removeAttribute('aria-invalid');
      });
      if (message && !first) first = wrap;
    });
    if (first && options.focus) {
      scrollPreviewElementIntoView(first);
      first.querySelector('input, textarea, select')?.focus({ preventScroll: true });
    }
  }

  function setFillStatus(text, options = {}) {
    if (!state.fill) return;
    el.fillStatus.textContent = String(text || '');
    el.fillStatus.dataset.kind = options.kind || '';
    if (options.busy !== undefined) {
      state.fill.busy = Boolean(options.busy);
      el.fillSubmit.disabled = state.fill.busy;
    }
  }

  // Send: checks the answers here first, then hands them to the host.
  function submitFill() {
    const fill = state.fill;
    if (!fill || fill.busy || fill.readOnly) return;
    const problems = checkFill();
    if (problems.length) {
      setFillStatus(problems.length === 1 ? '1 answer needs fixing.' : `${problems.length} answers need fixing.`, { kind: 'error' });
      return;
    }
    setFillStatus('');
    dispatchEditorEvent('slate:form-submit', { form: fill.form.form, title: fill.form.title, answers: fillAnswers() });
  }

  function publicForm(form) {
    if (!form) return null;
    return {
      form: form.form,
      title: form.title,
      submitTo: form.submitTo,
      error: form.error,
      fields: form.fields.map(f => ({ type: f.type, name: f.name, label: fieldLabel(f), required: f.required, multi: f.multi, options: [...f.options] })),
    };
  }

  function fillSnapshot() {
    if (!state.fill) return { filling: false, form: null, answers: {} };
    return { filling: true, inPreview: state.fill.inPreview, readOnly: state.fill.readOnly, form: publicForm(state.fill.form), answers: fillAnswers() };
  }

  // Back to the document. Returns the answers, which the host may keep as a draft.
  function endFill(reason = 'done', options = {}) {
    if (!state.fill) return {};
    const answers = fillAnswers();
    const form = state.fill.form.form;
    state.fill = null;
    el.fillPane.hidden = true;
    el.fillClose.hidden = false;
    delete el.app.dataset.filling;
    delete el.app.dataset.fillInPreview;
    destroyMediaPlayers(el.fillForm);
    el.fillForm.replaceChildren();
    if (options.notify !== false) dispatchEditorEvent('slate:fill-end', { reason, form, answers });
    return answers;
  }

  function dispatchEditorEvent(name, detail) {
    if (!mountHost) return;
    mountHost.dispatchEvent(new CustomEvent(name, {
      detail,
      bubbles: true,
      composed: true,
    }));
  }

  function dispatchDocumentChange() {
    scheduleDocumentOutlineUpdate();
    dispatchEditorEvent('slate:change', { markdown: selectedNote()?.content || '' });
  }

  function exposePublicApi() {
    mountedApi = Object.freeze({
      version: APP_VERSION,
      host: mountHost,
      getMarkdown() {
        return selectedNote()?.content || '';
      },
      async setMarkdown(markdown) {
        const note = selectedNote();
        if (!note) return;
        if (state.compare) finishCompare('replaced');
        note.content = ensureTrailingBlankLine(String(markdown ?? ''));
        note.updatedAt = Date.now();
        el.markdownEditor.replaceDocument(note.content);
        scheduleSave(note);
        updateDocumentStats();
        if (state.editorMode === 'view') await renderPreview();
        if (state.changes && state.changes.to === null) await renderChanges();
        if (state.fill) await refreshFill();
        dispatchDocumentChange();
      },
      getWorkspaceMode() {
        return getWorkspaceMode();
      },
      setWorkspaceMode(mode) {
        return applyWorkspaceMode(mode);
      },
      setReadOnly(readOnly) {
        return applyReadOnly(readOnly);
      },
      setInteractiveTasks(enabled) {
        state.interactiveTasks = Boolean(enabled);
        applyPreviewInteractivity();
        return state.interactiveTasks;
      },
      setAttachmentHandler(handler) {
        validateAttachmentHandler(handler);
        state.attachmentHandler = handler;
        pendingAttachmentHandler = handler;
      },
      isOutlineOpen() {
        return state.outlineOpen;
      },
      getOutline() {
        return getOutline();
      },
      revealLine(line) {
        revealLine(Number(line));
      },
      selectSourceRange(start, end, options = {}) {
        if (state.editorMode !== 'edit') return;
        if (options.focus !== false) el.markdownEditor.focus();
        el.markdownEditor.setSelectionRange(Number(start), Number(end ?? start), { y: 'center' });
      },
      getSourceSelection() {
        return [el.markdownEditor.selectionStart, el.markdownEditor.selectionEnd];
      },
      restoreView(options = {}) {
        restoreView(options);
      },
      setSourceHighlights(ranges, current = -1) {
        el.markdownEditor.setFindMatches(Array.isArray(ranges) ? ranges : [], Number(current));
      },
      setOutlineOpen(open) {
        applyOutlineVisibility(open);
      },
      get documentComplete() {
        return state.completionState.complete;
      },
      isDocumentComplete() {
        return state.completionState.complete;
      },
      getCompletionState() {
        return { ...state.completionState };
      },
      onDocumentComplete(callback, options = {}) {
        if (typeof callback !== 'function') throw new TypeError('onDocumentComplete requires a callback function.');
        state.completionCallbacks.add(callback);
        if (state.completionState.complete && options.immediate !== false) {
          queueMicrotask(() => {
            if (state.completionCallbacks.has(callback)) callback({ ...state.completionState });
          });
        }
        return () => state.completionCallbacks.delete(callback);
      },
      getTopLine() {
        return getTopLine();
      },
      compare(markdown, options = {}) {
        return startCompare(markdown, options);
      },
      endCompare() {
        return finishCompare('host');
      },
      isComparing() {
        return Boolean(state.compare);
      },
      getCompareState() {
        return compareSnapshot();
      },
      showChanges(markdown, options = {}) {
        return showChanges(markdown, options);
      },
      hideChanges() {
        return hideChanges('host');
      },
      isShowingChanges() {
        return Boolean(state.changes);
      },
      getChangesState() {
        return changesSnapshot();
      },
      getForm(markdown) {
        return publicForm(parseForm(markdown === undefined ? (selectedNote()?.content || '') : markdown));
      },
      isForm(markdown) {
        return isFormTemplate(markdown === undefined ? (selectedNote()?.content || '') : markdown);
      },
      startFill(options = {}) {
        return startFill(options);
      },
      endFill() {
        return endFill('host');
      },
      isFilling() {
        return Boolean(state.fill);
      },
      getFillState() {
        return fillSnapshot();
      },
      getFormAnswers() {
        return fillAnswers();
      },
      async setFormAnswers(answers) {
        if (!state.fill) return {};
        setFillAnswers(answers);
        state.fill.problems.clear();
        await renderFill();
        return fillAnswers();
      },
      checkForm() {
        return checkFill();
      },
      setFormProblems(problems) {
        return setFillProblems(problems);
      },
      setFormStatus(text, options = {}) {
        setFillStatus(text, options);
      },
      setChangesToggle(handler) {
        if (handler !== null && handler !== undefined && typeof handler !== 'function') {
          throw new TypeError('setChangesToggle requires a function or null.');
        }
        state.changesToggle = handler || null;
        updateToolbarVisibility();
      },
      focus() {
        if (state.editorMode === 'edit') el.markdownEditor.focus();
      }
    });

    const methodNames = [
      'getMarkdown', 'setMarkdown', 'getWorkspaceMode', 'setWorkspaceMode', 'setReadOnly',
      'isOutlineOpen', 'setOutlineOpen', 'getOutline', 'revealLine', 'getTopLine', 'compare', 'endCompare',
      'isComparing', 'getCompareState', 'showChanges', 'hideChanges', 'isShowingChanges', 'getChangesState', 'setChangesToggle',
      'getForm', 'isForm', 'startFill', 'endFill', 'isFilling', 'getFillState', 'getFormAnswers', 'setFormAnswers', 'checkForm', 'setFormProblems', 'setFormStatus', 'selectSourceRange', 'getSourceSelection', 'restoreView', 'setSourceHighlights', 'isDocumentComplete', 'getCompletionState',
      'onDocumentComplete', 'focus'
    ];
    methodNames.forEach(name => {
      facade[name] = (...args) => mountedApi[name](...args);
    });
    facade.version = APP_VERSION;
    facade.host = mountHost;
  }

  function readSetting(key) {
    if (!state.persistSettings) return memorySettings.get(key) ?? null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memorySettings.get(key) ?? null;
    }
  }

  function writeSetting(key, value) {
    memorySettings.set(key, String(value));
    if (!state.persistSettings) return;
    try {
      window.localStorage.setItem(key, String(value));
    } catch {
      // Some privacy modes block localStorage. The editor still works for this tab.
    }
  }

  function removeSetting(key) {
    memorySettings.delete(key);
    if (!state.persistSettings) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore blocked localStorage.
    }
  }



  function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = `toast${isError ? ' error' : ''}`;
    toast.textContent = message;
    el.toastRegion.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }

  function showFatalError(error) {
    if (!mountRoot) return;
    mountRoot.innerHTML = `
      <main class="slate-fatal-error">
        <h1>Slate Markdown Editor could not start</h1>
        <p>${escapeHtml(error?.message || String(error))}</p>
        <p>Try opening the page in a current version of Chrome, Edge, Firefox, or Safari. Private browsing modes may block persistent storage.</p>
      </main>`;
  }

})();
