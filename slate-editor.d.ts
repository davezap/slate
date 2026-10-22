export type SlateWorkspaceMode = "edit" | "preview" | "source";
export type SlateAttachmentSource = "picker" | "paste" | "drop";
export type SlateAttachmentKind = "image" | "video" | "file";

export interface SlateUploadedAttachment {
  file?: File;
  url?: string;
  label?: string;
  kind?: SlateAttachmentKind;
  markdown?: string;
}

export type SlateAttachmentHandler = (
  files: File[],
  context: { source: SlateAttachmentSource },
) => Promise<SlateUploadedAttachment[] | null | undefined>;

export type SlateUrlKind = "image" | "link";

/** Maps a Markdown URL to the URL the page should load. Return a falsy value to keep the original. */
export type SlateUrlResolver = (url: string, context: { kind: SlateUrlKind }) => string | null | undefined;

export interface SlateSaveRequestDetail {
  markdown: string;
  saveAs: boolean;
}

export interface SlateCompletionState {
  hasCheckboxes: boolean;
  total: number;
  checked: number;
  unchecked: number;
  complete: boolean;
}

export interface SlateMountOptions {
  markdown?: string;
  persist?: boolean;
  persistSettings?: boolean;
  workspaceMode?: SlateWorkspaceMode;
  outlineOpen?: boolean;
  readOnly?: boolean;
  interactiveTasks?: boolean;
  theme?: "auto" | "light" | "dark" | "paper";
  showReadyToast?: boolean;
  attachmentHandler?: SlateAttachmentHandler | null;
  resolveUrl?: SlateUrlResolver | null;
  /** false hides Slate's own outline panel so the host can draw one from getOutline(). */
  outlinePanel?: boolean;
  /** Full URL of mermaid/mermaid.js, loaded for ```mermaid diagrams. Default: next to slate.js. */
  diagramsUrl?: string;
}

export interface SlateOutlineHeading {
  id: string;
  level: number;
  /** Zero-based Markdown line of the heading. */
  line: number;
  title: string;
  checked: number;
  total: number;
  children: SlateOutlineHeading[];
}

export interface SlateOutline {
  headings: SlateOutlineHeading[];
  completion: SlateCompletionState;
}

export interface SlateCompareState {
  comparing: boolean;
  label: string;
  /** Differences not yet resolved with Keep this / Use {label}. */
  differences: number;
}

export interface SlateCompareEndDetail {
  /** 'done' (the Done button), 'host' (endCompare()), 'replaced' (setMarkdown()), 'mode', 'read-only' or 'changes' (showChanges()). */
  reason: 'done' | 'host' | 'replaced' | 'mode' | 'read-only' | 'changes';
  label: string;
  differences: number;
  markdown: string;
}

export interface SlateChangesOptions {
  /** The version changes are shown from, as in "Changes since {label}". Default "the other version". */
  label?: string;
  /** Show the changes up to this text instead of up to the document (which stays as it is). */
  to?: string | null;
  /** With `to`: its name, as in "Changes from {label} to {toLabel}". */
  toLabel?: string;
}

export interface SlateChangesState {
  showing: boolean;
  label: string;
  toLabel: string;
  /** How many separate changes there are (blocks changed together count once). */
  changes: number;
}

export interface SlateChangesEndDetail {
  /** 'done' (the Hide Changes button), 'host' (hideChanges()) or 'compare' (compare() replaced it). */
  reason: 'done' | 'host' | 'compare';
  label: string;
  toLabel: string;
}

export interface SlateEditorApi {
  readonly version: string;
  readonly host: Element;
  readonly documentComplete: boolean;
  getMarkdown(): string;
  setMarkdown(markdown: string): Promise<void>;
  getWorkspaceMode(): SlateWorkspaceMode;
  setWorkspaceMode(mode: SlateWorkspaceMode): Promise<SlateWorkspaceMode | void>;
  setReadOnly(readOnly: boolean): Promise<SlateWorkspaceMode>;
  setInteractiveTasks(enabled: boolean): boolean;
  setAttachmentHandler(handler: SlateAttachmentHandler | null): void;
  isOutlineOpen(): boolean;
  setOutlineOpen(open: boolean): void;
  getOutline(): SlateOutline;
  revealLine(line: number): void;
  /** The zero-based Markdown line at the top of the view, in any mode. */
  getTopLine(): number;
  /**
   * Edit and Source modes: selects [start, end) (offsets into getMarkdown()) and scrolls it to the
   * middle of the view. `focus: false` leaves the keyboard focus where it is.
   */
  selectSourceRange(start: number, end?: number, options?: { focus?: boolean }): void;
  /** The cursor or selection as [start, end] offsets into getMarkdown(); kept while in Preview. */
  getSourceSelection(): [number, number];
  /**
   * Puts a saved place back: the cursor or selection without scrolling to it, then `topLine`
   * (zero-based) at the top of the view, in any mode. `focus` focuses the editor in Edit and Source.
   */
  restoreView(view: { selection?: [number, number] | null; topLine?: number; focus?: boolean }): void;
  /** Highlights find matches in Edit and Source; `current` is the index of the one to emphasise. Pass [] to clear. */
  setSourceHighlights(ranges: [number, number][], current?: number): void;
  /**
   * Shows `markdown` (another version of this document, such as the copy on a server) inline:
   * text only in that version is red, text only in this document green, and each difference has
   * "Keep this" / "Use {label}" buttons. Switches to Source while comparing; the document stays
   * editable and saves as usual. Ends on Done, endCompare(), setMarkdown(), a mode change or
   * setReadOnly(true), firing `slate:compare-end`. Rejects while read only.
   */
  compare(markdown: string, options?: { label?: string }): Promise<SlateCompareState>;
  /** Ends the comparison, keeping the document as it stands; returns what was left. */
  endCompare(): SlateCompareState;
  isComparing(): boolean;
  getCompareState(): SlateCompareState;
  /**
   * Shows, read only and in place of the document, how it differs from `markdown` (an earlier
   * version), or with `to`, how `to` differs from `markdown`. Preview draws the rendered text with
   * removed words struck through in red and added words in green; Edit and Source show the
   * Markdown the same way. Works while read only, and follows mode changes. Ends on Hide Changes,
   * hideChanges() or compare(), firing `slate:changes-end`. setMarkdown() redraws it when it
   * shows changes up to the document.
   */
  showChanges(markdown: string, options?: SlateChangesOptions): Promise<SlateChangesState>;
  /** Goes back to the document; returns what was shown. */
  hideChanges(): SlateChangesState;
  isShowingChanges(): boolean;
  getChangesState(): SlateChangesState;
  /**
   * Shows a "± Changes" toggle in the toolbar (also while read only, alone): turning it on calls
   * `handler`, which shows the changes it chooses with showChanges(); turning it off hides them.
   * Pass null to remove it.
   */
  setChangesToggle(handler: (() => unknown | Promise<unknown>) | null): void;
  isDocumentComplete(): boolean;
  getCompletionState(): SlateCompletionState;
  onDocumentComplete(
    callback: (state: SlateCompletionState) => void,
    options?: { immediate?: boolean },
  ): () => void;
  focus(): void;
}

export interface SlateEditorFacade {
  readonly ready: Promise<SlateEditorApi>;
  readonly documentComplete: boolean;
  readonly version?: string;
  readonly host?: Element;
  mount(target: Element | string, options?: SlateMountOptions): Promise<SlateEditorApi>;
  setAttachmentHandler(handler: SlateAttachmentHandler | null): void;
}

declare global {
  interface Window {
    SlateMarkdownEditor: SlateEditorFacade & Partial<SlateEditorApi>;
  }
}
