import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import type { Message } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { decryptMessage, encryptMessage, importPublicKey } from '../lib/crypto';
import { socketManager } from '../lib/socket';
import { Send, Shield, Info, MoreVertical, Phone, Video, CheckCheck, Smile, Paperclip, Mic, FileIcon, Download, X, ImageIcon, FileText, Music, Play, ArrowLeft } from 'lucide-react';

interface ChatWindowProps {
  user: any;
  onBack?: () => void;
}

interface DecryptedContent {
  type: 'text' | 'file' | 'image' | 'video';
  text?: string;
  fileName?: string;
  fileData?: string; // base64
  fileSize?: number;
  mimeType?: string;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ user: recipient, onBack }) => {
  const { user: currentUser, privateKey } = useAuth();
  const [messages, setMessages] = useState<(Message & { content?: DecryptedContent })[]>([]);
  const [inputText, setInputText] = useState('');
  const [recipientPubKey, setRecipientPubKey] = useState<CryptoKey | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const recipientId = recipient.user_id || recipient.id;

  const parseContent = (plaintext: string): DecryptedContent => {
    try {
      if (plaintext.startsWith('{') && plaintext.endsWith('}')) {
        return JSON.parse(plaintext);
      }
    } catch (e) {}
    return { type: 'text', text: plaintext };
  };

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
              return { ...msg, content: parseContent(plaintext) };
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
            const msg: any = {
              ...event,
              content: parseContent(plaintext),
              delivered: true
            };
            setMessages(prev => [...prev, msg]);
          }
        } catch (e) {
          console.error("Failed to decrypt incoming message", e);
          setMessages(prev => [...prev, { ...event, delivered: true }]);
        }
      }
    });
    return () => {
      unsubscribe();
    };
  }, [recipientId, privateKey]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e?: React.FormEvent, customContent?: DecryptedContent) => {
    if (e) e.preventDefault();
    
    const content = customContent || { type: 'text', text: inputText };
    if (content.type === 'text' && !content.text?.trim()) return;
    if (!recipientPubKey || !privateKey || !currentUser) return;

    if (!customContent) setInputText('');

    try {
      if (!currentUser.public_key) return;
      const myPubKey = await importPublicKey(currentUser.public_key);
      const plaintext = JSON.stringify(content);
      const encryptedPayload = await encryptMessage(plaintext, recipientPubKey, myPubKey);
      
      socketManager.send(recipientId, encryptedPayload);

      const optimisticMsg: any = {
        id: Math.random().toString(),
        from_user_id: currentUser.id,
        to_user_id: recipientId,
        payload: encryptedPayload,
        content,
        delivered: true,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, optimisticMsg]);
    } catch (e) {
      console.error("Send failed", e);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Base64 encoding increases size by ~33%, so we limit to 1.5MB to stay safe
    if (file.size > 1.5 * 1024 * 1024) {
      alert("Image/File is too large for secure real-time delivery. Please limit to 1.5MB.");
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        if (!base64) throw new Error("Failed to read file");
        
        const type = file.type.startsWith('image/') ? 'image' : 
                     file.type.startsWith('video/') ? 'video' : 
                     file.type.startsWith('audio/') ? 'audio' : 'file';
        
        await handleSend(undefined, {
          type: type as any,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          fileData: base64
        });
      } catch (err) {
        console.error("File processing failed:", err);
        alert("Could not process file. Please try again.");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
      }
    };
    reader.onerror = () => {
      alert("Error reading file.");
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const renderMessageContent = (content: DecryptedContent) => {
    if (content.type === 'text') {
      return <div className="break-words leading-[19px] text-text-primary text-[14.2px]">{content.text}</div>;
    }

    if (content.type === 'image') {
      return (
        <div className="flex flex-col gap-1 -m-1">
          <img 
            src={content.fileData} 
            alt={content.fileName} 
            className="rounded-lg max-h-72 object-cover cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(content.fileData)}
          />
          {content.fileName && <span className="text-xs opacity-70 px-1">{content.fileName}</span>}
        </div>
      );
    }

    if (content.type === 'video') {
      return (
        <div className="flex flex-col gap-1 -m-1">
          <video 
            src={content.fileData} 
            controls 
            className="rounded-lg max-h-72 object-cover"
          />
          {content.fileName && <span className="text-xs opacity-70 px-1">{content.fileName}</span>}
        </div>
      );
    }

    if (content.mimeType?.startsWith('audio/')) {
      return (
        <div className="flex flex-col gap-2 min-w-[240px] py-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent">
              <Play size={20} fill="currentColor" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium truncate">{content.fileName}</div>
              <div className="text-[10px] opacity-60">AUDIO • {(content.fileSize! / 1024).toFixed(1)} KB</div>
            </div>
          </div>
          <audio src={content.fileData} controls className="w-full h-8 custom-audio" />
        </div>
      );
    }

    if (content.mimeType === 'application/pdf') {
      return (
        <div className="flex flex-col gap-2 min-w-[200px]">
          <div className="flex items-center gap-3 bg-black/20 p-3 rounded-lg border border-white/10 group cursor-pointer" onClick={() => window.open(content.fileData)}>
            <div className="w-12 h-12 rounded bg-red-500/20 flex items-center justify-center text-red-500">
              <FileText size={32} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{content.fileName}</div>
              <div className="text-[10px] opacity-60">PDF DOCUMENT</div>
            </div>
            <div className="text-white/40 group-hover:text-white transition-colors">
              <Info size={18} />
            </div>
          </div>
          <button 
            onClick={() => window.open(content.fileData)}
            className="text-center py-2 text-xs font-bold text-accent hover:bg-accent/10 rounded transition-colors"
          >
            OPEN PREVIEW
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3 bg-black/10 p-2 rounded-lg border border-white/5 group hover:bg-black/20 transition-colors cursor-pointer" onClick={() => window.open(content.fileData)}>
        <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center text-accent">
          <FileText size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{content.fileName}</div>
          <div className="text-[10px] opacity-60 uppercase">
            {(content.fileSize! / 1024).toFixed(1)} KB • {content.fileName?.split('.').pop()}
          </div>
        </div>
        <a 
          href={content.fileData} 
          download={content.fileName}
          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
        >
          <Download size={16} />
        </a>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-bg-primary relative overflow-hidden h-full">
      {/* Header */}
      <header className="h-[60px] px-4 flex justify-between items-center bg-panel-header border-l border-border-main z-10 shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button 
              onClick={onBack}
              className="md:hidden text-[#aebac1] hover:text-text-primary transition-colors p-1 -ml-2"
            >
              <ArrowLeft size={24} />
            </button>
          )}
          <div className="w-10 h-10 rounded-full bg-slate-500 flex items-center justify-center font-semibold text-white uppercase overflow-hidden shrink-0">
            {recipient.display_name[0]}
          </div>
          <div className="flex flex-col">
            <span className="text-base font-medium leading-tight">{recipient.display_name}</span>
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
        className="flex-1 overflow-y-auto px-[7%] py-5 flex flex-col gap-1 relative bg-[#0b141a]" 
        ref={scrollRef}
        style={{ 
          backgroundImage: `url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')`,
          backgroundSize: '400px'
        }}
      >
        <div className="absolute inset-0 bg-[#0b141a]/90 z-0 pointer-events-none" />

        {isLoading ? (
          <div className="text-center text-text-secondary mt-10 z-10">Loading secure history...</div>
        ) : (
          <div className="flex flex-col gap-1 z-10">
            <div className="self-center bg-[#182229] text-[#ffd279] px-3 py-1.5 rounded-lg text-xs text-center mb-5 flex items-center gap-2 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]">
              <Shield size={14} />
              Messages are end-to-end encrypted. No one outside of this chat can read them.
            </div>
            
            {messages.map(msg => (
              <div 
                key={msg.id} 
                className={`flex w-full mb-0.5 ${msg.from_user_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] sm:max-w-[65%] p-1.5 px-2.5 rounded-lg shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] relative flex flex-col ${msg.from_user_id === currentUser?.id ? 'bg-bubble-out rounded-tr-none' : 'bg-bubble-in rounded-tl-none'}`}>
                  {/* Tail Effect */}
                  <div className={`absolute top-0 w-2 h-2 ${msg.from_user_id === currentUser?.id ? '-right-2 border-t-[8px] border-l-[8px] border-t-bubble-out border-l-bubble-out border-transparent' : '-left-2 border-t-[8px] border-r-[8px] border-t-bubble-in border-r-bubble-in border-transparent'}`} />
                  
                  {msg.content ? renderMessageContent(msg.content) : (
                    <div className="italic opacity-60 text-sm">Decryption failed or key missing</div>
                  )}

                  <div className="flex items-center justify-end gap-1 mt-1 h-[15px]">
                    <span className="text-[10px] text-white/50 uppercase">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.from_user_id === currentUser?.id && (
                      <CheckCheck size={14} className="text-[#53bdeb]" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-panel-header min-h-[62px]">
        {isUploading && (
          <div className="px-4 py-2 bg-accent/10 border-b border-accent/20 flex items-center gap-3 animate-pulse">
            <Loader2 className="animate-spin text-accent" size={18} />
            <span className="text-xs text-accent font-medium uppercase tracking-wider">Encrypting & Sending File...</span>
          </div>
        )}
        
        <form className="px-4 py-1.5 flex items-center gap-2" onSubmit={handleSend}>
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileChange}
          />
          
          <div className="flex gap-3 text-[#8696a0]">
            <button type="button" className="hover:text-[#aebac1] transition-colors"><Smile size={24} /></button>
            <button 
              type="button" 
              className="hover:text-[#aebac1] transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip size={24} />
            </button>
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
          
          <button 
            type={(inputText.trim() || isUploading) ? "submit" : "button"} 
            className="text-[#8696a0] p-2 hover:text-[#aebac1] transition-colors disabled:opacity-50"
            disabled={isUploading}
          >
            {(inputText.trim()) ? <Send size={24} /> : <Mic size={24} />}
          </button>
        </form>
      </div>
    </div>
  );
};

const Loader2 = ({ className, size }: { className?: string, size?: number }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);
