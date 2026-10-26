/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Selection } from "@tiptap/pm/state";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";
// plane imports
import { convertHTMLToMarkdown } from "@plane/utils";
import type { TCustomComponentsMetaData } from "@plane/utils";

/**
 * The raw text to put on the plain-text clipboard when a copy is purely code,
 * or null to keep the Markdown conversion.
 *
 * Copying inside a code block used to produce Markdown like "```sh\n…\n```",
 * so a command pasted into a terminal carried the fences with it. A selection
 * that lies within one code block, or is exactly one whole code block, now
 * copies the code verbatim. HTML clipboard flavours are unchanged, so pasting
 * back into Plane still recreates the code block.
 */
export const getCodeBlockPlainText = (selection: Selection): string | null => {
  if (selection.empty) return null;
  const { $from, $to } = selection;
  if ($from.sameParent($to) && $from.parent.type.name === CORE_EXTENSIONS.CODE_BLOCK) {
    return $from.parent.textBetween($from.parentOffset, $to.parentOffset);
  }
  const content = selection.content().content;
  if (content.childCount === 1 && content.firstChild?.type.name === CORE_EXTENSIONS.CODE_BLOCK) {
    return content.firstChild.textContent;
  }
  return null;
};

type TArgs = {
  editor: Editor;
  getEditorMetaData: (htmlContent: string) => TCustomComponentsMetaData;
};

export const MarkdownClipboardPlugin = (args: TArgs): Plugin => {
  const { editor, getEditorMetaData } = args;

  return new Plugin({
    key: new PluginKey("markdownClipboard"),
    props: {
      handleDOMEvents: {
        copy: (view, event) => {
          try {
            event.preventDefault();
            event.clipboardData?.clearData();
            // editor meta data
            const editorHTML = editor.getHTML();
            const metaData = getEditorMetaData(editorHTML);
            // meta data from selection
            const clipboardHTML = view.serializeForClipboard(view.state.selection.content()).dom.innerHTML;
            // convert to markdown
            const markdown = convertHTMLToMarkdown({
              description_html: clipboardHTML,
              metaData,
            });
            const codeText = getCodeBlockPlainText(view.state.selection);
            event.clipboardData?.setData("text/plain", codeText ?? markdown);
            event.clipboardData?.setData("text/html", clipboardHTML);
            event.clipboardData?.setData("text/plane-editor-html", clipboardHTML);
            return true;
          } catch (error) {
            console.error("Failed to copy markdown content to clipboard:", error);
            return false;
          }
        },
      },
    },
  });
};
