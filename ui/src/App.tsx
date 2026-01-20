import { useState } from 'react'
import axios from 'axios'

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await axios.post('http://localhost:3001/chat', { message: input });
      const assistantMsg: Message = { role: 'assistant', content: response.data.response };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error: any) {
      console.error('Error sending message:', error);
      const errorMsg = error.response?.data?.error || 'Could not connect to backend.';
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${errorMsg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Cosense MCP Chat</h1>
      <div style={{ border: '1px solid #ccc', borderRadius: '8px', height: '500px', overflowY: 'auto', padding: '20px', marginBottom: '20px', backgroundColor: '#f9f9f9' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: '15px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
            <div style={{ 
              display: 'inline-block', 
              padding: '10px 15px', 
              borderRadius: '15px', 
              backgroundColor: msg.role === 'user' ? '#007bff' : '#e9ecef',
              color: msg.role === 'user' ? 'white' : 'black',
              maxWidth: '80%'
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && <div style={{ textAlign: 'left', color: '#666' }}>Thinking...</div>}
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <input 
          type="text" 
          value={input} 
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask something about your Cosense pages..."
          style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
          disabled={isLoading}
        />
        <button 
          onClick={sendMessage} 
          disabled={isLoading}
          style={{ padding: '10px 20px', borderRadius: '4px', backgroundColor: '#28a745', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          Send
        </button>
      </div>
    </div>
  )
}

export default App
