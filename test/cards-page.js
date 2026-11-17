// The page script for test/cards-check.mjs: a pretend card host with a few jobs and sales.
(async () => {
  const jobs = [
    { file: 'jobs/fix-pump.md', values: { name: 'fix-pump', title: 'Fix pump', state: 'open', type: 'Repair', hours: '3', due: '2026-12-30' } },
    { file: 'jobs/paint.md', values: { name: 'paint', title: 'Paint', state: 'open', type: 'Repair', hours: '2' } },
    { file: 'jobs/service-boiler.md', values: { name: 'service-boiler', title: 'Service boiler', state: 'open', type: 'Service', hours: '1.5' } },
  ];
  window.queries = [];
  window.sent = [];
  window.host = {
    person: { name: 'pat', email: 'pat@example.com' },
    async query(q) {
      window.queries.push(q);
      if (q.source === 'sales.csv') {
        return { count: 3, value: 600, measure: 'sum amount', fields: ['month', 'amount'], groups: [{ group: '2026-09', count: 1, value: 100 }, { group: '2026-10', count: 1, value: 200 }, { group: '2026-11', count: 1, value: 300 }] };
      }
      let rows = jobs;
      if (q.where === 'due<today') rows = [];
      if (q.group) {
        const groups = {};
        rows.forEach(r => { groups[r.values[q.group]] = (groups[r.values[q.group]] || 0) + 1; });
        return { count: rows.length, value: rows.length, fields: ['name', 'file', 'title'], groups: Object.entries(groups).map(([group, value]) => ({ group, count: value, value })) };
      }
      return { count: rows.length, value: rows.length, fields: ['name', 'file', 'due', 'hours', 'state', 'title', 'type'], rows };
    },
    async read(path) {
      if (path === 'lunch.md') return { text: '**Nearly time to eat.**\n' };
      if (path === 'lock-up.md') return { text: '---\nform: lock-up\nsubmitTo: me/s/done/\n---\nLocked? {{yesno name=locked required}}\n' };
      throw new Error('not found');
    },
    async notices(paths) {
      return paths.map(path => ({ path, blob: `blob-${path.replace('.md', '')}`, kind: path === 'lunch.md' ? 'notice' : 'form', done: false }));
    },
    async acknowledge(path, blob) { window.acked = [path, blob]; return { done: true }; },
    async submit(path, answers) {
      window.sent.push([path, answers]);
      if (answers.locked === 'No') return { problems: [{ name: 'locked', message: 'Lock it first.' }] };
      return { status: 'complete' };
    },
    open(path) { window.opened = path; },
  };
  window.editor = await window.SlateMarkdownEditor.mount(document.getElementById('host'), {
    persist: false, persistSettings: false, workspaceMode: 'preview', showReadyToast: false, cardHost: window.host,
  });
  window.ready = true;
})();
