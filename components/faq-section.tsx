"use client";

import { useState } from "react";

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: "What is this app and how does blockchain storage work?",
    answer:
      "This is a permanent note-taking application that stores your documents on the Arweave blockchain. When you save a note, it's uploaded to Arweave via Bundlr, ensuring your data is stored permanently, decentralized, and censorship-resistant. Your notes are accessible forever, even if our service goes down.",
  },
  {
    question: "How does Arweave permanent storage work?",
    answer:
      "Arweave is a decentralized storage network that uses blockchain technology to store data permanently. When you upload a document, you pay a one-time fee in AR (Arweave cryptocurrency) via Bundlr. Your data is then stored across thousands of nodes worldwide, ensuring it's never lost and always accessible. Unlike traditional cloud storage, there are no monthly fees - you pay once and your data is stored forever.",
  },
  {
    question: "Do I need an Arweave wallet to use this?",
    answer:
      "Yes, but it's easy! The app automatically generates an Arweave wallet for you when you first use it, or you can use your existing wallet. You'll need a small amount of AR (usually less than 0.01 AR) to pay for uploads. Each document upload costs a tiny amount of AR (typically less than $0.01). You can buy AR on exchanges like Binance or Gate.io.",
  },
  {
    question: "What happens to my notes if the app shuts down?",
    answer:
      "Your notes are stored permanently on the Arweave blockchain, not on our servers. Even if our service shuts down, your notes remain accessible forever through Arweave's decentralized network. You can access them using any Arweave gateway with your transaction ID. This is the power of blockchain storage - true data ownership.",
  },
  {
    question: "Is my data secure and private?",
    answer:
      "Yes! You can password-protect your documents with AES encryption before uploading to Arweave. The encrypted content is then stored permanently on the blockchain. Only those with the password can decrypt and read your notes. Additionally, Arweave's decentralized nature means your data is distributed across thousands of nodes, making it highly secure and resistant to censorship.",
  },
  {
    question: "How do I get started?",
    answer:
      "Getting started is simple! Just start writing in the editor. When you're ready to save permanently, click the save button. The app will automatically generate an Arweave wallet for you (or use your existing one), and guide you through funding it if needed. Once funded, your document will be uploaded to Arweave and you'll receive a transaction ID that you can use to access it forever.",
  },
];

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function FAQSection() {
  const [openItems, setOpenItems] = useState<number[]>([]);

  const toggleItem = (index: number) => {
    setOpenItems((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="w-full flex justify-center items-start">
        <div className="flex-1 px-4 md:px-12 py-16 md:py-20 flex flex-col lg:flex-row justify-start items-start gap-6 lg:gap-12">
          {/* Left Column - Header */}
          <div className="w-full lg:flex-1 flex flex-col justify-center items-start gap-4 lg:py-5">
            <div className="w-full flex flex-col justify-center text-[#000] font-semibold leading-tight md:leading-[44px] font-sans text-4xl tracking-tight">
              Frequently Asked Questions
            </div>
            <div className="w-full text-[#605A57] text-base font-normal leading-7 font-sans">
              Everything you need to know about permanent blockchain storage,
              <br className="hidden md:block" />
              Arweave, and decentralized note-taking.
            </div>
          </div>

          {/* Right Column - FAQ Items */}
          <div className="w-full lg:flex-1 flex flex-col justify-center items-center">
            <div className="w-full flex flex-col">
              {faqData.map((item, index) => {
                const isOpen = openItems.includes(index);

                return (
                  <div
                    key={index}
                    className="w-full border-b border-[rgba(73,66,61,0.16)] overflow-hidden"
                  >
                    <button
                      onClick={() => toggleItem(index)}
                      className="w-full px-5 py-[18px] flex justify-between items-center gap-5 text-left hover:bg-[rgba(73,66,61,0.02)] transition-colors duration-200"
                      aria-expanded={isOpen}
                    >
                      <div className="flex-1 text-[#000] text-base font-medium leading-6 font-sans">
                        {item.question}
                      </div>
                      <div className="flex justify-center items-center">
                        <ChevronDownIcon
                          className={`w-6 h-6 text-[rgba(73,66,61,0.60)] transition-transform duration-300 ease-in-out ${isOpen ? "rotate-180" : "rotate-0"
                            }`}
                        />
                      </div>
                    </button>

                    <div
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                        }`}
                    >
                      <div className="px-5 pb-[18px] text-[#605A57] text-sm font-normal leading-6 font-sans">
                        {item.answer}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
