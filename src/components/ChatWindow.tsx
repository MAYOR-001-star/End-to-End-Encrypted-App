import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import type { User, Message } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { decryptMessage, encryptMessage, importPublicKey } from '../lib/crypto';
import { socketManager } from '../lib/socket';
import { Send, Shield, Info, MoreVertical, Phone, Video, CheckCheck, Smile, Paperclip, Mic } from 'lucide-react';

interface ChatWindowProps {
  user: any;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ user: recipient }) => {
  const { user: currentUser, privateKey } = useAuth();
  const [messages, setMessages] = useState<(Message & { plaintext?: string })[]>([]);
  const [inputText, setInputText] = useState('');
  const [recipientPubKey, setRecipientPubKey] = useState<CryptoKey | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const recipientId = recipient.user_id || recipient.id;

  useEffect(() => {
    const init = async () => {
      try {
        const pubKeyBase64 = await api.getUserPublicKey(recipientId);
        const pubKey = await importPublicKey(pubKeyBase64);
        setRecipientPubKey(pubKey);

        const history = await api.getMessages(recipientId);
        const decrypted = await Promise.all(history.map(async (msg) => {
          try {
            if (privateKey) {
              const isSender = msg.from_user_id === currentUser?.id;
              const plaintext = await decryptMessage(msg.payload, privateKey, isSender);
              return { ...msg, plaintext };
            }
          } catch (e) {
            console.error("Failed to decrypt message", msg.id, e);
          }
          return msg;
        }));

        setMessages(decrypted.reverse());
      } catch (e) {
        console.error("Chat init failed", e);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [recipientId, privateKey, currentUser?.id]);

  useEffect(() => {
    const unsubscribe = socketManager.addListener(async (event) => {
      if (event.event === 'message.receive' && event.from_user_id === recipientId) {
        try {
          if (privateKey) {
            const plaintext = await decryptMessage(event.payload, privateKey, false);
            setMessages(prev => [...prev, { ...event, plaintext }]);
          }
        } catch (e) {
          console.error("Failed to decrypt incoming message", e);
          setMessages(prev => [...prev, event]);
        }
      }
    });
    return unsubscribe;
  }, [recipientId, privateKey]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !recipientPubKey || !privateKey || !currentUser) return;

    const text = inputText;
    setInputText('');

    try {
      if (!currentUser.public_key) return;
      const myPubKey = await importPublicKey(currentUser.public_key);
      const encryptedPayload = await encryptMessage(text, recipientPubKey, myPubKey);
      socketManager.send(recipientId, encryptedPayload);

      const optimisticMsg: any = {
        id: Math.random().toString(),
        from_user_id: currentUser.id,
        to_user_id: recipientId,
        payload: encryptedPayload,
        plaintext: text,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, optimisticMsg]);
    } catch (e) {
      console.error("Send failed", e);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-bg-primary relative">
      {/* Header */}
      <header className="h-[60px] px-4 flex justify-between items-center bg-panel-header border-l border-border-main z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-500 flex items-center justify-center font-semibold text-white uppercase overflow-hidden">
            {recipient.display_name[0]}
          </div>
          <div className="flex flex-col">
            <span className="text-base font-medium">{recipient.display_name}</span>
            <span className="text-[11px] text-text-secondary flex items-center gap-1">
              <Shield size={10} className="text-accent" /> End-to-End Encrypted
            </span>
          </div>
        </div>
        <div className="flex gap-6 text-[#aebac1]">
          <button className="hover:text-text-primary transition-colors"><Video size={20} /></button>
          <button className="hover:text-text-primary transition-colors"><Phone size={20} /></button>
          <button className="hover:text-text-primary transition-colors"><Info size={20} /></button>
          <button className="hover:text-text-primary transition-colors"><MoreVertical size={20} /></button>
        </div>
      </header>

      {/* Message List */}
      <div 
        className="flex-1 overflow-y-auto px-[7%] py-5 flex flex-col gap-1 relative bg-[#0b141a] bg-repeat" 
        ref={scrollRef}
        style={{ 
          backgroundImage: `url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')`,
          backgroundSize: '400px'
        }}
      >
        {/* Overlay for better readability */}
        <div className="absolute inset-0 bg-[#0b141a]/90 z-0 pointer-events-none" />

        {isLoading ? (
          <div className="text-center text-text-secondary mt-10 z-10">Loading secure history...</div>
        ) : (
          <div className="flex flex-col gap-1 z-10">
            <div className="self-center bg-[#182229] text-[#ffd279] px-3 py-1.5 rounded-lg text-xs text-center mb-5 flex items-center gap-2 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]">
              <Shield size={14} />
              Messages are end-to-end encrypted. No one outside of this chat, not even WhisperBox, can read them.
            </div>
            
            {messages.map(msg => (
              <div 
                key={msg.id} 
                className={`flex w-full mb-0.5 ${msg.from_user_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[65%] p-1.5 px-2.5 rounded-lg shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] relative flex flex-col ${msg.from_user_id === currentUser?.id ? 'bg-bubble-out rounded-tr-none' : 'bg-bubble-in rounded-tl-none'}`}>
                  {/* Tail Effect */}
                  <div className={`absolute top-0 w-2 h-2 ${msg.from_user_id === currentUser?.id ? '-right-2 border-t-[8px] border-l-[8px] border-t-bubble-out border-l-bubble-out border-transparent' : '-left-2 border-t-[8px] border-r-[8px] border-t-bubble-in border-r-bubble-in border-transparent'}`} />
                  
                  <div className="break-words leading-[19px] text-text-primary text-[14.2px]">
                    {msg.plaintext || <span className="italic opacity-60">Decryption failed or key missing</span>}
                  </div>
                  <div className="flex items-center justify-end gap-1 -mt-1 h-[15px]">
                    <span className="text-[11px] text-white/50 uppercase">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.from_user_id === currentUser?.id && (
                      <CheckCheck size={16} className="text-[#53bdeb]" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input Area */}
      <form className="min-h-[62px] px-4 py-1.5 bg-panel-header flex items-center gap-2 shrink-0" onSubmit={handleSend}>
        <div className="flex gap-3 text-[#8696a0]">
          <button type="button" className="hover:text-[#aebac1] transition-colors"><Smile size={24} /></button>
          <button type="button" className="hover:text-[#aebac1] transition-colors"><Paperclip size={24} /></button>
        </div>
        <div className="flex-1 bg-[#2a3942] rounded-lg px-3 mx-2">
          <input 
            type="text" 
            placeholder="Type a message" 
            className="w-full py-2.5 text-[15px] text-text-primary bg-transparent outline-none"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
        </div>
        <button type={inputText.trim() ? "submit" : "button"} className="text-[#8696a0] p-2 hover:text-[#aebac1] transition-colors">
          {inputText.trim() ? <Send size={24} /> : <Mic size={24} />}
        </button>
      </form>
    </div>
  );
};
