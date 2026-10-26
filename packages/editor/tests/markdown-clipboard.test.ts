/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Editor, Extension } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
// plugins
import { getCodeBlockPlainText, MarkdownClipboardPlugin } from "../src/core/plugins/markdown-clipboard";

const CONTENT = '<p>Run this:</p><pre><code class="language-sh">ls -la\necho "done"</code></pre><p>then wait.</p>';

let editor: Editor | undefined;

const makeEditor = () => {
  editor = new Editor({ extensions: [StarterKit], content: CONTENT });
  return editor;
};

/** Document positions of the code block node and of its text content. */
const codeBlockRange = (e: Editor) => {
  let found: { pos: number; size: number } | undefined;
  e.state.doc.descendants((node, pos) => {
    if (node.type.name === "codeBlock") found = { pos, size: node.nodeSize };
    return !found;
  });
  if (!found) throw new Error("no code block in fixture");
  return { nodePos: found.pos, textFrom: found.pos + 1, textTo: found.pos + found.size - 1 };
};

afterEach(() => {
  editor?.destroy();
  editor = undefined;
});

describe("getCodeBlockPlainText", () => {
  it("copies a selection inside a code block verbatim, with no Markdown fences", () => {
    const e = makeEditor();
    const { textFrom, textTo } = codeBlockRange(e);
    const selection = TextSelection.create(e.state.doc, textFrom, textTo);

    const text = getCodeBlockPlainText(selection);

    expect(text).toBe('ls -la\necho "done"');
    expect(text).not.toContain("`");
  });

  it("copies part of a code block exactly as selected", () => {
    const e = makeEditor();
    const { textFrom } = codeBlockRange(e);
    const selection = TextSelection.create(e.state.doc, textFrom, textFrom + "ls -la".length);

    expect(getCodeBlockPlainText(selection)).toBe("ls -la");
  });

  it("copies a whole selected code block as its code", () => {
    const e = makeEditor();
    const { nodePos } = codeBlockRange(e);
    const selection = NodeSelection.create(e.state.doc, nodePos);

    expect(getCodeBlockPlainText(selection)).toBe('ls -la\necho "done"');
  });

  it("keeps the Markdown conversion for selections that leave the code block", () => {
    const e = makeEditor();
    const { textTo } = codeBlockRange(e);
    const selection = TextSelection.create(e.state.doc, 1, textTo);

    expect(getCodeBlockPlainText(selection)).toBeNull();
  });

  it("keeps the Markdown conversion for ordinary text and empty selections", () => {
    const e = makeEditor();

    expect(getCodeBlockPlainText(TextSelection.create(e.state.doc, 1, 4))).toBeNull();
    expect(getCodeBlockPlainText(TextSelection.create(e.state.doc, 2, 2))).toBeNull();
  });
});

/** Run the plugin's real copy handler against a fake clipboard. */
const copyWithPlugin = (e: Editor, from: number, to: number) => {
  const plugin = MarkdownClipboardPlugin({
    editor: e,
    getEditorMetaData: () => ({ file_assets: [], user_mentions: [] }),
  });
  e.view.dispatch(e.state.tr.setSelection(TextSelection.create(e.state.doc, from, to)));
  const data: Record<string, string> = {};
  const event = {
    preventDefault: () => {},
    clipboardData: {
      clearData: () => {},
      setData: (type: string, value: string) => {
        data[type] = value;
      },
    },
  } as unknown as ClipboardEvent;
  const copy = plugin.props.handleDOMEvents?.copy as (view: unknown, event: ClipboardEvent) => boolean;
  expect(copy(e.view, event)).toBe(true);
  return data;
};

describe("MarkdownClipboardPlugin copy", () => {
  it("puts plain code, without fences, on the text clipboard for a code-block selection", () => {
    const e = new Editor({ extensions: [StarterKit, Extension.create({ name: "noop" })], content: CONTENT });
    editor = e;
    const { textFrom, textTo } = codeBlockRange(e);

    const data = copyWithPlugin(e, textFrom, textTo);

    expect(data["text/plain"]).toBe('ls -la\necho "done"');
    expect(data["text/html"]).toBeTruthy();
  });

  it("still copies Markdown for a selection that spans prose and code", () => {
    const e = makeEditor();
    const { textTo } = codeBlockRange(e);

    const data = copyWithPlugin(e, 1, textTo);

    expect(data["text/plain"]).toContain("Run this:");
    expect(data["text/plain"]).toContain("```");
  });
});
