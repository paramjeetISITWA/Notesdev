"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Heart, Plus, LogIn, Menu } from "lucide-react"
import { useEditorContext } from "@/hooks/use-editor-context"



export default function Header() {
  const { clearEditor } = useEditorContext()

  const handleNewNote = () => {
    clearEditor()
  }

  return (
    <>
      <header className="border-y border-gray-200 bg-white sticky top-0 z-50  ">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between ">
          {/* Logo and Navigation */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-4">

              <div className="flex items-center gap-2">
                {/* Logo Icon */}
                <div className="flex gap-1">
                  <div className="w-2 h-6 bg-pink-500 rounded-sm"></div>
                  <div className="w-2 h-6 bg-blue-500 rounded-sm"></div>
                  <div className="w-2 h-6 bg-yellow-400 rounded-sm"></div>
                </div>
                <span className="text-xl font-bold text-gray-900"><a href="/">OpenBun Notes</a></span>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="hidden md:flex gap-6">
              {/* <a href="/notes" className="text-gray-600 hover:text-gray-900 font-medium">
                Notes
              </a> */}
              <a href="/about" className="text-gray-600 hover:text-gray-900 font-medium">
                About
              </a>
              <a href="/changelog" className="text-gray-600 hover:text-gray-900 font-medium">
                Changelog
              </a>
              <a href="/contact" className="text-gray-600 hover:text-gray-900 font-medium">
                Contact
              </a>
            </nav>
          </div>

          {/* Right Side Buttons */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-2 bg-transparent">
              <LogIn className="w-4 h-4" />
              Sign In
            </Button>
          </div>
        </div>
      </header>
    </>
  )
}
