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
    return (
      <code
        className={className}
        style={{
          background: "#f5f5f5",
          padding: "2px 4px",
          borderRadius: "4px",
          fontSize: "8pt",
          fontFamily: "'Roboto Mono', monospace",
        }}
        {...props}
      >
        {children}
      </code>
    );
  }

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
          fontFamily: "'Google Sans', Arial, sans-serif",
        }}
      >
        {copied ? <>✅ <span>Copied</span></> : <>📋 <span>Copy Code</span></>}
      </button>
      <SyntaxHighlighter
        language={match[1]}
        PreTag="div"
        customStyle={{
          fontSize: "8pt",
          borderRadius: "6px",
          fontFamily: "'Roboto Mono', monospace",
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
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [dotCount, setDotCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [showIntro, setShowIntro] = useState(true); // 🔹 Intro modal state
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const jsonData = JSON.parse(line.slice(6));
              if (jsonData.choices?.[0]?.delta?.content) {
                const newContent = jsonData.choices[0].delta.content;
                setResponse((prev) => prev + newContent);
              }
            } catch {}
          }
        }
      }

      setSubmitStatus("done");
      setTimeout(() => scrollToNextPage(), 100);
    } catch (error) {
      if (error.name === "AbortError") {
        setResponse((prev) => prev + "\n\n[Terminated early]");
      } else {
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
        <div style={{ color: "#1a73e8", marginTop: "8px", fontFamily: "'Google Sans', Arial, sans-serif" }}>
          {wordCount} words generated - check next page{" "}
          <span style={{ color: "#1a73e8" }}>(or press Ctrl + R to terminate)</span>
        </div>
      );
    }
    if (submitStatus === "done") {
      return (
        <div style={{ color: "#1a73e8", marginTop: "8px", fontFamily: "'Google Sans', Arial, sans-serif" }}>
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
        handleSubmit(true);
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
    textarea.style.overflowY = textarea.scrollHeight > lineHeight * maxLines ? "auto" : "hidden";
  };

  return (
    <div
      ref={containerRef}
      style={{
        fontFamily: "'Google Sans', Arial, sans-serif",
        color: "#202124",
        background: "#f8f9fa",
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Google+Sans:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      {/* 🔹 Intro Modal */}
      {showIntro && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 2000,
            fontFamily: "'Google Sans', Arial, sans-serif",
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "32px",
              borderRadius: "12px",
              width: "400px",
              textAlign: "center",
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
              fontFamily: "'Google Sans', Arial, sans-serif",
            }}
          >
            <h2 style={{ marginBottom: "16px" }}>Welcome to Discrete GPT</h2>
            <p style={{ marginBottom: "12px" }}>
              Write your prompt on the first page, then press <b>Ctrl + Enter</b> to submit.
            </p>
            <p style={{ marginBottom: "20px" }}>
              Your response will appear on the next page. Use <b>Ctrl + R</b> to reset or terminate.
            </p>
            <button
              onClick={() => setShowIntro(false)}
              style={{
                padding: "10px 20px",
                background: "#1a73e8",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              Get Started
            </button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "#fff",
          borderBottom: "1px solid #dadce0",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          padding: "10px 10px",
        }}
      >
        <img
          src="/logo.png"
          alt="Logo"
          style={{ width: "35px", height: "35px", marginRight: "10px", objectFit: "contain" }}
        />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              fontSize: "18px",
              border: "1px solid transparent",
              borderRadius: "4px",
              padding: "2px 6px",
              width: "260px",
              color: "#202124",
              fontFamily: "'Google Sans', Arial, sans-serif",
              marginBottom: "2px",
              marginLeft: "-7.5px",
            }}
          />
          <div
            style={{
              display: "flex",
              gap: "10px",
              fontSize: "12px",
              color: "#202124",
              fontFamily: "'Google Sans', Arial, sans-serif",
            }}
          >
            <span>File</span>
            <span>Edit</span>
            <span>View</span>
            <span>Insert</span>
            <span>Format</span>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginRight: "5px" }}>
          <button
            style={{
              background: "#c2e7ff",
              color: "#001d35",
              border: "none",
              borderRadius: "20px",
              padding: "10px 18px",
              fontSize: "14px",
              fontWeight: 500,
              fontFamily: "'Google Sans', Arial, sans-serif",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            Share <span style={{ fontSize: "12px", marginLeft: "4px", marginTop: "-3px" }}>▾</span>
          </button>
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              background: "#F28B82",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              color: "#fff",
              fontWeight: "bold",
              fontSize: "16px",
            }}
          >
            M
          </div>
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
          {/* Page 1 */}
          <div
            style={{
              width: "792px",
              minHeight: "1020px",
              margin: "0 auto",
              background: "#fff",
              border: "1px solid #eee",
              boxShadow: "0 1px 2px rgba(0,0,0,.06), 0 2px 12px rgba(0,0,0,.06)",
              outline: "none",
              cursor: "text",
            }}
            onClick={() => textareaRef.current?.focus()}
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

          {/* Page 2 */}
          <div ref={secondPageRef}>
            <div
              style={{
                width: "792px",
                minHeight: "1020px",
                margin: "0 auto",
                background: "#fff",
                border: "1px solid #eee",
                boxShadow: "0 1px 2px rgba(0,0,0,.06), 0 2px 12px rgba(0,0,0,.06)",
                outline: "none",
              }}
            >
              <div
                style={{
                  padding: "96px",
                  fontFamily: "inherit",
                  fontSize: "12pt",
                  lineHeight: "1.6",
                  letterSpacing: "0.3px",
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
                      h1: ({ children }) => <h1 style={{ fontSize: "16pt", fontWeight: "bold" }}>{children}</h1>,
                      h2: ({ children }) => <h2 style={{ fontSize: "14pt", fontWeight: "bold" }}>{children}</h2>,
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
