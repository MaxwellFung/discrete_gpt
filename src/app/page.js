"use client";
import Head from "next/head";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import "katex/dist/katex.min.css";

// 🔹 Custom CodeBlock component with Copy button
function CodeBlock({ className, children, ...props }) {
  const match = /language-(\w+)/.exec(className || "");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(String(children).trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!match) {
    // Inline code
    return (
      <code
        className={className}
        style={{
          background: "#f5f5f5",
          padding: "2px 4px",
          borderRadius: "4px",
          fontSize: "8pt",
          fontFamily: "Courier New, monospace",
        }}
        {...props}
      >
        {children}
      </code>
    );
  }

  // Block code
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={handleCopy}
        style={{
          position: "absolute",
          top: "6px",
          right: "8px",
          fontSize: "11px",
          background: "transparent",
          border: "none",
          color: "black",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        {copied ? (
          <>
            ✅ <span>Copied</span>
          </>
        ) : (
          <>
            📋 <span>Copy Code</span>
          </>
        )}
      </button>
      <SyntaxHighlighter
        language={match[1]}
        PreTag="div"
        customStyle={{
          fontSize: "8pt",
          borderRadius: "6px",
        }}
        {...props}
      >
        {String(children).replace(/\n$/, "")}
      </SyntaxHighlighter>
    </div>
  );
}

export default function Home() {
  const [title, setTitle] = useState("Discrete GPT");
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [submitStatus, setSubmitStatus] = useState("idle"); // idle, generating, done
  const [dotCount, setDotCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [showIntro, setShowIntro] = useState(true);
  const [abortController, setAbortController] = useState(null);

  const secondPageRef = useRef(null);
  const textareaRef = useRef(null);
  const containerRef = useRef(null);

  const lineHeight = 24;
  const maxLines = 10;

  // Animate dots
  useEffect(() => {
    let interval;
    if (submitStatus === "generating") {
      interval = setInterval(() => {
        setDotCount((prev) => (prev < 3 ? prev + 1 : 0));
      }, 500);
    }
    return () => clearInterval(interval);
  }, [submitStatus]);

  // Word count
  useEffect(() => {
    if (response) {
      const words = response.trim().split(/\s+/);
      setWordCount(words.length > 0 && words[0] !== "" ? words.length : 0);
    } else {
      setWordCount(0);
    }
  }, [response]);

  const handleSubmit = async (force = false) => {
    if (!prompt.trim()) return;
  
    if (submitStatus === "generating" && !force) return;
  
    setSubmitStatus("generating");
    setResponse("");
    setWordCount(0);
  
    const controller = new AbortController();
    setAbortController(controller);
  
    try {
      const response = await fetch("/api/deepseek_query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: prompt }),
        signal: controller.signal,
      });
  
      if (!response.ok) throw new Error(`API error: ${response.status}`);
  
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";
  
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
  
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
  
        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const jsonData = JSON.parse(line.slice(6));
              if (jsonData.choices && jsonData.choices[0].delta.content) {
                const newContent = jsonData.choices[0].delta.content;
                accumulatedText += newContent;
                setResponse((prev) => prev + newContent);
              }
            } catch {
              // ignore incomplete JSON
            }
          }
        }
      }
  
      setSubmitStatus("done");
      setTimeout(() => {
        scrollToNextPage();
      }, 100);
    } catch (error) {
      if (error.name === "AbortError") {
        setResponse((prev) => prev + "\n\n[Terminated early]");
      } else {
        console.error("API call failed:", error);
        setResponse(`Error: Failed to generate response. ${error.message}`);
      }
      setSubmitStatus("done");
    }
  };
  
  

  const handleReset = () => {
    setPrompt("");
    setResponse("");
    setSubmitStatus("idle");
    setWordCount(0);
    if (containerRef.current) containerRef.current.scrollTop = 0;
  };

  const scrollToNextPage = () => {
    secondPageRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getStatusMessage = () => {
    if (submitStatus === "generating") {
      return (
        <div style={{ color: "#1a73e8", marginTop: "8px" }}>
          {wordCount} words generated - check next page{" "}
          <span style={{ color: "#1a73e8" }}>
            (or press Ctrl + R to terminate)
          </span>
        </div>
      );
    }
    if (submitStatus === "done") {
      return (
        <div style={{ color: "#1a73e8", marginTop: "8px" }}>
          Done, scroll to next page! Ctrl + R to reset
        </div>
      );
    }
    return null;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit(true); // pass a flag to "force requery"
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") {
        e.preventDefault();
        if (submitStatus === "generating" && abortController) {
          abortController.abort();
        } else {
          handleReset();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [submitStatus, prompt, abortController]);


  // Auto-resize textarea
  const handleTextareaChange = (e) => {
    setPrompt(e.target.value);

    const textarea = e.target;
    textarea.style.height = "auto";
    const newHeight = Math.min(textarea.scrollHeight, lineHeight * maxLines);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > lineHeight * maxLines ? "auto" : "hidden";
  };

  return (
    <div
      ref={containerRef}
      style={{
        fontFamily: "Roboto, Arial, sans-serif",
        color: "#202124",
        background: "#f8f9fa",
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Head>
        <title>{title} - Google Docs (lookalike)</title>
      </Head>

      {/* Top bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          padding: "8px 12px",
          background: "#fff",
          borderBottom: "1px solid #dadce0",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            aria-label="Docs logo"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "6px",
              background: "#1a73e8",
            }}
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              fontSize: "18px",
              border: "1px solid transparent",
              borderRadius: "4px",
              padding: "2px 6px",
              width: "240px",
              color: "#202124",
            }}
          />
        </div>
      </div>

      {/* Workspace */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          justifyContent: "center",
          padding: "24px 0",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {/* Page 1: Prompt */}
          <div
            style={{
              width: "792px",
              minHeight: "1020px",
              margin: "0 auto",
              background: "#fff",
              border: "1px solid #eee",
              boxShadow:
                "0 1px 2px rgba(0,0,0,.06), 0 2px 12px rgba(0,0,0,.06)",
              outline: "none",
              position: "relative",
              cursor: "text",
            }}
            onClick={() => {
              if (textareaRef.current) {
                textareaRef.current.focus();
              }
            }}
          >
            <div style={{ padding: "96px", minHeight: "100%" }}>
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={handleTextareaChange}
                placeholder="Ctrl + Enter to submit..."
                rows={1}
                style={{
                  width: "100%",
                  border: "none",
                  outline: "none",
                  resize: "none",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  lineHeight: `${lineHeight}px`,
                  maxHeight: `${lineHeight * maxLines}px`,
                  overflowY: "hidden",
                  background: "transparent",
                }}
              />
              <div style={{ marginTop: "4px" }}>{getStatusMessage()}</div>
            </div>
          </div>

          {/* Page 2: Response */}
          <div ref={secondPageRef}>
            <div
              style={{
                width: "792px",
                minHeight: "1020px",
                margin: "0 auto",
                background: "#fff",
                border: "1px solid #eee",
                boxShadow:
                  "0 1px 2px rgba(0,0,0,.06), 0 2px 12px rgba(0,0,0,.06)",
                outline: "none",
              }}
            >
              <div
                style={{
                  padding: "96px",
                  fontFamily: "'Times New Roman', serif",
                  fontSize: "12pt",
                  lineHeight: "1.5",
                  color: "#000",
                }}
              >
                {response ? (
                  <ReactMarkdown
                    children={response}
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      code: CodeBlock,
                      h1: ({ children }) => (
                        <h1 style={{ fontSize: "16pt", fontWeight: "bold" }}>
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 style={{ fontSize: "14pt", fontWeight: "bold" }}>
                          {children}
                        </h2>
                      ),
                    }}
                  />
                ) : (
                  "Response will appear here after submission..."
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
