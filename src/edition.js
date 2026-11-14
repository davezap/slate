// Compile-time composition. The public edition has no company additions.
export const inlineFormats = [];
export const toolbar = '';
export const selections = {};
export const parserExtensions = [];
export const inlineNodes = {};
export const highlights = [];
export const htmlTags = [];
export const renderInline = value => value;
// Named embeds (0.23.0): a fenced block with the info string `embed` whose only line is one of
// these names is drawn by the edition, so a document can place vetted content without carrying
// any code. name -> { label, mount(element) }: mount fills the element and stops its own work
// once the element has left the document. The public edition has none.
export const embeds = {};
