"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";

interface ApiMessage {
  role: "user" | "assistant";
  content: string;
}


interface Message {
  id: number;
  role: "bot" | "user";
  text: string;
}

const BOT_NAME = "Kio";
const SUGGESTIONS = [
  "What is AWS SBG?",
  "Upcoming events?",
  "How to join?",
  "Meet the team",
];

export function ChatbotMascot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "bot",
      text: "Hey there! 👋 I'm Kio, your AWS SBG guide. How can I help you today?",
    },
  ]);
  // Conversation history for multi-turn context sent to Bedrock
  const [history, setHistory] = useState<ApiMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showBubble, setShowBubble] = useState(true);
  const [videoEnded, setVideoEnded] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 300);
    }
  }, [open]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      // Auto scroll only if user is already near bottom (within 120px)
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
      if (isNearBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        setVideoEnded(true);
      });
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowBubble(false), 5000);
    return () => clearTimeout(timer);
  }, []);



  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: Message = { id: Date.now(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    // Build history including the new user message
    const newHistory: ApiMessage[] = [...history, { role: "user", content: text }];

    // Placeholder bot message that we'll stream into
    const botId = Date.now() + 1;
    setMessages((prev) => [...prev, { id: botId, role: "bot", text: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newHistory }),
      });

      if (!res.ok || !res.body) throw new Error("API error");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        // Update the last bot message in place as chunks arrive
        setMessages((prev) =>
          prev.map((m) => (m.id === botId ? { ...m, text: fullText } : m))
        );
      }

      // Save full exchange to history
      setHistory([...newHistory, { role: "assistant", content: fullText }]);
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botId
            ? { ...m, text: "Hmm, I'm having trouble connecting right now. Please try again in a moment! 🙏" }
            : m
        )
      );
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") sendMessage(inputValue);
  };

  return (
    <>
      {/* ── Mobile Backdrop Blur ── */}
      <div
        className={`chatbot-backdrop ${open ? "chatbot-backdrop--open" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* ── Chat Panel ── */}
      <div
        className={`chatbot-panel ${open ? "chatbot-panel--open" : ""}`}
        role="dialog"
        aria-label="Chat with Kio"
        aria-hidden={!open}
        data-lenis-prevent
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="chatbot-header">
          <div className="chatbot-header-avatar">
            <Image
              src="/chatbotmascot.webp"
              alt="Kio mascot"
              width={120}
              height={120}
              quality={100}
              unoptimized
              className="chatbot-header-avatar-img"
            />
            <span className="chatbot-online-dot" />
          </div>
          <div className="chatbot-header-info">
            <p className="chatbot-header-name">{BOT_NAME}</p>
            <p className="chatbot-header-status">AWS SBG Assistant</p>
          </div>
          <button onClick={() => setOpen(false)} className="chatbot-close-btn" aria-label="Close chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef} className="chatbot-messages" data-lenis-prevent onWheel={(e) => e.stopPropagation()}>


          {messages.map((msg) => (
            <div key={msg.id} className={`chatbot-message chatbot-message--${msg.role}`}>
              {msg.role === "bot" && (
                <div className="chatbot-bot-avatar">
                  <Image src="/chatbotmascot.webp" alt="Kio" width={80} height={80} quality={100} unoptimized className="chatbot-bot-avatar-img" />
                </div>
              )}

              {/* Show typing dots while the bot message is still empty (streaming hasn't started) */}
              {msg.role === "bot" && msg.text === "" ? (
                <div className="chatbot-bubble chatbot-bubble--bot chatbot-typing">
                  <span /><span /><span />
                </div>
              ) : (
                <div className={`chatbot-bubble chatbot-bubble--${msg.role}`}>{msg.text}</div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions */}
        <div className="chatbot-suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chatbot-suggestion-chip" onClick={() => sendMessage(s)}>
              {s}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="chatbot-input-row">
          <input
            ref={inputRef}
            type="text"
            className="chatbot-input"
            placeholder="Ask me anything…"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Chat message input"
          />
          <button className="chatbot-send-btn" onClick={() => sendMessage(inputValue)} aria-label="Send" disabled={!inputValue.trim()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Trigger Button ── */}
      <div className="chatbot-trigger-wrapper">
        {showBubble && !open && (
          <div className="chatbot-speech-bubble">
            Hi! I&apos;m Kio 👋
          </div>
        )}

        <button
          className={`chatbot-trigger ${open ? "chatbot-trigger--active" : ""}`}
          onClick={() => { setOpen((p) => !p); setShowBubble(false); }}
          aria-label={open ? "Close chat" : "Open chat with Kio"}
          aria-expanded={open}
        >
          <span className="chatbot-trigger-ring" />
          <div className="chatbot-trigger-avatar">
            {videoEnded ? (
              <Image
                src="/chatbotmascot.webp"
                alt="Kio mascot"
                width={200}
                height={200}
                quality={100}
                unoptimized
                priority
                className="chatbot-trigger-video"
              />
            ) : (
              <video
                ref={videoRef}
                src="/Chatbot.webm"
                autoPlay
                muted
                playsInline
                onEnded={() => setVideoEnded(true)}
                className="chatbot-trigger-video"
              />
            )}
          </div>


          {open && (
            <div className="chatbot-trigger-close-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
          )}
        </button>
      </div>


      <style jsx>{`
        .chatbot-trigger-wrapper {
          position: fixed;
          bottom: 28px;
          right: 28px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
        }
        .chatbot-panel {
          position: fixed;
          bottom: 114px;
          right: 28px;
          z-index: 9998;
          width: 360px;
          max-height: 560px;
          display: none;
          flex-direction: column;
          background: linear-gradient(145deg,#111827 0%,#0d0d14 100%);
          border: 1px solid rgba(124,58,237,.35);
          border-radius: 20px;
          box-shadow: 0 0 0 1px rgba(124,58,237,.1),0 20px 60px rgba(0,0,0,.6),0 0 40px rgba(124,58,237,.12);
          overflow: hidden;
          transform: scale(.85) translateY(20px);
          opacity: 0;
          pointer-events: none;
          transition: transform .3s cubic-bezier(.23,1,.32,1), opacity .25s ease;
          transform-origin: bottom right;
        }
        .chatbot-panel--open {
          display: flex;
          transform: scale(1) translateY(0);
          opacity: 1;
          pointer-events: all;
        }


        .chatbot-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: linear-gradient(90deg,rgba(124,58,237,.25) 0%,rgba(192,132,252,.1) 100%);
          border-bottom: 1px solid rgba(124,58,237,.2);
          flex-shrink: 0;
        }
        .chatbot-header-avatar { position: relative; flex-shrink: 0; }
        .chatbot-header-avatar-img { border-radius: 50%; object-fit: cover; border: 2px solid rgba(124,58,237,.6); }
        .chatbot-online-dot {
          position: absolute;
          bottom: 1px; right: 1px;
          width: 10px; height: 10px;
          background: #22c55e;
          border-radius: 50%;
          border: 2px solid #0d0d14;
          animation: pulse-online 2s ease-in-out infinite;
        }
        @keyframes pulse-online {
          0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,.5); }
          50% { box-shadow: 0 0 0 5px rgba(34,197,94,0); }
        }
        .chatbot-header-info { flex: 1; min-width: 0; }
        .chatbot-header-name { font-weight: 700; font-size: 15px; color: #fafafa; margin: 0; line-height: 1.2; }
        .chatbot-header-status { font-size: 11px; color: #a78bfa; margin: 2px 0 0; }
        .chatbot-close-btn {
          background: rgba(255,255,255,.05);
          border: none; color: #71717a; cursor: pointer;
          width: 30px; height: 30px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          transition: background .2s, color .2s; flex-shrink: 0;
        }
        .chatbot-close-btn:hover { background: rgba(239,68,68,.15); color: #ef4444; }

        .chatbot-messages {
          flex: 1; overflow-y: auto; padding: 16px;
          display: flex; flex-direction: column; gap: 12px;
          scrollbar-width: thin; scrollbar-color: rgba(124,58,237,.3) transparent;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }

        .chatbot-messages::-webkit-scrollbar { width: 4px; }
        .chatbot-messages::-webkit-scrollbar-track { background: transparent; }
        .chatbot-messages::-webkit-scrollbar-thumb { background: rgba(124,58,237,.4); border-radius: 4px; }

        .chatbot-message { display: flex; align-items: flex-end; gap: 8px; animation: msg-in .3s cubic-bezier(.23,1,.32,1); }
        @keyframes msg-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .chatbot-message--user { flex-direction: row-reverse; }

        .chatbot-bot-avatar { flex-shrink:0; width:28px; height:28px; border-radius:50%; overflow:hidden; border:1.5px solid rgba(124,58,237,.5); }
        .chatbot-bot-avatar-img { object-fit:cover; width:100%; height:100%; }

        .chatbot-bubble { max-width:80%; padding:10px 14px; border-radius:16px; font-size:13.5px; line-height:1.55; }
        .chatbot-bubble--bot { background:rgba(124,58,237,.15); border:1px solid rgba(124,58,237,.25); color:#e2e8f0; border-bottom-left-radius:4px; }
        .chatbot-bubble--user { background:linear-gradient(135deg,#7c3aed,#6d28d9); color:#fafafa; border-bottom-right-radius:4px; box-shadow:0 4px 16px rgba(124,58,237,.3); }

        .chatbot-typing { display:flex; align-items:center; gap:5px; padding:12px 16px; }
        .chatbot-typing span { width:7px; height:7px; background:#a78bfa; border-radius:50%; display:inline-block; animation:typing-bounce 1.2s ease-in-out infinite; }
        .chatbot-typing span:nth-child(1) { animation-delay:0s; }
        .chatbot-typing span:nth-child(2) { animation-delay:.2s; }
        .chatbot-typing span:nth-child(3) { animation-delay:.4s; }
        @keyframes typing-bounce {
          0%,60%,100% { transform:translateY(0); opacity:.4; }
          30% { transform:translateY(-6px); opacity:1; }
        }

        .chatbot-suggestions { display:flex; flex-wrap:wrap; gap:6px; padding:8px 16px 0; flex-shrink:0; }
        .chatbot-suggestion-chip {
          background:rgba(124,58,237,.12); border:1px solid rgba(124,58,237,.3); color:#a78bfa;
          font-size:11.5px; padding:5px 10px; border-radius:20px; cursor:pointer;
          transition:background .2s,border-color .2s,color .2s,transform .15s; white-space:nowrap;
        }
        .chatbot-suggestion-chip:hover { background:rgba(124,58,237,.25); border-color:rgba(167,139,250,.6); color:#c4b5fd; transform:translateY(-1px); }

        .chatbot-input-row { display:flex; align-items:center; gap:8px; padding:12px 14px; border-top:1px solid rgba(124,58,237,.15); flex-shrink:0; }
        .chatbot-input {
          flex:1; background:rgba(255,255,255,.05); border:1px solid rgba(124,58,237,.25);
          border-radius:12px; padding:9px 14px; color:#fafafa; font-size:13.5px;
          outline:none; transition:border-color .2s,box-shadow .2s; font-family:inherit;
        }
        .chatbot-input::placeholder { color:#52525b; }
        .chatbot-input:focus { border-color:rgba(124,58,237,.6); box-shadow:0 0 0 3px rgba(124,58,237,.1); }
        .chatbot-send-btn {
          width:38px; height:38px; border-radius:12px;
          background:linear-gradient(135deg,#7c3aed,#6d28d9); border:none; color:white;
          cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0;
          transition:transform .15s,box-shadow .2s,opacity .2s; box-shadow:0 4px 14px rgba(124,58,237,.4);
        }
        .chatbot-send-btn:hover:not(:disabled) { transform:scale(1.06); box-shadow:0 6px 20px rgba(124,58,237,.55); }
        .chatbot-send-btn:disabled { opacity:.4; cursor:not-allowed; }

        .chatbot-trigger {
          position:relative; width:70px; height:70px; border-radius:50%;
          border:none; cursor:pointer; background:transparent; padding:0;
          display:flex; align-items:center; justify-content:center;
          transition:transform .3s cubic-bezier(.23,1,.32,1);
        }
        .chatbot-trigger:hover { transform:scale(1.08); }
        .chatbot-trigger--active { transform:scale(1); }
        .chatbot-trigger-ring {
          position:absolute; inset:-4px; border-radius:50%;
          border:2px solid rgba(124,58,237,.5);
          animation:ring-pulse 2.5s ease-in-out infinite;
          transition:opacity .3s ease;
        }
        @keyframes ring-pulse {
          0%,100% { transform:scale(1); opacity:.6; }
          50% { transform:scale(1.1); opacity:.2; }
        }
        .chatbot-trigger--active .chatbot-trigger-ring { opacity:0; }

        .chatbot-trigger-avatar {
          position:absolute; inset:0;
          display:flex; align-items:center; justify-content:center;
          transition:transform .3s cubic-bezier(.23,1,.32,1), opacity .25s ease;
        }
        .chatbot-trigger--active .chatbot-trigger-avatar {
          opacity:0;
          transform:scale(0.5) rotate(-45deg);
          pointer-events:none;
        }

        .chatbot-trigger-video {
          width:70px; height:70px; border-radius:50%; object-fit:cover;
          background:#07050e;
          border:3px solid #7c3aed;
          box-shadow:0 0 0 3px rgba(124,58,237,.25), 0 0 25px rgba(124,58,237,.5), 0 8px 30px rgba(0,0,0,.6);
          image-rendering: -webkit-optimize-contrast;
          transform: translateZ(0);
        }





        .chatbot-trigger-close-icon {
          position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
          color:#fafafa; background:linear-gradient(135deg,#7c3aed,#6d28d9);
          border:2px solid rgba(167,139,250,.6); border-radius:50%;
          box-shadow:0 0 25px rgba(124,58,237,.5),0 8px 24px rgba(0,0,0,.4);
          animation: close-icon-pop .25s cubic-bezier(.23,1,.32,1);
        }
        @keyframes close-icon-pop {
          from { opacity:0; transform:scale(0.5) rotate(45deg); }
          to { opacity:1; transform:scale(1) rotate(0deg); }
        }



        .chatbot-speech-bubble {
          position:relative; background:linear-gradient(135deg,#1f2937,#111827);
          border:1px solid rgba(124,58,237,.4); border-radius:14px;
          padding:10px 32px 10px 14px; font-size:13px; color:#e2e8f0;
          white-space:nowrap; box-shadow:0 8px 24px rgba(0,0,0,.4);
          animation:bubble-in .4s cubic-bezier(.23,1,.32,1);
        }
        .chatbot-speech-bubble::after {
          content:""; position:absolute; bottom:-8px; right:28px;
          width:0; height:0;
          border-left:8px solid transparent; border-right:8px solid transparent;
          border-top:8px solid rgba(124,58,237,.4);
        }
        @keyframes bubble-in { from { opacity:0; transform:translateY(6px) scale(.95); } to { opacity:1; transform:translateY(0) scale(1); } }
        .chatbot-speech-close { position:absolute; top:4px; right:8px; background:none; border:none; color:#71717a; font-size:16px; cursor:pointer; line-height:1; padding:0; transition:color .2s; }
        .chatbot-speech-close:hover { color:#ef4444; }

        .chatbot-backdrop {
          display: none;
          position: fixed;
          inset: 0;
          z-index: 9997;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          opacity: 0;
          pointer-events: none;
          transition: opacity .3s cubic-bezier(.23,1,.32,1);
        }

        @media (max-width: 640px) {
          .chatbot-backdrop {
            display: block;
          }
          .chatbot-backdrop--open {
            opacity: 1;
            pointer-events: auto;
          }
          .chatbot-panel {
            width: calc(100vw - 28px);
            right: 14px;
            bottom: 96px;
            max-height: calc(100dvh - 120px);
            background: linear-gradient(145deg, rgba(17, 24, 39, 0.95) 0%, rgba(13, 13, 20, 0.95) 100%);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
          }
          .chatbot-trigger-wrapper {
            right: 16px;
            bottom: 20px;
          }
        }
      `}</style>
    </>
  );
}
