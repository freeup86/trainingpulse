import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  MessageCircle, 
  Send, 
  Paperclip, 
  Smile, 
  MoreHorizontal,
  Edit,
  Trash2,
  Reply,
  Heart,
  User,
  AtSign
} from 'lucide-react';
import toast from 'react-hot-toast';
import { comments, users } from '../lib/api';
import { formatDate } from '../lib/utils';

// Main Comments Component
export const Comments = ({ entityType, entityId, className = '' }) => {
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const textareaRef = useRef(null);

  // Fetch comments
  const { data: commentsData, isLoading } = useQuery({
    queryKey: ['comments', entityType, entityId],
    queryFn: () => comments.getByEntity(entityType, entityId),
    enabled: !!(entityType && entityId),
  });

  // Fetch users for mentions
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => users.getAll(),
  });

  const commentsList = Array.isArray(commentsData?.data?.data) ? commentsData.data.data : 
                      Array.isArray(commentsData?.data) ? commentsData.data : 
                      Array.isArray(commentsData) ? commentsData : [];
  const usersList = Array.isArray(usersData?.data?.data?.users) ? usersData.data.data.users :
                    Array.isArray(usersData?.data?.users) ? usersData.data.users :
                    Array.isArray(usersData?.data?.data) ? usersData.data.data :
                    Array.isArray(usersData?.data) ? usersData.data : 
                    Array.isArray(usersData) ? usersData : [];

  // Group comments by thread
  const groupedComments = commentsList.reduce((acc, comment) => {
    if (!comment.parent_id) {
      acc[comment.id] = {
        ...comment,
        replies: commentsList.filter(c => c.parent_id === comment.id)
      };
    }
    return acc;
  }, {});

  const topLevelComments = Object.values(groupedComments).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center space-x-2">
        <MessageCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Comments ({commentsList.length})
        </h3>
      </div>

      {/* New Comment Form */}
      <CommentForm
        entityType={entityType}
        entityId={entityId}
        parentId={replyingTo}
        users={usersList}
        onCancel={() => setReplyingTo(null)}
        placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
      />

      {/* Comments List */}
      {isLoading ? (
        <CommentsSkeleton />
      ) : (
        <div className="space-y-6">
          {topLevelComments.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No comments yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Start the conversation by adding the first comment
              </p>
            </div>
          ) : (
            topLevelComments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                entityType={entityType}
                entityId={entityId}
                users={usersList}
                onReply={setReplyingTo}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

// Comment Form Component
const CommentForm = ({ 
  entityType, 
  entityId, 
  parentId, 
  users = [], 
  onCancel, 
  placeholder = "Write a comment...",
  initialContent = '',
  isEditing = false,
  commentId = null,
  onSave = null
}) => {
  const queryClient = useQueryClient();
  const [content, setContent] = useState(initialContent);
  const [mentions, setMentions] = useState([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const textareaRef = useRef(null);

  // Create comment mutation
  const createMutation = useMutation({
    mutationFn: isEditing ? 
      () => comments.update(commentId, { content, mentions }) :
      () => parentId ? 
        comments.reply(parentId, { content, mentions }) :
        comments.create({ entity_type: entityType, entity_id: entityId, content, mentions }),
    onSuccess: () => {
      queryClient.invalidateQueries(['comments', entityType, entityId]);
      setContent('');
      setMentions([]);
      if (onCancel) onCancel();
      if (onSave) onSave();
      toast.success(isEditing ? 'Comment updated' : 'Comment added');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to save comment');
    },
  });

  // Handle @ mentions
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleInput = () => {
      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = content.substring(0, cursorPos);
      const atIndex = textBeforeCursor.lastIndexOf('@');
      
      if (atIndex !== -1 && atIndex === textBeforeCursor.length - 1) {
        setShowMentions(true);
        setMentionSearch('');
      } else if (atIndex !== -1) {
        const searchTerm = textBeforeCursor.substring(atIndex + 1);
        if (searchTerm.includes(' ')) {
          setShowMentions(false);
        } else {
          setShowMentions(true);
          setMentionSearch(searchTerm);
        }
      } else {
        setShowMentions(false);
      }
    };

    textarea.addEventListener('input', handleInput);
    return () => textarea.removeEventListener('input', handleInput);
  }, [content]);

  const handleMentionSelect = (user) => {
    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = content.substring(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1) {
      const newContent = 
        content.substring(0, atIndex) + 
        `@${user.full_name || user.name || 'Unknown'} ` + 
        content.substring(cursorPos);
      
      setContent(newContent);
      setMentions(prev => [...prev, user.id]);
      setShowMentions(false);
      
      // Focus back to textarea
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = atIndex + (user.full_name || user.name || 'Unknown').length + 2;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  const filteredUsers = users.filter(user =>
    user && (user.full_name || user.name || '').toLowerCase().includes(mentionSearch.toLowerCase())
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (content.trim()) {
      createMutation.mutate();
    }
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
          />
          
          {/* Mentions Dropdown */}
          {showMentions && filteredUsers.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
              {filteredUsers.slice(0, 5).map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleMentionSelect(user)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                >
                  <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                    <User className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                  </div>
                  <span className="text-sm text-gray-900 dark:text-white">{user.full_name || user.name || 'Unknown'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            >
              <Smile className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            {(parentId || isEditing) && (
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={!content.trim() || createMutation.isPending}
              className="flex items-center space-x-1 bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <Send className="w-4 h-4" />
              <span>{createMutation.isPending ? 'Sending...' : (isEditing ? 'Update' : 'Send')}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

// Comment Thread Component
const CommentThread = ({ comment, entityType, entityId, users, onReply }) => {
  return (
    <div className="space-y-4">
      <CommentItem
        comment={comment}
        entityType={entityType}
        entityId={entityId}
        users={users}
        onReply={onReply}
      />
      
      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-12 space-y-4">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              entityType={entityType}
              entityId={entityId}
              users={users}
              onReply={onReply}
              isReply
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Individual Comment Component
const CommentItem = ({ comment, entityType, entityId, users, onReply, isReply = false }) => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showActions, setShowActions] = useState(false);

  // Delete comment mutation
  const deleteMutation = useMutation({
    mutationFn: () => comments.delete(comment.id),
    onSuccess: () => {
      queryClient.invalidateQueries(['comments', entityType, entityId]);
      toast.success('Comment deleted');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete comment');
    },
  });

  const handleDelete = () => {
    if (window.confirm('Delete this comment?')) {
      deleteMutation.mutate();
    }
  };

  const renderContent = (content) => {
    // Simple mention highlighting - replace @mentions with styled spans
    return content.replace(/@(\w+)/g, '<span class="text-blue-600 dark:text-blue-400 font-medium">@$1</span>');
  };

  return (
    <div 
      className="flex space-x-3 group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <span className="font-medium text-gray-900 dark:text-white text-sm">
                  {comment.author_name || 'Unknown User'}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(comment.created_at)}
                </span>
                {comment.is_edited && (
                  <span className="text-xs text-gray-400">(edited)</span>
                )}
              </div>
              
              {isEditing ? (
                <CommentForm
                  entityType={entityType}
                  entityId={entityId}
                  users={users}
                  initialContent={comment.content}
                  isEditing={true}
                  commentId={comment.id}
                  onCancel={() => setIsEditing(false)}
                  onSave={() => setIsEditing(false)}
                />
              ) : (
                <div 
                  className="text-sm text-gray-700 dark:text-gray-300"
                  dangerouslySetInnerHTML={{ __html: renderContent(comment.content) }}
                />
              )}
            </div>
            
            {/* Actions */}
            {showActions && !isEditing && (
              <div className="flex items-center space-x-1 ml-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                >
                  <Edit className="w-3 h-3" />
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Reply Button */}
        {!isReply && !isEditing && (
          <div className="mt-2">
            <button
              onClick={() => onReply(comment.id)}
              className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <Reply className="w-3 h-3" />
              <span>Reply</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Loading Skeleton
const CommentsSkeleton = () => {
  return (
    <div className="space-y-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex space-x-3 animate-pulse">
          <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
          <div className="flex-1">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/4 mb-2"></div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

