import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { ChatWindow } from './ChatWindow';
import type { User, Conversation } from '../lib/api';

export const MainView: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState<User | Conversation | null>(null);

  return (
    <div className="flex h-screen w-screen bg-bg-primary overflow-hidden">
      <div className={`flex-shrink-0 w-full md:w-[380px] ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
        <Sidebar 
          onSelectUser={setSelectedUser} 
          selectedUserId={(selectedUser as Conversation)?.user_id || (selectedUser as User)?.id} 
        />
      </div>
      
      <div className={`flex-1 ${selectedUser ? 'flex' : 'hidden md:flex'} h-full min-w-0`}>
        {selectedUser ? (
          <ChatWindow 
            user={selectedUser} 
            key={(selectedUser as Conversation).user_id || (selectedUser as User).id}
            onBack={() => setSelectedUser(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-bg-secondary border-l border-border-main h-full">
          <div className="text-center max-w-[400px] animate-fade">
            <div className="text-7xl mb-6">🔐</div>
            <h2 className="text-3xl font-light text-text-primary mb-3">End-to-End Encrypted</h2>
            <p className="text-text-secondary mb-6 px-4">
              WhisperBox protects your privacy. Select a contact to start messaging securely.
            </p>
            <span className="bg-accent/15 text-accent px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider">
              AES-256-GCM & RSA-2048
            </span>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
