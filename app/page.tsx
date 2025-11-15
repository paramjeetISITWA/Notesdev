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
    if (editorRef.current) {
      editorRef.current.loadFromVersion(versionNumber);
    } else {
    }
  }, []);

  const handleLoadDocument = useCallback((documentId: string) => {
    if (editorRef.current) {
      editorRef.current.loadDocument(documentId);
    } else {
    }
  }, []);

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
