import { mergeAttributes, Node } from "@tiptap/core"

export const KnowledgeDefiners = Node.create({
  name: "knowledgeDefiners",
  group: "block",
  atom: true,
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      country: { default: "Shared" },
      pageType: { default: "Knowledge" },
      status: { default: "AI maintained" },
    }
  },

  parseHTML() {
    return [{ tag: "div[data-knowledge-definers]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-knowledge-definers": "",
        contenteditable: "false",
      }),
      [
        "table",
        {},
        [
          "tbody",
          {},
          ["tr", {}, ["th", {}, "Country"], ["td", {}, HTMLAttributes.country]],
          [
            "tr",
            {},
            ["th", {}, "Page type"],
            ["td", {}, HTMLAttributes.pageType],
          ],
          [
            "tr",
            {},
            ["th", {}, "Management"],
            ["td", {}, HTMLAttributes.status],
          ],
        ],
      ],
    ]
  },
})
