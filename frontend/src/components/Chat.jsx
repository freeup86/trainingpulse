import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  MessageCircle,
  Send,
  Search,
  Plus,
  Phone,
  Video,
  MoreHorizontal,
  User,
  Users,
  Hash,
  Settings,
  X,
  Paperclip,
  Smile,
  Circle,
  AtSign,
  Bell,
  BellOff,
  Pin,
  Archive,
  Trash2,
  Edit,
  Reply,
  Image,
  File,
  Check,
  CheckCheck,
  Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { users } from '../lib/api';
import { formatDate, formatRelativeTime } from '../lib/utils';

// Chat Types
const CHAT_TYPES = {
  DIRECT: 'direct',
  GROUP: 'group',
  CHANNEL: 'channel'
};

// Message Status
const MESSAGE_STATUS = {
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed'
};

// Main Chat Component
export const Chat = ({ 
  className = '',
  defaultChatId = null,
  showSidebar = true,
  compactMode = false
}) => {
  const queryClient = useQueryClient();
  const [selectedChatId, setSelectedChatId] = useState(defaultChatId);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  // Fetch chats list
  const { data: chatsData } = useQuery({
    queryKey: ['chats'],
    queryFn: () => chats.getAll(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const chatsList = chatsData?.data || [];
  const selectedChat = chatsList.find(chat => chat.id === selectedChatId);

  useEffect(() => {
    if (!selectedChatId && chatsList.length > 0) {
      setSelectedChatId(chatsList[0].id);
    }
  }, [chatsList, selectedChatId]);

  if (compactMode) {
    return (
      <CompactChat
        chatId={selectedChatId}
        onChatSelect={setSelectedChatId}
        className={className}
      />
    );
  }

  return (
    <div className={`flex h-full bg-white dark:bg-gray-900 ${className}`}>
      {/* Sidebar */}
      {showSidebar && (
        <div className="w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          <ChatSidebar
            chats={chatsList}
            selectedChatId={selectedChatId}
            onChatSelect={setSelectedChatId}
            onNewChat={() => setShowNewChatModal(true)}
          />
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            <ChatHeader
              chat={selectedChat}
              onShowInfo={() => setShowChatInfo(true)}
            />
            <ChatMessages chatId={selectedChatId} />
            <ChatInput chatId={selectedChatId} />
          </>
        ) : (
          <ChatEmptyState onNewChat={() => setShowNewChatModal(true)} />
        )}
      </div>

      {/* Chat Info Panel */}
      {showChatInfo && selectedChat && (
        <div className="w-80 border-l border-gray-200 dark:border-gray-700">
          <ChatInfo
            chat={selectedChat}
            onClose={() => setShowChatInfo(false)}
          />
        </div>
      )}

      {/* New Chat Modal */}
      {showNewChatModal && (
        <NewChatModal onClose={() => setShowNewChatModal(false)} />
      )}
    </div>
  );
};

// Chat Sidebar
const ChatSidebar = ({ chats, selectedChatId, onChatSelect, onNewChat }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // all, unread, groups, channels

  const filteredChats = chats.filter(chat => {
    const matchesSearch = chat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         chat.last_message?.content?.toLowerCase().includes(searchTerm.toLowerCase());
    
    switch (filter) {
      case 'unread':
        return matchesSearch && chat.unread_count > 0;
      case 'groups':
        return matchesSearch && chat.type === CHAT_TYPES.GROUP;
      case 'channels':
        return matchesSearch && chat.type === CHAT_TYPES.CHANNEL;
      default:
        return matchesSearch;
    }
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Messages
          </h2>
          <button
            onClick={onNewChat}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
        </div>

        {/* Filters */}
        <div className="flex space-x-1 mt-2">
          {[
            { key: 'all', label: 'All' },
            { key: 'unread', label: 'Unread' },
            { key: 'groups', label: 'Groups' },
            { key: 'channels', label: 'Channels' }
          ].map((filterOption) => (
            <button
              key={filterOption.key}
              onClick={() => setFilter(filterOption.key)}
              className={`px-2 py-1 text-xs rounded-full transition-colors ${
                filter === filterOption.key
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {filterOption.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {filteredChats.map((chat) => (
          <ChatListItem
            key={chat.id}
            chat={chat}
            isSelected={chat.id === selectedChatId}
            onClick={() => onChatSelect(chat.id)}
          />
        ))}
        
        {filteredChats.length === 0 && (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            {searchTerm ? 'No conversations found' : 'No conversations yet'}
          </div>
        )}
      </div>
    </div>
  );
};

// Chat List Item
const ChatListItem = ({ chat, isSelected, onClick }) => {
  const getChatIcon = () => {
    switch (chat.type) {
      case CHAT_TYPES.GROUP:
        return <Users className="w-5 h-5" />;
      case CHAT_TYPES.CHANNEL:
        return <Hash className="w-5 h-5" />;
      default:
        return <User className="w-5 h-5" />;
    }
  };

  const getStatusIcon = () => {
    if (chat.type === CHAT_TYPES.DIRECT && chat.participants?.[0]?.is_online) {
      return <Circle className="w-3 h-3 text-green-500 fill-current" />;
    }
    return null;
  };

  return (
    <div
      onClick={onClick}
      className={`p-3 cursor-pointer transition-colors border-l-4 ${
        isSelected
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-transparent'
      }`}
    >
      <div className="flex items-start space-x-3">
        {/* Avatar */}
        <div className="relative">
          <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-400">
            {getChatIcon()}
          </div>
          <div className="absolute -bottom-1 -right-1">
            {getStatusIcon()}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-medium truncate ${
              isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'
            }`}>
              {chat.name}
            </h3>
            <div className="flex items-center space-x-1">
              {chat.last_message && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatRelativeTime(chat.last_message.created_at)}
                </span>
              )}
              {chat.unread_count > 0 && (
                <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                  {chat.unread_count > 99 ? '99+' : chat.unread_count}
                </span>
              )}
            </div>
          </div>
          
          {chat.last_message && (
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-1">
              {chat.last_message.sender_name && chat.type !== CHAT_TYPES.DIRECT && (
                <span className="font-medium">{chat.last_message.sender_name}: </span>
              )}
              {chat.last_message.content || '📎 Attachment'}
            </p>
          )}
          
          {chat.is_muted && (
            <div className="flex items-center mt-1">
              <BellOff className="w-3 h-3 text-gray-400 mr-1" />
              <span className="text-xs text-gray-400">Muted</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Chat Header
const ChatHeader = ({ chat, onShowInfo }) => {
  const [showMenu, setShowMenu] = useState(false);

  const getChatIcon = () => {
    switch (chat.type) {
      case CHAT_TYPES.GROUP:
        return <Users className="w-6 h-6" />;
      case CHAT_TYPES.CHANNEL:
        return <Hash className="w-6 h-6" />;
      default:
        return <User className="w-6 h-6" />;
    }
  };

  const getParticipantCount = () => {
    if (chat.type === CHAT_TYPES.DIRECT) return null;
    return `${chat.participants?.length || 0} members`;
  };

  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="text-gray-600 dark:text-gray-400">
            {getChatIcon()}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {chat.name}
            </h2>
            {getParticipantCount() && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {getParticipantCount()}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {chat.type === CHAT_TYPES.DIRECT && (
            <>
              <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <Phone className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <Video className="w-5 h-5" />
              </button>
            </>
          )}
          
          <button
            onClick={onShowInfo}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Settings className="w-5 h-5" />
          </button>
          
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[150px]">
                <ChatHeaderMenu chat={chat} onClose={() => setShowMenu(false)} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Chat Header Menu
const ChatHeaderMenu = ({ chat, onClose }) => {
  const queryClient = useQueryClient();

  const updateChatMutation = useMutation({
    mutationFn: ({ id, data }) => chats.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['chats']);
      onClose();
    },
  });

  const handleMute = () => {
    updateChatMutation.mutate({
      id: chat.id,
      data: { is_muted: !chat.is_muted }
    });
  };

  const menuItems = [
    {
      icon: chat.is_muted ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />,
      label: chat.is_muted ? 'Unmute' : 'Mute',
      onClick: handleMute
    },
    {
      icon: <Pin className="w-4 h-4" />,
      label: 'Pin to top',
      onClick: () => {}
    },
    {
      icon: <Archive className="w-4 h-4" />,
      label: 'Archive',
      onClick: () => {}
    },
    {
      icon: <Trash2 className="w-4 h-4" />,
      label: 'Delete',
      onClick: () => {},
      destructive: true
    }
  ];

  return (
    <div className="py-1">
      {menuItems.map((item, index) => (
        <button
          key={index}
          onClick={item.onClick}
          className={`w-full px-3 py-2 text-left text-sm flex items-center space-x-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
            item.destructive 
              ? 'text-red-600 dark:text-red-400' 
              : 'text-gray-700 dark:text-gray-300'
          }`}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
};

// Chat Messages
const ChatMessages = ({ chatId }) => {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Fetch messages
  const { data: messagesData, isLoading } = useQuery({
    queryKey: ['messages', chatId],
    queryFn: () => messages.getByChatId(chatId),
    enabled: !!chatId,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const messagesList = messagesData?.data || [];

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesList]);

  // Group messages by date
  const groupedMessages = messagesList.reduce((groups, message) => {
    const date = new Date(message.created_at).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  if (isLoading) {
    return (
      <div className="flex-1 p-4">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <MessageSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={messagesContainerRef}
      className="flex-1 overflow-y-auto p-4 space-y-4"
    >
      {Object.entries(groupedMessages).map(([date, msgs]) => (
        <div key={date}>
          {/* Date separator */}
          <div className="flex items-center justify-center mb-4">
            <div className="bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {new Date(date).toLocaleDateString(undefined, { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
            </div>
          </div>
          
          {/* Messages */}
          {msgs.map((message, index) => {
            const isConsecutive = index > 0 && 
              msgs[index - 1].sender_id === message.sender_id &&
              new Date(message.created_at) - new Date(msgs[index - 1].created_at) < 300000; // 5 minutes
            
            return (
              <MessageItem
                key={message.id}
                message={message}
                isConsecutive={isConsecutive}
              />
            );
          })}
        </div>
      ))}
      
      <div ref={messagesEndRef} />
    </div>
  );
};

// Message Item
const MessageItem = ({ message, isConsecutive }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const getMessageStatus = () => {
    switch (message.status) {
      case MESSAGE_STATUS.SENDING:
        return <Clock className="w-3 h-3 text-gray-400" />;
      case MESSAGE_STATUS.SENT:
        return <Check className="w-3 h-3 text-gray-400" />;
      case MESSAGE_STATUS.DELIVERED:
        return <CheckCheck className="w-3 h-3 text-gray-400" />;
      case MESSAGE_STATUS.READ:
        return <CheckCheck className="w-3 h-3 text-blue-500" />;
      case MESSAGE_STATUS.FAILED:
        return <X className="w-3 h-3 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div 
      className={`group hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded-lg ${
        isConsecutive ? 'mt-1' : 'mt-4'
      }`}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
    >
      <div className="flex items-start space-x-3">
        {/* Avatar */}
        {!isConsecutive && (
          <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </div>
        )}
        {isConsecutive && <div className="w-8" />}

        {/* Message content */}
        <div className="flex-1 min-w-0">
          {!isConsecutive && (
            <div className="flex items-center space-x-2 mb-1">
              <span className="font-medium text-gray-900 dark:text-white text-sm">
                {message.sender_name}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatDate(message.created_at)}
              </span>
            </div>
          )}
          
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isEditing ? (
                <MessageEditForm
                  message={message}
                  onSave={() => setIsEditing(false)}
                  onCancel={() => setIsEditing(false)}
                />
              ) : (
                <MessageContent message={message} />
              )}
            </div>
            
            {/* Message actions */}
            {showMenu && !isEditing && (
              <div className="flex items-center space-x-1 ml-2">
                <button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded">
                  <Reply className="w-3 h-3" />
                </button>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                >
                  <Edit className="w-3 h-3" />
                </button>
                <button className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
          
          {/* Message status */}
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center space-x-1">
              {message.edited_at && (
                <span className="text-xs text-gray-400">(edited)</span>
              )}
            </div>
            <div className="flex items-center space-x-1">
              {getMessageStatus()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Message Content
const MessageContent = ({ message }) => {
  if (message.attachments && message.attachments.length > 0) {
    return (
      <div className="space-y-2">
        {message.content && (
          <p className="text-sm text-gray-900 dark:text-white">
            {message.content}
          </p>
        )}
        <MessageAttachments attachments={message.attachments} />
      </div>
    );
  }

  return (
    <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
      {message.content}
    </p>
  );
};

// Message Attachments
const MessageAttachments = ({ attachments }) => {
  return (
    <div className="space-y-2">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="flex items-center space-x-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
          {attachment.type?.startsWith('image/') ? (
            <Image className="w-4 h-4 text-gray-500" />
          ) : (
            <File className="w-4 h-4 text-gray-500" />
          )}
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {attachment.filename}
          </span>
        </div>
      ))}
    </div>
  );
};

// Message Edit Form
const MessageEditForm = ({ message, onSave, onCancel }) => {
  const queryClient = useQueryClient();
  const [content, setContent] = useState(message.content);

  const updateMessageMutation = useMutation({
    mutationFn: ({ id, data }) => messages.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['messages']);
      onSave();
      toast.success('Message updated');
    },
  });

  const handleSave = () => {
    if (content.trim() !== message.content) {
      updateMessageMutation.mutate({
        id: message.id,
        data: { content: content.trim() }
      });
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
        rows={2}
        autoFocus
      />
      <div className="flex items-center space-x-2">
        <button
          onClick={handleSave}
          disabled={updateMessageMutation.isPending}
          className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-2 py-1 text-gray-600 dark:text-gray-400 rounded text-xs hover:text-gray-800 dark:hover:text-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// Chat Input
const ChatInput = ({ chatId }) => {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef(null);

  const sendMessageMutation = useMutation({
    mutationFn: messages.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['messages', chatId]);
      queryClient.invalidateQueries(['chats']);
      setMessage('');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to send message');
    },
  });

  const handleSend = () => {
    if (message.trim() && chatId) {
      sendMessageMutation.mutate({
        chat_id: chatId,
        content: message.trim(),
        type: 'text'
      });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  return (
    <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex items-end space-x-3">
        <div className="flex-1">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="w-full max-h-32 px-4 py-2 pr-20 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              rows={1}
            />
            
            <div className="absolute right-2 bottom-2 flex items-center space-x-1">
              <button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded">
                <Paperclip className="w-4 h-4" />
              </button>
              <button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded">
                <Smile className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        <button
          onClick={handleSend}
          disabled={!message.trim() || sendMessageMutation.isPending}
          className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// Chat Empty State
const ChatEmptyState = ({ onNewChat }) => {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center">
        <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No conversation selected
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Choose a conversation from the sidebar or start a new one
        </p>
        <button
          onClick={onNewChat}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Start new conversation
        </button>
      </div>
    </div>
  );
};

// Message Skeleton
const MessageSkeleton = () => {
  return (
    <div className="flex items-start space-x-3 animate-pulse">
      <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/4"></div>
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
      </div>
    </div>
  );
};

// Chat Info Panel
const ChatInfo = ({ chat, onClose }) => {
  return (
    <div className="h-full bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Chat Info
        </h3>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      {/* Chat details implementation */}
      <div className="space-y-4">
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
            {chat.name}
          </h4>
          {chat.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {chat.description}
            </p>
          )}
        </div>
        
        {chat.participants && (
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Members ({chat.participants.length})
            </h4>
            <div className="space-y-2">
              {chat.participants.map((participant) => (
                <div key={participant.id} className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                    <User className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                  </div>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {participant.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// New Chat Modal
const NewChatModal = ({ onClose }) => {
  const [chatType, setChatType] = useState(CHAT_TYPES.DIRECT);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [chatName, setChatName] = useState('');

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => users.getAll(),
  });

  const usersList = usersData?.data || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            New Conversation
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Type Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Type
          </label>
          <select
            value={chatType}
            onChange={(e) => setChatType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value={CHAT_TYPES.DIRECT}>Direct Message</option>
            <option value={CHAT_TYPES.GROUP}>Group Chat</option>
            <option value={CHAT_TYPES.CHANNEL}>Channel</option>
          </select>
        </div>

        {/* Chat Name (for groups/channels) */}
        {chatType !== CHAT_TYPES.DIRECT && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Name
            </label>
            <input
              type="text"
              value={chatName}
              onChange={(e) => setChatName(e.target.value)}
              placeholder="Enter chat name"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        )}

        {/* User Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {chatType === CHAT_TYPES.DIRECT ? 'Select user' : 'Add members'}
          </label>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {usersList.map((user) => (
              <label key={user.id} className="flex items-center space-x-3">
                <input
                  type={chatType === CHAT_TYPES.DIRECT ? 'radio' : 'checkbox'}
                  name="selectedUsers"
                  checked={selectedUsers.includes(user.id)}
                  onChange={(e) => {
                    if (chatType === CHAT_TYPES.DIRECT) {
                      setSelectedUsers(e.target.checked ? [user.id] : []);
                    } else {
                      setSelectedUsers(prev =>
                        e.target.checked
                          ? [...prev, user.id]
                          : prev.filter(id => id !== user.id)
                      );
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </div>
                <span className="text-sm text-gray-900 dark:text-white">
                  {user.full_name}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            disabled={selectedUsers.length === 0 || (chatType !== CHAT_TYPES.DIRECT && !chatName)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Create Chat
          </button>
        </div>
      </div>
    </div>
  );
};

// Compact Chat Component (for embedding)
const CompactChat = ({ chatId, onChatSelect, className }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`fixed bottom-4 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 ${className}`}
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className={`fixed bottom-4 right-4 w-80 h-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl ${className}`}>
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-medium text-gray-900 dark:text-white">Chat</h3>
        <button
          onClick={() => setIsExpanded(false)}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-hidden">
          {chatId ? (
            <>
              <ChatMessages chatId={chatId} />
              <ChatInput chatId={chatId} />
            </>
          ) : (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              No chat selected
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;