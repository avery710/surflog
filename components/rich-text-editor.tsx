"use client";

/**
 * Plain contentEditable notes editor — bullets/numbered/bold/italic/underline, a
 * "- " shortcut for bullets, "->" for an arrow and Tab / Shift+Tab to nest
 * list items. Ported from reference/surf-journal.html rather
 * than pulling in Tiptap/Lexical/etc.: the schema only needs a handful of
 * tags (see lib/rich-text.ts), and CLAUDE.md's bug list already paid down
 * the caret-restoration issue this exact interaction hits.
 *
 * Uncontrolled by design — contentEditable + React controlled value fights
 * the cursor. Force a reset by changing `resetKey` (remounts the div).
 */
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Bold, Italic, List, ListOrdered, Underline } from "lucide-react";
import { cn } from "cn";
import { Tooltip } from "@/components/tooltip";
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
  const arrowPending = useRef(false);

  const emit = () => {
    if (!ref.current) return;
    onChangeHtml?.(sanitizeNotesHtml(ref.current.innerHTML));
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if ((e.nativeEvent as InputEvent).isComposing) return;
    if (arrowPending.current) {
      arrowPending.current = false;
      makeArrow();
    }
    emit();
  };

  const runCmd = (cmd: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false);
    emit();
  };

  // Markdown-ish "- " shortcut: a "-" alone at the start of a line, then a
  // space, turns the line into a bullet. A native listener, not React's
  // onBeforeInput: that one is built on the legacy `textInput` event, which
  // has no `inputType`, so the check below never matched and the shortcut
  // was dead. CLAUDE.md: needs the caret restored explicitly after
  // deleteContents() or the list command silently no-ops.
  //
  // Also "->" becomes "→", like autocorrect: the ">" goes in as typed, then
  // the input handler swaps the pair through insertText, so the first
  // Ctrl/Cmd+Z gives back a literal "->".
  const onTypeShortcut = useEffectEvent((e: InputEvent) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return;
    if (e.isComposing || e.inputType !== "insertText") return;

    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (e.data === ">") {
      arrowPending.current =
        node.nodeType === Node.TEXT_NODE &&
        range.startOffset > 0 &&
        node.textContent?.[range.startOffset - 1] === "-";
      return;
    }
    if (e.data !== " ") return;
    if (node.nodeType !== Node.TEXT_NODE || node.textContent?.slice(0, range.startOffset) !== "-") return;
    // Start of a line only, and not already in a list (the command would
    // toggle the list off instead).
    const prev = node.previousSibling;
    if (prev && prev.nodeName !== "BR") return;
    if (node.parentElement?.closest("li")) return;

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
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("beforeinput", onTypeShortcut);
    return () => el.removeEventListener("beforeinput", onTypeShortcut);
  }, []);

  // Tab / Shift+Tab nest and un-nest the bullet or numbered item the caret
  // is in. Outside a list Tab is left alone, so it still moves focus.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || e.nativeEvent.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !ref.current) return;
    const anchor = sel.getRangeAt(0).startContainer;
    const start = anchor.nodeType === Node.ELEMENT_NODE ? (anchor as Element) : anchor.parentElement;
    const li = start?.closest("li");
    if (!li || !ref.current.contains(li)) return;
    e.preventDefault();
    if (e.shiftKey ? outdentItem(li, sel) : indentItem(li, sel)) emit();
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
        "rounded-[9px] border border-transparent bg-secondary transition-colors focus-within:border-ring focus-within:bg-background",
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
        <ToolbarButton label={t("editor.underline")} onClick={() => runCmd("underline")}>
          <Underline className="size-3.5" />
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
          "editor-content font-sans px-4 py-2.5 text-[15px] leading-[1.6] outline-none",
          minHeightClassName
        )}
        onInput={handleInput}
        onCompositionEnd={emit}
        onKeyDown={handleKeyDown}
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
    <Tooltip tip={label}>
    <button
      type="button"
      aria-label={label}
      // keep the caret in the editor on mousedown, then run the command
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded-full px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
    >
      {children}
    </button>
    </Tooltip>
  );
}

/** Keeps the selection across a DOM move (moving a node collapses any range
 *  inside it). The containers live inside the moved item, so they survive. */
function keepSelection(sel: Selection, move: () => void) {
  const r = sel.getRangeAt(0);
  const { startContainer, startOffset, endContainer, endOffset } = r;
  move();
  const next = document.createRange();
  next.setStart(startContainer, startOffset);
  next.setEnd(endContainer, endOffset);
  sel.removeAllRanges();
  sel.addRange(next);
}

const isList = (n: Node | null): n is HTMLElement => n?.nodeName === "UL" || n?.nodeName === "OL";

/** Makes `li` the last child of a list nested in the item above it (same
 *  list type). The first item of a list has nothing to nest under. */
function indentItem(li: HTMLLIElement, sel: Selection): boolean {
  const prev = li.previousElementSibling;
  const list = li.parentElement;
  if (prev?.nodeName !== "LI" || !list) return false;
  keepSelection(sel, () => {
    let sub = prev.lastChild;
    if (!isList(sub)) {
      sub = document.createElement(list.nodeName.toLowerCase());
      prev.appendChild(sub);
    }
    sub.appendChild(li); // its own sub-items travel with it
  });
  return true;
}

/** Moves a nested `li` out to sit after its parent item; the items below it
 *  in the same sub-list become its children. Top-level items stay put. */
function outdentItem(li: HTMLLIElement, sel: Selection): boolean {
  const list = li.parentElement;
  const parentLi = list?.parentElement;
  if (!list || parentLi?.nodeName !== "LI") return false;
  keepSelection(sel, () => {
    const after: Element[] = [];
    for (let n = li.nextElementSibling; n; n = n.nextElementSibling) after.push(n);
    if (after.length) {
      let sub = li.lastChild;
      if (!isList(sub)) {
        sub = document.createElement(list.nodeName.toLowerCase());
        li.appendChild(sub);
      }
      for (const n of after) sub.appendChild(n);
    }
    parentLi.after(li);
    if (!list.children.length) list.remove();
  });
  return true;
}

/** Replaces the "->" just before the caret with "→" (see onTypeShortcut). */
function makeArrow() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE || range.startOffset < 2) return;
  if (node.textContent?.slice(range.startOffset - 2, range.startOffset) !== "->") return;
  const pair = range.cloneRange();
  pair.setStart(node, range.startOffset - 2);
  sel.removeAllRanges();
  sel.addRange(pair);
  document.execCommand("insertText", false, "→");
}
