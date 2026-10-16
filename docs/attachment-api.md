# Slate host attachment API

Slate can either store attachments itself in IndexedDB or delegate storage to a host web application.

## Callback

```javascript
const editor = await window.SlateMarkdownEditor.mount(host, {
  attachmentHandler: async (files, context) => {
    // context.source: "picker", "paste", or "drop"
    return files.map(file => ({
      file,
      url: `images/${file.name}`,
      label: file.name,
    }));
  },
});
```

The callback receives the original `File[]` and a source descriptor.

Each returned record may contain:

- `file`: original File (optional but useful for matching results)
- `url`: durable Markdown URL
- `label`: display/alt text
- `kind`: `image`, `video`, or `file`
- `markdown`: complete Markdown to insert; when supplied it takes precedence over the other formatting fields

Without `markdown`, Slate emits:

```markdown
![label](url)
!video[label](url)
[label](url)
```

When a host callback is installed, handled files are not written into Slate's IndexedDB and do not receive `attachment://...` URLs.

Passing `null` to `editor.setAttachmentHandler(null)` restores standalone IndexedDB storage.
