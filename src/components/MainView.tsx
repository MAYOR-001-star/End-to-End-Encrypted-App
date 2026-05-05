import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { ChatWindow } from './ChatWindow';
import type { User, Conversation } from '../lib/api';

export const MainView: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState<User | Conversation | null>(null);

  return (
    <div className="flex h-[100dvh] w-screen bg-bg-primary overflow-hidden">
      {/* Sidebar - Hidden on mobile if a user is selected */}
      <div className={`h-full flex-shrink-0 w-full md:w-[380px] border-r border-border-main ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
        <Sidebar 
          onSelectUser={setSelectedUser} 
          selectedUserId={(selectedUser as Conversation)?.user_id || (selectedUser as User)?.id} 
        />
      </div>
      
      {/* Chat Area - Hidden on mobile if no user is selected */}
      <div className={`flex-1 h-full min-w-0 ${selectedUser ? 'flex' : 'hidden md:flex'} flex-col`}>
        {selectedUser ? (
          <ChatWindow 
            user={selectedUser} 
            key={(selectedUser as Conversation).user_id || (selectedUser as User).id}
            onBack={() => setSelectedUser(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-bg-secondary h-full">
            <div className="text-center max-w-[400px] animate-fade p-6">
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
