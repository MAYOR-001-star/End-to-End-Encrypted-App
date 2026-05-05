import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { Conversation, User } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Search, MessageSquarePlus, LogOut, Shield } from 'lucide-react';

interface SidebarProps {
  onSelectUser: (user: any) => void;
  selectedUserId?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ onSelectUser, selectedUserId }) => {
  const { user, logout } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchConversations = async () => {
    try {
      const data = await api.getConversations();
      setConversations(data);
    } catch (e) {
      console.error("Failed to fetch conversations", e);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length > 2) {
      setIsSearching(true);
      try {
        const results = await api.searchUsers(query);
        setSearchResults(results);
      } catch (e) {
        console.error("Search failed", e);
      }
    } else {
      setIsSearching(false);
      setSearchResults([]);
    }
  };

  const selectUser = (u: any) => {
    onSelectUser(u);
    setSearchQuery('');
    setIsSearching(false);
  };

  return (
    <div className="w-[380px] flex flex-col bg-bg-primary border-r border-border-main shrink-0">
      {/* Header */}
      <header className="h-[60px] px-4 flex justify-between items-center bg-panel-header shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-500 flex items-center justify-center font-semibold text-white overflow-hidden uppercase">
            {user?.display_name[0]}
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-medium leading-tight">{user?.display_name}</span>
            <span className="text-[11px] text-accent flex items-center gap-1">
              <Shield size={10} /> Encrypted
            </span>
          </div>
        </div>
        <div className="flex gap-5 text-text-secondary">
          <button title="New Chat" className="text-[#aebac1] hover:text-text-primary transition-colors">
            <MessageSquarePlus size={20} />
          </button>
          <button onClick={logout} title="Logout" className="text-[#aebac1] hover:text-text-primary transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-3 py-2 bg-bg-primary h-[49px] flex items-center shrink-0">
        <div className="bg-search-bg rounded-lg flex items-center px-3 w-full h-[35px]">
          <Search size={18} className="text-text-dim" />
          <input 
            type="text" 
            placeholder="Search users..." 
            className="w-full px-2 text-sm bg-transparent outline-none text-text-primary placeholder:text-text-dim"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {isSearching ? (
          <div className="py-2">
            <h3 className="px-4 py-3 text-xs uppercase text-accent tracking-widest font-semibold">Search Results</h3>
            {searchResults.map(u => (
              <div 
                key={u.id} 
                className={`flex items-center gap-3 px-4 h-[72px] cursor-pointer transition-colors border-b border-border-main/50 hover:bg-bg-hover ${selectedUserId === u.id ? 'bg-bg-tertiary' : ''}`}
                onClick={() => selectUser(u)}
              >
                <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center font-semibold text-white text-lg">
                  {u.display_name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-width-0 flex flex-col justify-center">
                  <span className="text-[17px] font-medium text-text-primary truncate">{u.display_name}</span>
                  <span className="text-sm text-text-secondary truncate">@{u.username}</span>
                </div>
              </div>
            ))}
            {searchResults.length === 0 && <div className="p-10 text-center text-sm text-text-dim">No users found</div>}
          </div>
        ) : (
          <div className="py-0">
            {conversations.map(c => (
              <div 
                key={c.user_id} 
                className={`flex items-center gap-3 px-4 h-[72px] cursor-pointer transition-colors border-b border-border-main/50 hover:bg-bg-hover ${selectedUserId === c.user_id ? 'bg-bg-tertiary' : ''}`}
                onClick={() => selectUser(c)}
              >
                <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center font-semibold text-white text-lg">
                  {c.display_name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-width-0 flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[17px] font-medium text-text-primary truncate">{c.display_name}</span>
                    <span className="text-xs text-text-secondary">
                      {new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <span className="text-sm text-text-secondary truncate">Encrypted message</span>
                </div>
              </div>
            ))}
            {conversations.length === 0 && <div className="p-10 text-center text-sm text-text-dim">No active conversations</div>}
          </div>
        )}
      </div>
    </div>
  );
};
