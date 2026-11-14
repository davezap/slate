// A test edition for test/embeds-check.mjs: the public edition plus one embed, `test-card`.
export * from '../src/edition.js';
export const embeds = {
  'test-card': {
    label: 'Test card',
    mount(element) {
      window.__mounts = (window.__mounts || 0) + 1;
      const card = document.createElement('div');
      card.className = 'test-card';
      card.textContent = 'Test card drawn';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'test-card-button';
      button.textContent = 'Press';
      button.addEventListener('click', () => { window.__pressed = (window.__pressed || 0) + 1; });
      card.append(button);
      element.append(card);
    },
  },
  broken: { mount() { throw new Error('broken on purpose'); } },
};
