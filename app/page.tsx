"use client";

import { useState, useRef, useCallback } from "react";
import Editor from "@/app/components/editor";
import Sidebar from "@/app/components/sidebar";
import PricingSection from "@/components/pricing-section";
import FAQSection from "@/components/faq-section";
import CTASection from "@/components/cta-section";
import Header from "./components/header";
import FooterSection from "@/components/footer-section";
import HeroBanner from "@/components/hero-banner";

export default function Home() {
  const [content, setContent] = useState("");
  const [isEditorSidebarOpen, setIsEditorSidebarOpen] = useState(false);
  const editorRef = useRef<any>(null);

  const toggleEditorSidebar = useCallback(() => {
    setIsEditorSidebarOpen(!isEditorSidebarOpen);
  }, [isEditorSidebarOpen]);

  const closeEditorSidebar = () => {
    setIsEditorSidebarOpen(false);
  };

  const handleLoadVersion = useCallback((versionNumber: number) => {
    // This will be called from the sidebar when a version is clicked
    // The editor will handle the actual loading
    console.log("Page: handleLoadVersion called with:", versionNumber);
    console.log("Page: editorRef.current:", editorRef.current);
    if (editorRef.current) {
      console.log("Page: Calling editor.loadFromVersion");
      editorRef.current.loadFromVersion(versionNumber);
    } else {
      console.log("Page: editorRef.current is null");
    }
  }, []);

  const handleLoadDocument = useCallback((documentId: string) => {
    console.log("Page: handleLoadDocument called with:", documentId);
    // This will be called from the sidebar when a document is clicked
    // The editor will handle loading the latest version
    if (editorRef.current) {
      console.log("Page: Calling editor.loadDocument");
      editorRef.current.loadDocument(documentId);
    } else {
      console.log("Page: editorRef.current is null");
    }
  }, []);

  console.log("Page: Functions defined:", {
    handleLoadVersion: typeof handleLoadVersion,
    handleLoadDocument: typeof handleLoadDocument,
  });

  return (
    <>
      <div className="block">
        <Editor
          ref={editorRef}
          content={content}
          setContent={setContent}
          onSidebarToggle={toggleEditorSidebar}
        />
        <Header />
      </div>
      {handleLoadVersion && handleLoadDocument && (
        <Sidebar
          isOpen={isEditorSidebarOpen}
          onClose={closeEditorSidebar}
          onLoadVersion={handleLoadVersion}
          onLoadDocument={handleLoadDocument}
        />
      )}

      <HeroBanner />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <FooterSection />
    </>
  );
}
