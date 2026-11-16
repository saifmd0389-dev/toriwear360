import {
  ChatChannel,
  ChatMessage,
  VideoMeeting,
  PlatformUser,
  PlatformRole,
  ChatAttachment,
} from './rbacTypes';
import { auditStore } from './auditStore';

class CommunicationStore {
  private channels: ChatChannel[] = [];
  private messages: ChatMessage[] = [];
  private meetings: VideoMeeting[] = [];

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    const now = new Date();
    const isoHoursAgo = (hours: number) => new Date(now.getTime() - hours * 3600000).toISOString();
    const isoMinutesAgo = (mins: number) => new Date(now.getTime() - mins * 60000).toISOString();

    // 1. Pre-configured Enterprise Channels
    this.channels = [
      {
        id: 'chn-announcements',
        name: 'official-announcements',
        description: 'Company-wide leadership announcements and strategic directives',
        type: 'ANNOUNCEMENT',
        allowedRoles: ['SUPER_ADMIN', 'PARTNER', 'STAFF'],
        createdAt: '2025-04-01T00:00:00.000Z',
        lastMessage: {
          senderName: 'Mohammed Saif',
          snippet: 'TORIWEAR Q2 Drop Planning & Tirupur Production Timeline Confirmed.',
          timestamp: isoHoursAgo(3),
        },
      },
      {
        id: 'chn-partners-board',
        name: 'partners-boardroom-e2ee',
        description: 'Confidential executive channel for Mohammed Saif, Simranjeet, Lokesh & Nagesh',
        type: 'PARTNERS_ONLY',
        allowedRoles: ['SUPER_ADMIN', 'PARTNER'],
        memberIds: ['usr-saif', 'usr-simranjeet', 'usr-lokesh', 'usr-nagesh'],
        isE2EE: true,
        createdAt: '2025-04-01T00:00:00.000Z',
        lastMessage: {
          senderName: 'Simranjeet Singh',
          snippet: 'Fabric sample weights from Tirupur mill are 240 GSM French Terry.',
          timestamp: isoMinutesAgo(45),
        },
      },
      {
        id: 'chn-operations',
        name: 'store-ops-and-warehouse',
        description: 'Inventory movements, Tirupur dispatches, Bluedart/Delhivery logistics',
        type: 'DEPARTMENT',
        allowedDepartments: ['Store & Operations', 'Inventory & Warehouse', 'Logistics & Dispatch'],
        createdAt: '2025-05-01T00:00:00.000Z',
        lastMessage: {
          senderName: 'Vikram Mehta',
          snippet: 'All 350 units of Cyber Ronin Oversized Tee checked and barcoded.',
          timestamp: isoHoursAgo(1),
        },
      },
      {
        id: 'chn-creative-lab',
        name: 'design-creative-lab',
        description: 'Streetwear lore, AI design iterations, typography, anime aesthetic canons',
        type: 'DEPARTMENT',
        allowedDepartments: ['Design & Creative', 'Executive Leadership'],
        createdAt: '2025-05-15T00:00:00.000Z',
        lastMessage: {
          senderName: 'Lokesh Kottala',
          snippet: 'Updated vector halftones for the Neo-Tokyo Cyber Punk chest print.',
          timestamp: isoHoursAgo(2),
        },
      },
      {
        id: 'chn-finance',
        name: 'finance-reconciliation',
        description: 'Daily cashflow, payment gateway settlements, vendor expenses',
        type: 'PUBLIC',
        allowedRoles: ['SUPER_ADMIN', 'PARTNER'],
        createdAt: '2025-06-01T00:00:00.000Z',
        lastMessage: {
          senderName: 'Mohammed Saif',
          snippet: 'Razorpay UPI settlements reconciled against HDFC Current Account.',
          timestamp: isoHoursAgo(5),
        },
      },
    ];

