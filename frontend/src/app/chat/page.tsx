'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Action {
  type: string;
  params: Record<string, unknown>;
}

interface Allocation {
  pancakeLP: number;
  venusLending: number;
  bnbStaking: number;
  idle: number;
}

interface Strategy {
  name: string;
  description: string;
  targetAllocation: Allocation;
  expectedAPR: number;
  riskLevel: 'low' | 'medium' | 'high';
  actions: Action[];
  reasoning: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  strategy?: Strategy;
  actions?: Action[];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StrategyPreview({ strategy }: { strategy: Strategy }) {
  return (
    <div className="text-sm space-y-2 mt-3 p-3 bg-gray-50 rounded-lg">
      <p className="font-semibold">{strategy.name}</p>
      <div className="flex gap-4">
        <span className="text-green-600 font-medium">
          Expected APR: {strategy.expectedAPR.toFixed(2)}%
        </span>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            strategy.riskLevel === 'low'
              ? 'bg-green-100 text-green-800'
              : strategy.riskLevel === 'medium'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {strategy.riskLevel.toUpperCase()} RISK
        </span>
      </div>
      <p className="text-gray-600 text-xs">{strategy.description}</p>
      <div className="text-xs text-gray-500 space-y-1">
        <p className="font-medium">Target Allocation:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>PancakeSwap LP: {strategy.targetAllocation.pancakeLP}%</li>
          <li>Venus Lending: {strategy.targetAllocation.venusLending}%</li>
          <li>BNB Staking: {strategy.targetAllocation.bnbStaking}%</li>
          <li>Idle: {strategy.targetAllocation.idle}%</li>
        </ul>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm mr-3 mt-1">
          🤖
        </div>
      )}
      <div
        className={`max-w-2xl ${
          isUser
            ? 'bg-blue-600 text-white rounded-l-2xl rounded-br-2xl rounded-tr-sm'
            : 'bg-white border rounded-r-2xl rounded-bl-2xl rounded-tl-sm'
        } px-4 py-3 shadow-sm`}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>

        {message.strategy && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <StrategyPreview strategy={message.strategy} />
            <Button
              className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
            >
              ⚡ Execute Strategy
            </Button>
          </div>
        )}

        <p className={`text-xs mt-2 ${isUser ? 'text-blue-200' : 'text-gray-400'}`}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm mr-3">
        🤖
      </div>
      <div className="bg-white border rounded-r-2xl rounded-bl-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex space-x-1 items-center h-4">
          <div
            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <div
            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <div
            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  );
}

function QuickAction({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition whitespace-nowrap"
    >
      {text}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content:
    "Hi! I'm your AutoTreasury AI assistant. Tell me what you'd like to do with your treasury and I'll help you optimize it.\n\nYou can ask me things like:\n• \"Optimize for maximum APR\"\n• \"What's the safest allocation?\"\n• \"Rebalance my portfolio\"",
  timestamp: Date.now(),
};

const QUICK_ACTIONS = [
  { text: '📈 Optimize for APR', prompt: 'Optimize my treasury for maximum APR' },
  { text: '🛡️ Reduce risk', prompt: 'Reduce my treasury risk to low' },
  { text: '⚖️ Rebalance', prompt: 'Rebalance my portfolio for moderate risk' },
  { text: '📊 Show returns', prompt: 'Show me my potential returns' },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(text?: string) {
    const messageText = (text ?? input).trim();
    if (!messageText || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: messageText,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          conversationHistory: messages,
        }),
      });

      const data = await response.json();

      const aiMessage: Message = {
        role: 'assistant',
        content: data.formattedSummary ?? data.message ?? 'Here is my analysis.',
        timestamp: Date.now(),
        strategy: data.strategy,
        actions: data.actions,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch {
      const errMessage: Message = {
        role: 'assistant',
        content: '⚠️ Sorry, I encountered an error. Please try again.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMessage]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💬</span>
          <div>
            <h1 className="text-xl font-bold">Chat with AutoTreasury AI</h1>
            <p className="text-xs text-gray-500">AI-powered treasury management assistant</p>
          </div>
        </div>
        <a
          href="/dashboard"
          className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition"
        >
          📊 Dashboard
        </a>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl mx-auto w-full">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t px-4 py-4 max-w-4xl mx-auto w-full">
        <div className="flex gap-3 mb-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type a message… (e.g. 'Optimize for high APR')"
            className="flex-1"
            disabled={loading}
          />
          <Button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? '…' : 'Send'}
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 flex-wrap">
          {QUICK_ACTIONS.map((action) => (
            <QuickAction
              key={action.text}
              text={action.text}
              onClick={() => sendMessage(action.prompt)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
