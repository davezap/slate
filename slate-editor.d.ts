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
  reason: 'done' | 'host' | 'replaced' | 'mode' | 'read-only' | 'changes' | 'fill';
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
  /** 'done' (the Hide Changes button), 'host' (hideChanges()), 'compare' or 'fill' (compare() or startFill() replaced it). */
  reason: 'done' | 'host' | 'compare' | 'fill';
  label: string;
  toLabel: string;
}

export type SlateFieldType = 'text' | 'textarea' | 'number' | 'date' | 'time' | 'email' | 'phone' | 'choice' | 'select' | 'yesno' | 'sign';

export interface SlateFormField {
  type: SlateFieldType;
  /** The answer's key. */
  name: string;
  /** The field's label, or its name with spaces. */
  label: string;
  required: boolean;
  /** A choice that takes several options (its answer is a list). */
  multi: boolean;
  /** A choice's or select's options, in order. */
  options: string[];
}

/** A form template (front matter with form, title and submitTo; fields as {{type name=…}} tokens). */
export interface SlateForm {
  form: string;
  title: string;
  /** owner/space/folder/ the server files copies in. */
  submitTo: string;
  /** The template's first mistake, or ''. A form with one can't be filled in. */
  error: string;
  fields: SlateFormField[];
}

/** Answers by field name: text, or a list of options for a choice with multi; a signature is 'true'. */
export type SlateFormAnswers = Record<string, string | string[]>;

export interface SlateFormProblem {
  name: string;
  message: string;
}

export interface SlateFillOptions {
  /** Answers to start from, such as a saved draft; unknown fields and options are dropped. */
  answers?: SlateFormAnswers;
  /** The Send button's text. Default "Send". */
  submitLabel?: string;
  /** false hides Send, for a host that sends some other way. */
  submit?: boolean;
  /** A message for the bar, such as "Draft from yesterday". */
  status?: string;
  /**
   * The form is the document's Preview: Slate switches to Preview if needed, keeps the Edit /
   * Preview / Source switch and has no Stop Filling In. Leaving Preview ends it with reason
   * 'mode'; the host starts it again on `slate:mode-change` back to Preview. (0.19.0)
   */
  inPreview?: boolean;
  /** The fields show greyed out and can't be changed, and there is no Send: for a page that can't send it. (0.19.0) */
  readOnly?: boolean;
}

export interface SlateModeChangeDetail {
  mode: SlateWorkspaceMode;
  previous: SlateWorkspaceMode;
}

export interface SlateFillState {
  filling: boolean;
  inPreview?: boolean;
  readOnly?: boolean;
  form: SlateForm | null;
  answers: SlateFormAnswers;
}

export interface SlateFormSubmitDetail {
  form: string;
  title: string;
  answers: SlateFormAnswers;
}

export interface SlateFillEndDetail {
  /** 'done' (Stop Filling In), 'host' (endFill()), 'replaced' (setMarkdown() with a text that is no form), 'compare', 'changes' or 'mode' (left Preview, with inPreview). */
  reason: 'done' | 'host' | 'replaced' | 'compare' | 'changes' | 'mode';
  form: string;
  /** The answers when it ended, for keeping as a draft. */
  answers: SlateFormAnswers;
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
  /** The document (or `markdown`) as a form template, or null when it is not one. */
  getForm(markdown?: string): SlateForm | null;
  /** Whether the document (or `markdown`) is a form template: front matter with form and no submittedAt. */
  isForm(markdown?: string): boolean;
  /**
   * Fill mode: the form drawn as in Preview, with inputs for its fields and its <!-- comments -->
   * as hints, in place of the document (which stays as it is). Send checks every answer and fires
   * `slate:form-submit` when they pass; the host sends them. Rejects when the document is not a
   * form or the template has a mistake. setMarkdown() redraws it, keeping the answers. Ends on
   * Stop Filling In, endFill(), compare() or showChanges(), firing `slate:fill-end`; with
   * `inPreview`, also on leaving Preview. Starting it again while filling replaces it silently.
   */
  startFill(options?: SlateFillOptions): Promise<SlateFillState>;
  /** Back to the document; returns the answers. */
  endFill(): SlateFormAnswers;
  isFilling(): boolean;
  getFillState(): SlateFillState;
  getFormAnswers(): SlateFormAnswers;
  setFormAnswers(answers: SlateFormAnswers): Promise<SlateFormAnswers>;
  /** Checks every answer as the server will, shows the problems by their fields and returns them. */
  checkForm(): SlateFormProblem[];
  /** Shows problems by field (the server's); returns those naming fields the form doesn't have. */
  setFormProblems(problems: SlateFormProblem[]): SlateFormProblem[];
  /** A message in the bar; kind 'error' or 'done' colours it, busy disables Send. */
  setFormStatus(text: string, options?: { kind?: 'error' | 'done' | ''; busy?: boolean }): void;
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