    // 2. Initial Chat Messages
    this.messages = [
      {
        id: 'msg-001',
        channelId: 'chn-announcements',
        senderId: 'usr-saif',
        senderName: 'Mohammed Saif',
        senderRole: 'SUPER_ADMIN',
        senderAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
        content: 'Welcome team. We have implemented strict enterprise data controls and server-side RBAC across TORIWEAR. All financial balances and audit logs are live and protected.',
        timestamp: isoHoursAgo(5),
        reactions: [
          { emoji: '🔥', userId: 'usr-simranjeet', userName: 'Simranjeet Singh' },
          { emoji: '🚀', userId: 'usr-lokesh', userName: 'Lokesh Kottala' },
          { emoji: '👍', userId: 'usr-nagesh', userName: 'Nagesh M' },
        ],
      },
      {
        id: 'msg-002',
        channelId: 'chn-partners-board',
        senderId: 'usr-saif',
        senderName: 'Mohammed Saif',
        senderRole: 'SUPER_ADMIN',
        senderAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
        content: 'Partners meeting at 4 PM IST today to review the Tirupur fabric run and Q2 profit distribution forecast. All four equal accounts (Saif, Simran, Lokesh, Nagesh) are calibrated to 25%.',
        timestamp: isoHoursAgo(2),
        isEncrypted: true,
        reactions: [
          { emoji: '🤝', userId: 'usr-simranjeet', userName: 'Simranjeet Singh' },
          { emoji: '✅', userId: 'usr-nagesh', userName: 'Nagesh M' },
        ],
      },
      {
        id: 'msg-003',
        channelId: 'chn-partners-board',
        senderId: 'usr-simranjeet',
        senderName: 'Simranjeet Singh',
        senderRole: 'PARTNER',
        senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
        content: 'Fabric sample weights from Tirupur mill are 240 GSM French Terry. Colorfastness test passed at grade 4.5. Ready for batch cutting.',
        timestamp: isoMinutesAgo(45),
        isEncrypted: true,
      },
      {
        id: 'msg-004',
        channelId: 'chn-creative-lab',
        senderId: 'usr-lokesh',
        senderName: 'Lokesh Kottala',
        senderRole: 'PARTNER',
        senderAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
        content: 'Updated vector halftones for the Neo-Tokyo Cyber Punk chest print. Here is the high-res vector file spec for the screen printer.',
        timestamp: isoHoursAgo(2),
        attachments: [
          {
            id: 'att-01',
            name: 'neo-tokyo-cyber-print-specs-v2.pdf',
            url: '/assets/branding/toriwear-official-logo.png',
            size: 4200000,
            type: 'document',
          }
        ],
      },
      {
        id: 'msg-005',
        channelId: 'chn-operations',
        senderId: 'usr-vikram',
        senderName: 'Vikram Mehta',
        senderRole: 'STAFF',
        senderAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop&q=80',
        content: 'All 350 units of Cyber Ronin Oversized Tee checked and barcoded. Bluedart logistics will pick up today at 6 PM IST.',
        timestamp: isoHoursAgo(1),
      },

      // Direct Message thread: Simranjeet -> Mohammed Saif
      {
        id: 'dm-001',
        senderId: 'usr-simranjeet',
        senderName: 'Simranjeet Singh',
        senderRole: 'PARTNER',
        directRecipientId: 'usr-saif',
        content: 'Hey Saif, I inspected the screen print sample on the 240 GSM loopback cotton. The puff print elevation is exactly 1.2mm as spec’d.',
        timestamp: isoHoursAgo(3),
        isEncrypted: true,
      },
      {
        id: 'dm-002',
        senderId: 'usr-saif',
        senderName: 'Mohammed Saif',
        senderRole: 'SUPER_ADMIN',
        directRecipientId: 'usr-simranjeet',
        content: 'Excellent Simran. Let us greenlight the Tirupur run of 500 units once the P&L allocation review is finished.',
        timestamp: isoHoursAgo(2),
        isEncrypted: true,
      }
    ];

