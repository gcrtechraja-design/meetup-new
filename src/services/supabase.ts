import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserProfile } from '../types';

// Default Supabase config with localStorage override support
const STORAGE_KEY_URL = 'meetup_supabase_url';
const STORAGE_KEY_KEY = 'meetup_supabase_key';

// Read from env or localStorage or fallback demo configuration
export const getSupabaseCredentials = () => {
  const customUrl = localStorage.getItem(STORAGE_KEY_URL);
  const customKey = localStorage.getItem(STORAGE_KEY_KEY);
  
  const url = customUrl || (import.meta as any).env?.VITE_SUPABASE_URL || 'https://xyzcompany.supabase.co';
  const key = customKey || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key';
  
  const isConfigured = !!customUrl || (!!(import.meta as any).env?.VITE_SUPABASE_URL && (import.meta as any).env.VITE_SUPABASE_URL !== 'https://xyzcompany.supabase.co');

  return { url, key, isConfigured };
};

let cachedClient: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export const getSupabaseClient = (): SupabaseClient => {
  const { url, key } = getSupabaseCredentials();
  if (!cachedClient || lastUrl !== url || lastKey !== key) {
    lastUrl = url;
    lastKey = key;
    cachedClient = createClient(url, key, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 10 } }
    });
  }
  return cachedClient;
};

export const setSupabaseCredentials = (url: string, key: string) => {
  if (!url || !key) {
    localStorage.removeItem(STORAGE_KEY_URL);
    localStorage.removeItem(STORAGE_KEY_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY_URL, url.trim());
    localStorage.setItem(STORAGE_KEY_KEY, key.trim());
  }
  cachedClient = null;
};

// SQL Schema for Supabase SQL Editor
export const SUPABASE_SQL_SCHEMA = `-- MEET UP SUPABASE SCHEMA
-- Run this in your Supabase SQL Editor:

-- 1. Create users table
create table if not exists public.users (
  id text primary key,
  uid text unique not null,
  name text not null,
  email text,
  role text default 'user',
  coins_balance int default 0,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Create rooms (meetings / calls) table
create table if not exists public.rooms (
  id text primary key,
  room_id text unique not null,
  caller_id text not null,
  caller_name text not null,
  callee_id text not null,
  callee_name text not null,
  call_type text default 'voice',
  status text default 'active', -- active, ended, muted
  is_muted boolean default false,
  started_at timestamp with time zone default timezone('utc'::text, now()),
  ended_at timestamp with time zone,
  duration int default 0
);

-- 3. Create messages table for realtime meeting & call chats
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  room_id text not null,
  sender_id text not null,
  sender_name text not null,
  sender_role text default 'user',
  message text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable Realtime on messages and rooms
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.rooms;
`;

// Sync User to Supabase
export const syncUserToSupabase = async (user: UserProfile) => {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('users').upsert({
      id: user.uid,
      uid: user.uid,
      name: user.name,
      email: user.email || '',
      role: user.role || 'user',
      coins_balance: user.coins_balance || 0,
      avatar_url: user.profile_pic || '',
      created_at: new Date().toISOString()
    }, { onConflict: 'uid' });

    if (error) {
      console.warn('Supabase syncUser warning:', error.message);
    }
  } catch (err) {
    // Non-blocking fallback
    console.warn('Supabase user sync error:', err);
  }
};

// Fetch all users from Supabase
export const fetchUsersFromSupabase = async () => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('Failed fetching users from Supabase, returning empty array:', err);
    return [];
  }
};

// Fetch verified listeners from Supabase
export const fetchListenersFromSupabase = async (): Promise<UserProfile[]> => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'listener')
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) return [];

    return data.map((d: any) => ({
      uid: d.uid || d.id,
      name: d.name || 'Verified Listener',
      email: d.email || '',
      age: Number(d.age) || 23,
      gender: d.gender || 'female',
      location: d.location || 'Tamil Nadu, India',
      bio: d.bio || 'Friendly verified listener ready to chat.',
      profile_pic: d.avatar_url || d.profile_pic || 'https://randomuser.me/api/portraits/women/44.jpg',
      interests: Array.isArray(d.interests) ? d.interests : ['Music', 'Conversations'],
      language: d.language || 'ta',
      role: 'listener' as const,
      coins_balance: Number(d.coins_balance) || 120,
      diamonds_balance: Number(d.diamonds_balance) || 45,
      voice_rate: Number(d.voice_rate) || 20,
      video_rate: Number(d.video_rate) || 50,
      status: (d.status as any) || 'online',
      is_blocked: !!d.is_blocked,
      created_at: d.created_at || new Date().toISOString(),
    }));
  } catch (err) {
    console.warn('Could not fetch listeners from Supabase (falling back to Firestore):', err);
    return [];
  }
};

export interface RoomRecord {
  id: string;
  room_id: string;
  caller_id: string;
  caller_name: string;
  callee_id: string;
  callee_name: string;
  call_type: 'voice' | 'video';
  status: 'active' | 'ended' | 'muted';
  is_muted?: boolean;
  started_at?: string;
  ended_at?: string;
  duration?: number;
}

// Record active room
export const saveRoomToSupabase = async (room: RoomRecord) => {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('rooms').upsert({
      id: room.room_id,
      room_id: room.room_id,
      caller_id: room.caller_id,
      caller_name: room.caller_name,
      callee_id: room.callee_id,
      callee_name: room.callee_name,
      call_type: room.call_type,
      status: room.status,
      is_muted: room.is_muted || false,
      started_at: room.started_at || new Date().toISOString(),
    }, { onConflict: 'room_id' });

    if (error) console.warn('Supabase saveRoom error:', error.message);
  } catch (err) {
    console.warn('Supabase saveRoom exception:', err);
  }
};

// Update room (end meeting, mute, etc.)
export const updateRoomInSupabase = async (roomId: string, updates: Partial<RoomRecord>) => {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('rooms').update(updates).eq('room_id', roomId);
    if (error) console.warn('Supabase updateRoom error:', error.message);
  } catch (err) {
    console.warn('Supabase updateRoom exception:', err);
  }
};

// Fetch rooms
export const fetchRoomsFromSupabase = async () => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('rooms').select('*').order('started_at', { ascending: false });
    if (error) throw error;
    return (data as RoomRecord[]) || [];
  } catch (err) {
    console.warn('Failed fetching rooms from Supabase:', err);
    return [];
  }
};

export interface ChatMessageRecord {
  id?: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  message: string;
  created_at?: string;
}

// Send chat message in Supabase
export const sendChatMessageToSupabase = async (msg: ChatMessageRecord) => {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('messages').insert({
      room_id: msg.room_id,
      sender_id: msg.sender_id,
      sender_name: msg.sender_name,
      sender_role: msg.sender_role,
      message: msg.message,
      created_at: new Date().toISOString()
    });
    if (error) console.warn('Supabase sendChatMessage error:', error.message);
  } catch (err) {
    console.warn('Supabase message send exception:', err);
  }
};

// Fetch chat messages for a room
export const fetchRoomMessagesFromSupabase = async (roomId: string) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data as ChatMessageRecord[]) || [];
  } catch (err) {
    return [];
  }
};

// Realtime subscriber for chat messages
export const subscribeToRoomMessages = (
  roomId: string, 
  onNewMessage: (msg: ChatMessageRecord) => void
) => {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel(`room-chat-${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`
      },
      (payload) => {
        if (payload.new) {
          onNewMessage(payload.new as ChatMessageRecord);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// Realtime subscriber for rooms
export const subscribeToRoomsRealtime = (onChange: () => void) => {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel('rooms-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rooms'
      },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
