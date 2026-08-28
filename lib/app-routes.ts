import {
  BookOpenTextIcon,
  CalendarClockIcon,
  CalculatorIcon,
  HistoryIcon,
  PlusIcon,
  Settings2Icon,
  UploadIcon,
} from "lucide-react"

export const appCommandPages = [
  {
    title: "Current Month",
    href: "/month-end",
    section: "Month End",
    keywords: ["month end", "dashboard", "current"],
    icon: CalendarClockIcon,
  },
  {
    title: "Previous Months",
    href: "/previous-month-ends",
    section: "Month End",
    keywords: ["history", "archive", "closed"],
    icon: HistoryIcon,
  },
  {
    title: "Create Month End",
    href: "/month-end/new",
    section: "Month End",
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
    title: "Quote Tool",
    href: "/quote-tool",
    section: "Utilities",
    keywords: ["quote", "pricing", "calculator"],
    icon: CalculatorIcon,
  },
  {
    title: "Pricing Upload",
    href: "/pricing-upload",
    section: "Settings",
    keywords: ["prices", "import", "upload"],
    icon: UploadIcon,
  },
  {
    title: "Modules",
    href: "/template-builder",
    section: "Settings",
    keywords: ["template", "builder", "settings"],
    icon: Settings2Icon,
  },
]