    // 3. Pre-configured Real Meetings
    this.meetings = [
      {
        id: 'mtg-001',
        title: 'Q2 Executive Partners Strategy & P&L Alignment',
        agenda: '1. Tirupur production capacity review. 2. 25% equal profit share reconciliation. 3. New drop launch marketing budget approval.',
        description: 'Executive quarterly review meeting between Mohammed Saif, Simranjeet Singh, Lokesh Kottala, and Nagesh M.',
        scheduledStartTime: new Date(now.getTime() + 1800000).toISOString(), // in 30 mins
        scheduledEndTime: new Date(now.getTime() + 5400000).toISOString(),
        status: 'SCHEDULED',
        createdBy: {
          userId: 'usr-saif',
          name: 'Mohammed Saif',
          role: 'SUPER_ADMIN',
        },
        participantIds: ['usr-saif', 'usr-simranjeet', 'usr-lokesh', 'usr-nagesh'],
        meetingRoomCode: 'TORI-EXEC-ROOM-401',
        createdAt: isoHoursAgo(12),
      },
      {
        id: 'mtg-002',
        title: 'Weekly Store Operations & Warehouse Sync',
        agenda: 'Review order fulfillment velocity, return request processing times, and low-stock SKUs.',
        description: 'Weekly operations check-in with store leads and logistics dispatchers.',
        scheduledStartTime: isoHoursAgo(24),
        scheduledEndTime: isoHoursAgo(23),
        status: 'COMPLETED',
        createdBy: {
          userId: 'usr-simranjeet',
          name: 'Simranjeet Singh',
          role: 'PARTNER',
        },
        participantIds: ['usr-simranjeet', 'usr-ananya', 'usr-vikram', 'usr-rahul'],
        meetingRoomCode: 'TORI-OPS-SYNC-102',
        createdAt: isoHoursAgo(48),
      },
    ];
  }

  // --- Channels ---

  public getChannelsForUser(user: PlatformUser): ChatChannel[] {
    return this.channels.filter(chn => {
      // Check role restriction
      if (chn.allowedRoles && !chn.allowedRoles.includes(user.role)) {
        return false;
      }
      // Check explicit member list (e.g. Partners Only)
      if (chn.memberIds && !chn.memberIds.includes(user.id)) {
        return false;
      }
      // Check department restriction for staff
      if (chn.allowedDepartments && user.role === 'STAFF') {
        if (!user.department || !chn.allowedDepartments.includes(user.department)) {
          return false;
        }
      }
      return true;
    });
  }

  public getChannelById(id: string): ChatChannel | undefined {
    return this.channels.find(c => c.id === id);
  }

  public createChannel(params: {
    name: string;
    description: string;
    type: ChatChannel['type'];
    allowedRoles?: PlatformRole[];
    allowedDepartments?: any[];
    memberIds?: string[];
    isE2EE?: boolean;
    actor: PlatformUser;
  }): { success: boolean; channel?: ChatChannel; error?: string } {
    if (params.actor.role === 'STAFF') {
      return { success: false, error: 'Authorization error: Only Super Admin or Partners can create organization channels.' };
    }

    const cleanName = params.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');

    const newChannel: ChatChannel = {
      id: `chn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      description: params.description,
      type: params.type,
      allowedRoles: params.allowedRoles,
      allowedDepartments: params.allowedDepartments,
      memberIds: params.memberIds,
      isE2EE: params.isE2EE ?? (params.type === 'PARTNERS_ONLY'),
      createdAt: new Date().toISOString(),
    };

    this.channels.push(newChannel);

    auditStore.record({
      userId: params.actor.id,
      userName: params.actor.name,
      userRole: params.actor.role,
      module: 'communication' as any,
      action: 'CHAT_CHANNEL_CREATED',
      recordAffected: `#${newChannel.name} (${newChannel.type})`,
      newValue: `Created by ${params.actor.name}`,
      ipAddress: '103.21.144.12',
      severity: 'INFO',
    });

    return { success: true, channel: newChannel };
  }

  // --- Messages ---

  public getMessages(filter: {
    channelId?: string;
    directPair?: { userA: string; userB: string };
    searchQuery?: string;
  }): ChatMessage[] {
    let result = [...this.messages];

    if (filter.channelId) {
      result = result.filter(m => m.channelId === filter.channelId);
    } else if (filter.directPair) {
      const { userA, userB } = filter.directPair;
      result = result.filter(m => 
        (m.senderId === userA && m.directRecipientId === userB) ||
        (m.senderId === userB && m.directRecipientId === userA)
      );
    }

    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      result = result.filter(m => 
        m.content.toLowerCase().includes(q) ||
        m.senderName.toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  public postMessage(params: {
    channelId?: string;
    directRecipientId?: string;
    content: string;
    attachments?: ChatAttachment[];
    isEncrypted?: boolean;
    encryptedPayload?: string;
    actor: PlatformUser;
  }): { success: boolean; message?: ChatMessage; error?: string } {
    if (!params.channelId && !params.directRecipientId) {
      return { success: false, error: 'Destination required: channelId or directRecipientId.' };
    }

    // Permission check for channels
    if (params.channelId) {
      const chn = this.getChannelById(params.channelId);
      if (!chn) return { success: false, error: 'Channel does not exist.' };
      if (chn.type === 'ANNOUNCEMENT' && params.actor.role === 'STAFF') {
        return { success: false, error: 'Only Super Admin and Partners can post to announcement channels.' };
      }
      if (chn.allowedRoles && !chn.allowedRoles.includes(params.actor.role)) {
        return { success: false, error: 'You do not have permission to post to this channel.' };
      }
    }

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      channelId: params.channelId,
      directRecipientId: params.directRecipientId,
      senderId: params.actor.id,
      senderName: params.actor.name,
      senderRole: params.actor.role,
      senderAvatar: params.actor.avatarUrl,
      content: params.content,
      isEncrypted: params.isEncrypted ?? false,
      encryptedPayload: params.encryptedPayload,
      attachments: params.attachments || [],
      timestamp: new Date().toISOString(),
      reactions: [],
      readBy: [params.actor.id],
    };

    this.messages.push(newMessage);

    // Update channel lastMessage if applicable
    if (params.channelId) {
      const chn = this.getChannelById(params.channelId);
      if (chn) {
        chn.lastMessage = {
          senderName: params.actor.name,
          snippet: params.content.slice(0, 75),
          timestamp: newMessage.timestamp,
        };
      }
    }

    return { success: true, message: newMessage };
  }

  public addReaction(messageId: string, emoji: string, actor: PlatformUser): boolean {
    const msg = this.messages.find(m => m.id === messageId);
    if (!msg) return false;

    if (!msg.reactions) msg.reactions = [];
    
    // Toggle reaction
    const existingIndex = msg.reactions.findIndex(r => r.userId === actor.id && r.emoji === emoji);
    if (existingIndex >= 0) {
      msg.reactions.splice(existingIndex, 1);
    } else {
      msg.reactions.push({
        emoji,
        userId: actor.id,
        userName: actor.name,
      });
    }

    return true;
  }

  // --- Meetings ---

  public getMeetings(): VideoMeeting[] {
    return [...this.meetings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getMeetingById(id: string): VideoMeeting | undefined {
    return this.meetings.find(m => m.id === id);
  }

  public createMeeting(params: {
    title: string;
    agenda: string;
    description: string;
    scheduledStartTime: string;
    scheduledEndTime?: string;
    participantIds: string[];
    actor: PlatformUser;
  }): { success: boolean; meeting?: VideoMeeting; error?: string } {
    const meetingCode = `TORI-MTG-${Math.floor(100 + Math.random() * 900)}`;

    const newMeeting: VideoMeeting = {
      id: `mtg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: params.title,
      agenda: params.agenda,
      description: params.description,
      scheduledStartTime: params.scheduledStartTime,
      scheduledEndTime: params.scheduledEndTime,
      status: 'SCHEDULED',
      createdBy: {
        userId: params.actor.id,
        name: params.actor.name,
        role: params.actor.role,
      },
      participantIds: Array.from(new Set([params.actor.id, ...params.participantIds])),
      activeCallParticipants: [],
      meetingRoomCode: meetingCode,
      createdAt: new Date().toISOString(),
    };

    this.meetings.unshift(newMeeting);

    auditStore.record({
      userId: params.actor.id,
      userName: params.actor.name,
      userRole: params.actor.role,
      module: 'communication' as any,
      action: 'MEETING_SCHEDULED',
      recordAffected: `Meeting: "${newMeeting.title}" [Code: ${meetingCode}]`,
      newValue: `Scheduled for ${newMeeting.scheduledStartTime}, Host: ${params.actor.name}`,
      ipAddress: '103.21.144.12',
      severity: 'INFO',
    });

    return { success: true, meeting: newMeeting };
  }

  public updateMeetingStatus(
    id: string,
    status: VideoMeeting['status'],
    actor: PlatformUser
  ): { success: boolean; meeting?: VideoMeeting; error?: string } {
    const target = this.getMeetingById(id);
    if (!target) return { success: false, error: 'Meeting not found.' };

    target.status = status;

    auditStore.record({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      module: 'communication' as any,
      action: 'MEETING_STATUS_CHANGED',
      recordAffected: `Meeting "${target.title}" (ID: ${target.id})`,
      newValue: `Status changed to ${status} by ${actor.name}`,
      ipAddress: '103.21.144.12',
      severity: 'INFO',
    });

    return { success: true, meeting: target };
  }
}

export const communicationStore = new CommunicationStore();
