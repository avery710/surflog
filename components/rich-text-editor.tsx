"use client";

/**
 * Plain contentEditable notes editor — bullets/numbered/bold/italic plus a
 * "- " shortcut for bullets. Ported from reference/surf-journal.html rather
 * than pulling in Tiptap/Lexical/etc.: the schema only needs a handful of
 * tags (see lib/rich-text.ts), and CLAUDE.md's bug list already paid down
 * the caret-restoration issue this exact interaction hits.
 *
 * Uncontrolled by design — contentEditable + React controlled value fights
 * the cursor. Force a reset by changing `resetKey` (remounts the div).
 */
import { useRef, useState } from "react";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { cn } from "cn";
import { sanitizeNotesHtml } from "@/lib/rich-text";
import { useLang } from "@/lib/i18n";

interface RichTextEditorProps {
  defaultHtml?: string;
  placeholder?: string;
  resetKey?: string | number;
  onChangeHtml?: (html: string) => void;
  className?: string;
  minHeightClassName?: string;
}

export function RichTextEditor({
  defaultHtml = "",
  placeholder,
  onChangeHtml,
  className,
  minHeightClassName = "min-h-26",
}: RichTextEditorProps) {
  const { t } = useLang();
  const ref = useRef<HTMLDivElement>(null);
  // Frozen at mount: if __html changed on re-render, React would rewrite the
  // DOM mid-typing, wiping IME composition (Zhuyin/Cangjie) and the caret.
  const [initialHtml] = useState(defaultHtml);

  const emit = () => {
    if (!ref.current) return;
    onChangeHtml?.(sanitizeNotesHtml(ref.current.innerHTML));
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if ((e.nativeEvent as InputEvent).isComposing) return;
    emit();
  };

  const runCmd = (cmd: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false);
    emit();
  };

  // Markdown-ish "- " shortcut: typing "- " at the start of a line turns it
  // into a bullet list, using the same execCommand-based approach as the
  // toolbar. CLAUDE.md: needs the caret restored explicitly after
  // deleteContents() or the list command silently no-ops.
  const handleBeforeInput = (e: React.InputEvent<HTMLDivElement> | React.FormEvent<HTMLDivElement>) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return;
    const native = e.nativeEvent as unknown as InputEvent;
    if (native.isComposing || native.inputType !== "insertText" || native.data !== " ") return;

    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    const text = node.textContent?.slice(0, range.startOffset) ?? "";
    if (text !== "-") return;

    e.preventDefault();
    const delRange = range.cloneRange();
    delRange.setStart(node, range.startOffset - 1);
    delRange.deleteContents();
    // restore the caret into the now-shortened text node before issuing the
    // list command, or insertUnorderedList silently no-ops.
    sel.removeAllRanges();
    sel.addRange(delRange);
    document.execCommand("insertUnorderedList", false);
    emit();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    emit();
  };

  return (
    <div
      className={cn(
        "rounded-[14px] border border-transparent bg-secondary transition-colors focus-within:border-ring focus-within:bg-background focus-within:ring-4 focus-within:ring-ring/15",
        className
      )}
    >
      <div className="flex flex-wrap gap-1 px-2 pt-2">
        <ToolbarButton label={t("editor.bullets")} onClick={() => runCmd("insertUnorderedList")}>
          <List className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton label={t("editor.numbered")} onClick={() => runCmd("insertOrderedList")}>
          <ListOrdered className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton label={t("editor.bold")} onClick={() => runCmd("bold")}>
          <Bold className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton label={t("editor.italic")} onClick={() => runCmd("italic")}>
          <Italic className="size-3.5" />
        </ToolbarButton>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={t("form.notes")}
        data-placeholder={placeholder ?? t("editor.placeholder")}
        className={cn(
          "editor-content font-serif px-4 py-2.5 text-[16.5px] leading-[1.62] outline-none",
          minHeightClassName
        )}
        onInput={handleInput}
        onCompositionEnd={emit}
        onBeforeInput={handleBeforeInput}
        onPaste={handlePaste}
        dangerouslySetInnerHTML={{ __html: initialHtml }}
      />
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // keep the caret in the editor on mousedown, then run the command
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded-full px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
    >
      {children}
    </button>
  );
}
