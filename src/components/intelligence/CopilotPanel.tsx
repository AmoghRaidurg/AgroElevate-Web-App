import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Send, Bot } from 'lucide-react';
import { sendCopilotMessage, type CopilotResponse } from '@/lib/aiApi';

interface Props {
  userId: string;
  role: string;
  location?: string;
}

export function CopilotPanel({ userId, role, location }: Props) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    { role: 'assistant', text: '👋 I\'m AgroElevate Copilot. Ask about crops for your region, season, profit, or risk.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<Record<string, unknown>>({});
  const [lastData, setLastData] = useState<CopilotResponse | null>(null);

  const send = async (text: string) => {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: 'user', text }]);
    setInput('');
    setLoading(true);
    try {
      const res = await sendCopilotMessage(userId, text, role, location, {
        ...context,
        conversation_history: messages
          .filter((m) => m.role === 'user')
          .map((m) => m.text)
          .concat(text)
          .slice(-10),
      });
      setContext(res.context ?? {});
      setLastData(res);
      setMessages((m) => [...m, { role: 'assistant', text: res.reply.replace(/\*\*/g, '') }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', text: 'Could not reach AI service. Ensure ai-service is running on port 8000.' }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = lastData?.suggestions ?? [
    'I am from Pune',
    'What should I grow this season?',
    'I have 5 acres',
    'Which crop gives highest profit?',
  ];

  return (
    <div className="glass-card rounded-xl border-accent/30 overflow-hidden">
      <div className="px-6 pt-5 pb-3 border-b border-border/50">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Bot className="h-5 w-5 text-accent" /> AI Copilot
        </h3>
      </div>
      <div className="p-5 space-y-4">
        <div className="h-64 overflow-y-auto space-y-3 rounded-lg bg-muted/30 p-3 border border-border/50">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'glass-card !p-3 border-border/50'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && <p className="text-xs text-muted-foreground animate-pulse">Analyzing...</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <Button key={s} variant="outline" size="sm" className="text-xs h-7" onClick={() => send(s)}>
              {s}
            </Button>
          ))}
        </div>

        {lastData?.location && (
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline">{lastData.location.state}</Badge>
            {lastData.location.district && <Badge variant="outline">{lastData.location.district}</Badge>}
            <Badge variant="secondary">{lastData.season} season</Badge>
          </div>
        )}

        <form
          className="flex gap-2"
          onSubmit={(e) => { e.preventDefault(); send(input); }}
        >
          <Input
            placeholder="Ask: What should I grow in Pune?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <Button type="submit" size="icon" disabled={loading}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MessageCircle className="h-3 w-3" /> Semantic assistant — answers from your full commerce history
        </p>
      </div>
    </div>
  );
}
