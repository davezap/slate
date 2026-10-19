// Slate's Mermaid diagrams, built into mermaid/ (npm run build): mermaid.js plus a chunk per diagram
// type, so a flowchart loads only what flowcharts need. slate.js imports mermaid.js
// only when a document has a ```mermaid block, so documents without diagrams stay fast and small.

import mermaid from 'mermaid';

let theme = null;
let counter = 0;
// Mermaid draws one diagram at a time; calls queue up here.
let queue = Promise.resolve();

// Mermaid puts each diagram's CSS in a <style> inside its SVG, which a page whose
// Content-Security-Policy has no style-src 'unsafe-inline' refuses (Metatrash's pages).
// While Mermaid draws, its <style> is swapped for an empty comment and the CSS goes into a
// constructed stylesheet instead, which such a policy allows, so the page needs no change.
const canAdopt = typeof CSSStyleSheet === 'function' && 'replaceSync' in CSSStyleSheet.prototype
  && Array.isArray(document.adoptedStyleSheets);

function adopt(css) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  return sheet;
}

// Hands Mermaid's <style> to a stylesheet for the duration of one draw.
function captureStyles(onCss) {
  if (!canAdopt) return () => {};
  const create = document.createElement;
  document.createElement = function createElement(name, options) {
    if (String(name).toLowerCase() !== 'style') return create.call(this, name, options);
    const placeholder = document.createComment('');
    Object.defineProperty(placeholder, 'innerHTML', { set: onCss, get: () => '' });
    return placeholder;
  };
  return () => { document.createElement = create; };
}

function render(source, nextTheme) {
  const run = async () => {
    if (nextTheme !== theme) {
      mermaid.initialize({
        startOnLoad: false,
        // Diagram text can't run script or load anything.
        securityLevel: 'strict',
        // ...nor bring its own CSS through a %%{init}%% directive.
        secure: ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize', 'suppressErrorRendering', 'maxEdges', 'themeCSS'],
        theme: nextTheme === 'dark' ? 'dark' : 'default',
        fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif',
      });
      theme = nextTheme;
    }
    const id = `slate-mermaid-${(counter += 1)}`;
    let sheet = null;
    let css = '';
    const restore = captureStyles(text => {
      css = String(text);
      // Mermaid measures text as it draws, so the CSS applies from the start.
      sheet = adopt(css);
    });
    try {
      const { svg } = await mermaid.render(id, source);
      // Slate shows each copy of a diagram under its own id, `${id}-${n}`; :is() keeps the
      // rules as specific as Mermaid's #id, so the host's own styles don't win.
      sheet?.replaceSync(css.replace(new RegExp(`#${id}(?![\\w-])`, 'g'), `:is(#${id},[id^="${id}-"])`));
      return { svg, id };
    } catch (error) {
      if (sheet) document.adoptedStyleSheets = document.adoptedStyleSheets.filter(item => item !== sheet);
      throw error;
    } finally {
      restore();
      // A failed render leaves its scratch element in the page.
      document.getElementById(id)?.remove();
      document.getElementById(`d${id}`)?.remove();
    }
  };
  const result = queue.then(run, run);
  queue = result.catch(() => {});
  return result;
}

export { render };
