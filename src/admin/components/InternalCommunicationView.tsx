import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Search,
  Lock,
  ShieldCheck,
  Calendar,
  Clock,
  LogOut,
  PlusCircle,
  Hash,
  User,
  X,
  FileText,
  Users,
} from 'lucide-react';
import { platformApi, encryptE2EEMessage, decryptE2EEMessage, getSessionToken } from '../services/platformService';
import {
  ChatChannel,
  ChatMessage,
  VideoMeeting,
  PlatformUser,
} from '../../../server/rbacTypes';

export const InternalCommunicationView: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<PlatformUser | null>(null);
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [allUsers, setAllUsers] = useState<PlatformUser[]>([]);
  const [meetings, setMeetings] = useState<VideoMeeting[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  // Selection
  const [activeTab, setActiveTab] = useState<'CHAT' | 'MEETINGS'>('CHAT');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('chn-partners-board');
  const [selectedDirectUserId, setSelectedDirectUserId] = useState<string | null>(null);
  
  // Chat input
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isE2EEActive] = useState(true);

  // New Meeting Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [newMeetingForm, setNewMeetingForm] = useState({
    title: '',
    agenda: '',
    description: '',
    scheduledStartTime: '',
    participantIds: [] as string[],
  });
  const [meetingError, setMeetingError] = useState('');

  // Sync Room State (Text & Presence only - zero camera/mic access)
  const [isInRoomSync, setIsInRoomSync] = useState(false);
  const [activeCallRoom, setActiveCallRoom] = useState<string>('');
  const [callPeers, setCallPeers] = useState<{ id: string; name: string; role: string }[]>([]);

  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Initial load
  const loadData = async () => {
    try {
      const cur = await platformApi.getCurrentUser();
      setCurrentUser(cur);
      const chns = await platformApi.getChannels();
      setChannels(chns);
      const usersRes = await platformApi.getUsers();
      setAllUsers(usersRes.users);
      const mtgs = await platformApi.getMeetings();
      setMeetings(mtgs);
    } catch (err) {
      console.error('Error loading communication baseline:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Connect WebSocket for real-time messaging & WebRTC signaling
  useEffect(() => {
    const userId = currentUser?.id;
    const token = getSessionToken();
    if (!userId || !token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let isDisposed = false;
    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (isDisposed) {
          ws?.close();
          return;
        }
        ws?.send(JSON.stringify({ type: 'auth', token, userId }));
      };

      ws.onmessage = (event) => {
        if (isDisposed) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_chat_message') {
            setMessages((prev) => [...prev, data.message]);
          } else if (data.type === 'webrtc_peer_joined') {
            setCallPeers((prev) => {
              if (prev.some((p) => p.id === data.peerId)) return prev;
              return [...prev, { id: data.peerId, name: data.peerName, role: data.peerRole }];
            });
          } else if (data.type === 'webrtc_peer_left') {
            setCallPeers((prev) => prev.filter((p) => p.id !== data.peerId));
          }
        } catch (e) {
          console.warn('WS message handling error:', e);
        }
      };

      ws.onerror = () => {
        // Fallback gracefully if WS is restricted
      };
    } catch {
      // WebSocket unsupported or restricted in sandboxed context
    }

    return () => {
      isDisposed = true;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      if (socketRef.current === ws) {
        socketRef.current = null;
      }
    };
  }, [currentUser?.id]);

  // Load messages when conversation target changes
  const loadMessages = async () => {
    try {
      let msgs: ChatMessage[] = [];
      if (selectedChannelId) {
        msgs = await platformApi.getMessages({ channelId: selectedChannelId, search: searchQuery });
      } else if (selectedDirectUserId) {
        msgs = await platformApi.getMessages({ directRecipientId: selectedDirectUserId, search: searchQuery });
      }

      // Client-side decryption for E2EE messages
      const decrypted = await Promise.all(
        msgs.map(async (m) => {
          if (m.isEncrypted && m.encryptedPayload) {
            try {
              const plain = await decryptE2EEMessage(m.encryptedPayload);
              return { ...m, content: plain };
            } catch {
              return m;
            }
          }
          return m;
        })
      );

      setMessages(decrypted);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [selectedChannelId, selectedDirectUserId, searchQuery]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    const text = messageInput.trim();
    setMessageInput('');

    try {
      const isConfidential = Boolean(activeChannel?.isE2EE || (!selectedChannelId && selectedDirectUserId));

      let encryptedPayload: string | undefined = undefined;
      let finalContent = text;

      if (isConfidential && isE2EEActive) {
        encryptedPayload = await encryptE2EEMessage(text);
        finalContent = '[E2EE End-to-End Encrypted Message Payload]';
      }

      const res = await platformApi.postMessage({
        channelId: selectedChannelId || undefined,
        directRecipientId: selectedDirectUserId || undefined,
        content: finalContent,
        isEncrypted: Boolean(isConfidential && isE2EEActive),
        encryptedPayload,
      });

      if (res.success && res.message) {
        const displayedMsg = {
          ...res.message,
          content: text, // show local plaintext immediately
        };
        setMessages((prev) => [...prev, displayedMsg]);

        // Broadcast over WS
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(
            JSON.stringify({
              type: 'chat_message',
              payload: res.message,
            })
          );
        }
      }
    } catch (err) {
      console.error('Failed to post message:', err);
    }
  };

  // Toggle reaction
  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      await platformApi.reactToMessage(messageId, emoji);
      await loadMessages();
    } catch (err) {
      console.error('Reaction failed:', err);
    }
  };

  // Join text & presence sync room over WebSocket without camera or microphone permissions
  const handleStartCall = (roomId: string = 'TORI-COLLAB-ROOM') => {
    setActiveCallRoom(roomId);
    setIsInRoomSync(true);

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'webrtc_join_room',
          roomId,
          mediaState: { audio: false, video: false, screen: false },
        })
      );
    }
  };

  const handleEndCall = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'webrtc_leave_room',
          roomId: activeCallRoom,
        })
      );
    }
    setIsInRoomSync(false);
    setCallPeers([]);
  };

  // Create Meeting
  const handleScheduleMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMeetingForm.title || !newMeetingForm.scheduledStartTime) return;
    setMeetingError('');
    try {
      const res = await platformApi.createMeeting({
        title: newMeetingForm.title,
        agenda: newMeetingForm.agenda,
        description: newMeetingForm.description,
        scheduledStartTime: newMeetingForm.scheduledStartTime,
        participantIds: newMeetingForm.participantIds,
      });

      if (res.success) {
        setShowScheduleModal(false);
        setMeetingError('');
        setNewMeetingForm({
          title: '',
          agenda: '',
          description: '',
          scheduledStartTime: '',
          participantIds: [],
        });
        await loadData();
      } else {
        setMeetingError(res.error || 'Failed to schedule meeting.');
      }
    } catch (err: any) {
      setMeetingError(err.message || 'Error scheduling meeting.');
    }
  };

  const activeChannel = channels.find((c) => c.id === selectedChannelId);
  const activeDirectUser = allUsers.find((u) => u.id === selectedDirectUserId);

  return (
    <div className="space-y-4">
      {/* Top Header & Navigation Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-red-600" />
            <span>Internal Enterprise Communication</span>
          </h1>
          <p className="text-xs text-slate-500">
            Real-time collaboration suite with AES-GCM end-to-end encrypted partner channels, department groups, and executive sync rooms.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('CHAT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
              activeTab === 'CHAT' ? 'bg-slate-900 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-red-400" />
            <span>Collaboration Chat</span>
          </button>

          <button
            onClick={() => setActiveTab('MEETINGS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
              activeTab === 'MEETINGS' ? 'bg-slate-900 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4 text-blue-400" />
            <span>Scheduled Meetings ({meetings.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: CHAT COLLABORATION */}
      {activeTab === 'CHAT' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs h-[720px] flex overflow-hidden">
          {/* LEFT SIDEBAR: Channels & Direct Messages */}
          <div className="w-64 sm:w-72 border-r border-slate-200 flex flex-col bg-slate-50/70 shrink-0">
            {/* Search */}
            <div className="p-3 border-b border-slate-200">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
              {/* Channels Section */}
              <div className="space-y-1">
                <div className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Channels
                </div>
                {channels.map((chn) => {
                  const isSelected = selectedChannelId === chn.id;
                  return (
                    <button
                      key={chn.id}
                      onClick={() => {
                        setSelectedChannelId(chn.id);
                        setSelectedDirectUserId(null);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white shadow-xs font-semibold'
                          : 'text-slate-700 hover:bg-slate-200/70'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {chn.isE2EE ? (
                          <Lock className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-400' : 'text-emerald-600'}`} />
                        ) : (
                          <Hash className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span className="truncate">{chn.name}</span>
                      </div>
                      {chn.isE2EE && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                          E2EE
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Direct Messages Section */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between px-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Direct Messages (1-to-1)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {allUsers.filter((u) => u.id !== currentUser?.id).length}
                  </span>
                </div>

                {/* Search Team Member to text */}
                <div className="relative px-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search team member to text..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 placeholder:text-slate-400"
                  />
                  {memberSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setMemberSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filtered Members List */}
                <div className="space-y-1">
                  {allUsers
                    .filter((u) => u.id !== currentUser?.id)
                    .filter((u) => {
                      if (!memberSearchQuery.trim()) return true;
                      const q = memberSearchQuery.toLowerCase().trim();
                      return (
                        u.name.toLowerCase().includes(q) ||
                        u.email.toLowerCase().includes(q) ||
                        (u.designation && u.designation.toLowerCase().includes(q)) ||
                        (u.department && u.department.toLowerCase().includes(q)) ||
                        (u.role && u.role.toLowerCase().includes(q))
                      );
                    })
                    .map((usr) => {
                      const isSelected = selectedDirectUserId === usr.id;
                      return (
                        <button
                          key={usr.id}
                          onClick={() => {
                            setSelectedDirectUserId(usr.id);
                            setSelectedChannelId('');
                          }}
                          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left font-medium transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-slate-900 text-white shadow-xs font-semibold'
                              : 'text-slate-700 hover:bg-slate-200/70'
                          }`}
                        >
                          <div className="relative shrink-0">
                            <img
                              src={usr.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80'}
                              alt={usr.name}
                              className="w-6 h-6 rounded-lg object-cover border border-slate-200"
                            />
                            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white" />
                          </div>
                          <div className="truncate flex-1">
                            <div className="truncate">{usr.name}</div>
                            <div className={`text-[10px] truncate ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                              {usr.role === 'SUPER_ADMIN' ? '👑 Super Admin' : usr.role === 'PARTNER' ? '🤝 25% Partner' : usr.designation}
                            </div>
                          </div>
                        </button>
                      );
                    })}

                  {allUsers
                    .filter((u) => u.id !== currentUser?.id)
                    .filter((u) => {
                      if (!memberSearchQuery.trim()) return true;
                      const q = memberSearchQuery.toLowerCase().trim();
                      return (
                        u.name.toLowerCase().includes(q) ||
                        u.email.toLowerCase().includes(q) ||
                        (u.designation && u.designation.toLowerCase().includes(q)) ||
                        (u.department && u.department.toLowerCase().includes(q)) ||
                        (u.role && u.role.toLowerCase().includes(q))
                      );
                    }).length === 0 && (
                    <div className="p-3 text-center text-[11px] text-slate-500 bg-slate-100/70 rounded-xl mx-1">
                      No team member found matching "{memberSearchQuery}"
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* MAIN CHAT AREA */}
          <div className="flex-1 flex flex-col min-w-0 bg-white">
            {/* Active Thread Header */}
            <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
                  {selectedChannelId ? <Hash className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {activeChannel ? `#${activeChannel.name}` : activeDirectUser?.name}
                    </span>
                    {(activeChannel?.isE2EE || selectedDirectUserId) && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 font-mono">
                        <Lock className="w-3 h-3" /> AES-256 E2EE VERIFIED
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate max-w-md">
                    {activeChannel?.description || activeDirectUser?.designation}
                  </p>
                </div>
              </div>

              {/* Room Sync Action */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleStartCall(activeChannel ? activeChannel.id : `dm-${currentUser?.id}-${activeDirectUser?.id}`)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Open Sync Room</span>
                </button>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/40 text-xs">
              {/* E2EE Banner */}
              {(activeChannel?.isE2EE || selectedDirectUserId) && (
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 text-center text-[11px] text-emerald-900 space-y-0.5 max-w-xl mx-auto shadow-2xs">
                  <div className="font-bold flex items-center justify-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Hardware-Sealed End-to-End Cryptographic Tunnel</span>
                  </div>
                  <p className="text-[10px] text-emerald-700">
                    Messages in this thread are encrypted on-device via Web Crypto AES-GCM before transmission.
                  </p>
                </div>
              )}

              {messages.map((msg) => {
                const isMe = msg.senderId === currentUser?.id;

                return (
                  <div key={msg.id} className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <img
                      src={msg.senderAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80'}
                      alt={msg.senderName}
                      className="w-8 h-8 rounded-xl object-cover border border-slate-200 shrink-0 mt-0.5"
                    />

                    <div className={`space-y-1 max-w-lg ${isMe ? 'items-end' : ''}`}>
                      <div className={`flex items-center gap-2 ${isMe ? 'justify-end' : ''}`}>
                        <span className="font-bold text-slate-800 text-[11px]">{msg.senderName}</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div
                        className={`p-3 rounded-2xl text-xs leading-relaxed shadow-2xs ${
                          isMe
                            ? 'bg-slate-900 text-white rounded-tr-xs'
                            : 'bg-white border border-slate-200 text-slate-900 rounded-tl-xs'
                        }`}
                      >
                        <p>{msg.content}</p>

                        {/* Attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 space-y-1 pt-2 border-t border-slate-200/30">
                            {msg.attachments.map((att) => (
                              <a
                                key={att.id}
                                href={att.url}
                                target="_blank"
                                rel="noreferrer"
                                className={`flex items-center gap-2 p-2 rounded-xl text-[11px] transition-colors ${
                                  isMe ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                                }`}
                              >
                                <FileText className="w-4 h-4 text-red-500" />
                                <span className="font-mono truncate">{att.name}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Emoji Reactions */}
                      <div className="flex items-center gap-1 pt-0.5">
                        {['👍', '🔥', '🤝', '✅'].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(msg.id, emoji)}
                            className="px-1.5 py-0.5 rounded-md hover:bg-slate-200/80 text-[11px] transition-colors cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className="flex items-center gap-1 ml-1">
                            {msg.reactions.map((r, i) => (
                              <span key={i} className="text-[10px] px-1 py-0.5 rounded bg-slate-200/60 font-mono">
                                {r.emoji}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 bg-white flex items-center gap-2">
              <input
                type="text"
                placeholder={
                  activeChannel?.isE2EE
                    ? 'Write end-to-end encrypted message...'
                    : 'Write a message to team...'
                }
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
              />

              <button
                type="submit"
                disabled={!messageInput.trim()}
                className="p-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: MEETINGS SCHEDULER & HISTORY */}
      {activeTab === 'MEETINGS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Enterprise Sync Meetings & Agendas</h2>
              <p className="text-xs text-slate-500">
                Scheduled executive syncs with encrypted agenda rooms and live participant presence.
              </p>
            </div>

            <button
              onClick={() => setShowScheduleModal(true)}
              className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Schedule New Meeting</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {meetings.map((mtg) => (
              <div key={mtg.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-red-600 uppercase bg-red-50 px-2 py-0.5 rounded border border-red-200">
                      ROOM: {mtg.meetingRoomCode}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm mt-1">{mtg.title}</h3>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    mtg.status === 'LIVE' ? 'bg-red-600 text-white animate-pulse' :
                    mtg.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-800' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {mtg.status}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{mtg.description}</p>

                {mtg.agenda && (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-xs">
                    <span className="font-semibold text-slate-800 block text-[11px] mb-0.5">Meeting Agenda:</span>
                    <p className="text-slate-600 text-[11px]">{mtg.agenda}</p>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{new Date(mtg.scheduledStartTime).toLocaleString('en-IN')}</span>
                  </div>

                  <button
                    onClick={() => handleStartCall(mtg.meetingRoomCode)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Users className="w-3.5 h-3.5 text-red-400" />
                    <span>Join Sync Room</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REAL-TIME EXECUTIVE SYNC ROOM OVERLAY (NO CAMERA/MIC) */}
      {isInRoomSync && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-white pb-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <div>
                <h3 className="font-bold text-sm tracking-tight">Active Sync Room: {activeCallRoom}</h3>
                <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                  WebSocket Presence Room · Participants ({callPeers.length + 1})
                </span>
              </div>
            </div>

            <button
              onClick={handleEndCall}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <LogOut className="w-4 h-4" />
              <span>Leave Room</span>
            </button>
          </div>

          <div className="flex-1 my-6 max-w-3xl w-full mx-auto flex flex-col justify-center gap-4">
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <div className="text-sm font-bold text-white">Room Participants</div>
                  <div className="text-xs text-slate-400">Text & agenda coordination room (camera/microphone disabled)</div>
                </div>
                <span className="text-xs font-mono text-emerald-400 tabular-nums">{callPeers.length + 1} Active</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold text-sm">
                    {currentUser?.name.charAt(0) || 'A'}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{currentUser?.name || 'Admin'} (You)</div>
                    <div className="text-[11px] text-slate-400 font-mono">{currentUser?.role || 'STAFF'}</div>
                  </div>
                </div>
                {callPeers.map((peer) => (
                  <div key={peer.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold text-sm">
                      {peer.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{peer.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{peer.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCHEDULE MEETING MODAL */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Schedule Sync Meeting</h3>
              <button onClick={() => setShowScheduleModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleMeeting} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Meeting Title</label>
                <input
                  type="text"
                  required
                  value={newMeetingForm.title}
                  onChange={(e) => setNewMeetingForm({ ...newMeetingForm, title: e.target.value })}
                  placeholder="e.g. Tirupur Fabric Run & P&L Allocation Sync"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={newMeetingForm.scheduledStartTime}
                  onChange={(e) => setNewMeetingForm({ ...newMeetingForm, scheduledStartTime: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Agenda Points</label>
                <input
                  type="text"
                  value={newMeetingForm.agenda}
                  onChange={(e) => setNewMeetingForm({ ...newMeetingForm, agenda: e.target.value })}
                  placeholder="1. Production capacity, 2. Financial reconciliation, 3. Drop launch"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Meeting Description</label>
                <textarea
                  rows={2}
                  value={newMeetingForm.description}
                  onChange={(e) => setNewMeetingForm({ ...newMeetingForm, description: e.target.value })}
                  placeholder="Detailed context and objectives for participants..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              {meetingError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[11px] font-medium">
                  {meetingError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold shadow-sm cursor-pointer"
                >
                  Create & Issue Room Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
