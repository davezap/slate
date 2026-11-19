// Mounts Slate for test/code-colour-check.mjs (a separate file: the page's policy refuses inline script).
window.ready = window.SlateMarkdownEditor.mount(document.getElementById('host'), {
  persist: false, persistSettings: false, workspaceMode: 'preview', showReadyToast: false,
}).then(editor => { window.editor = editor; });
