"use client"

import { createContext } from "react"

// Routes portal their controls here without owning or remounting the chrome.
export const AppHeaderTargetContext = createContext<HTMLElement | null>(null)
