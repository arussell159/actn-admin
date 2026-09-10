import {
  BookOpenTextIcon,
  CalculatorIcon,
  HistoryIcon,
  LibraryBigIcon,
  LayoutTemplateIcon,
  PlusIcon,
  Settings2Icon,
} from "lucide-react"
import { certificateLayoutsHref } from "@/lib/certificate-layout/routes"

export const settingsPages = [
  {
    title: "Accounting",
    href: "/template-builder",
    section: "Settings",
    keywords: [
      "template",
      "builder",
      "settings",
      "tasks",
      "netsuite",
      "pricing",
      "upload",
    ],
    icon: Settings2Icon,
  },
  {
    title: "Certificate",
    href: certificateLayoutsHref(),
    section: "Settings",
    keywords: ["certificate", "layouts", "fields", "sections", "country"],
    icon: LayoutTemplateIcon,
  },
]

export const appCommandPages = [
  {
    title: "Month End",
    href: "/previous-month-ends",
    section: "Accounting",
    keywords: ["month end", "history", "archive", "open", "closed"],
    icon: HistoryIcon,
  },
  {
    title: "New Month End",
    href: "/month-end/new",
    section: "Accounting",
    keywords: ["new", "period", "open"],
    icon: PlusIcon,
  },
  {
    title: "Notebook",
    href: "/information",
    section: "Utilities",
    keywords: ["notes", "folders", "information"],
    icon: BookOpenTextIcon,
  },
  {
    title: "Knowledge Base",
    href: "/knowledge-base",
    section: "Utilities",
    keywords: ["knowledge", "requirements", "rules", "documents"],
    icon: LibraryBigIcon,
  },
  {
    title: "Quote Tool",
    href: "/quote-tool",
    section: "Utilities",
    keywords: ["quote", "pricing", "calculator"],
    icon: CalculatorIcon,
  },
  ...settingsPages,
]
