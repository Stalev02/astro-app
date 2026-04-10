// src/store/chat.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Msg = { id: string; role: 'user' | 'bot'; text: string; ts: number };

const WELCOME: Msg = {
  id: 'welcome',
  role: 'bot',
  text: 'Привет! Спроси что-нибудь по своей карте 🌌',
  ts: 0,
};

type ChatState = {
  messages: Msg[];
  addMessage: (msg: Msg) => void;
  updateMessage: (id: string, text: string) => void;
  clearHistory: () => void;
};

export const useChat = create<ChatState>()(
  persist(
    (set) => ({
      messages: [WELCOME],

      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

      updateMessage: (id, text) =>
        set((s) => ({
          messages: s.messages.map((m) => (m.id === id ? { ...m, text } : m)),
        })),

      clearHistory: () => set({ messages: [WELCOME] }),
    }),
    {
      name: 'chat-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        // Filter out any dangling "…" wait messages left from a crashed session
        messages: s.messages.filter((m) => m.text !== '…'),
      }),
    }
  )
);
