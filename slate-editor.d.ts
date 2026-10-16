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
  theme?: "auto" | "light" | "dark";
  showReadyToast?: boolean;
  attachmentHandler?: SlateAttachmentHandler | null;
  resolveUrl?: SlateUrlResolver | null;
  /** false hides Slate's own outline panel so the host can draw one from getOutline(). */
  outlinePanel?: boolean;
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
