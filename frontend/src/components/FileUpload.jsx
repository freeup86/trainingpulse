import React, { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Upload,
  File,
  Image,
  Video,
  Music,
  FileText,
  Download,
  Trash2,
  Eye,
  X,
  Plus,
  Cloud,
  AlertCircle,
  Check,
  Clock,
  Link,
  Copy,
  Share,
  Paperclip,
  FolderOpen
} from 'lucide-react';
import toast from 'react-hot-toast';
import { attachments } from '../lib/api';

// File type icons mapping
const FILE_ICONS = {
  image: <Image className="w-5 h-5" />,
  video: <Video className="w-5 h-5" />,
  audio: <Music className="w-5 h-5" />,
  document: <FileText className="w-5 h-5" />,
  default: <File className="w-5 h-5" />
};

// Get file type category
const getFileType = (filename) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) return 'image';
  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) return 'audio';
  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'document';
  
  return 'default';
};

// Format file size
const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Main File Upload Component
export const FileUpload = ({ 
  entityType,
  entityId,
  multiple = true,
  maxFiles = 10,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  acceptedTypes = [],
  onFilesChange,
  className = '',
  compact = false
}) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});

  // Fetch attachments
  const { data: attachmentsData, isLoading } = useQuery({
    queryKey: ['attachments', entityType, entityId],
    queryFn: () => attachments.getByEntity(entityType, entityId),
    enabled: !!(entityType && entityId),
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: ({ file, entityType, entityId }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entity_type', entityType);
      formData.append('entity_id', entityId);
      
      return attachments.upload(formData, {
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['attachments', entityType, entityId]);
      toast.success('File uploaded successfully');
      setUploading(false);
      setUploadProgress({});
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Upload failed');
      setUploading(false);
      setUploadProgress({});
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: attachments.delete,
    onSuccess: () => {
      queryClient.invalidateQueries(['attachments', entityType, entityId]);
      toast.success('File deleted');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete file');
    },
  });

  const filesList = attachmentsData?.data || [];

  // Validation
  const validateFile = (file) => {
    if (maxFileSize && file.size > maxFileSize) {
      toast.error(`File "${file.name}" is too large. Maximum size is ${formatFileSize(maxFileSize)}`);
      return false;
    }

    if (acceptedTypes.length > 0) {
      const fileType = file.type;
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      
      const isValidType = acceptedTypes.some(type => {
        if (type.startsWith('.')) return type.slice(1) === fileExt;
        if (type.includes('/')) return fileType.match(type.replace('*', '.*'));
        return false;
      });

      if (!isValidType) {
        toast.error(`File type not allowed for "${file.name}"`);
        return false;
      }
    }

    return true;
  };

  // Handle file selection
  const handleFileSelect = useCallback((files) => {
    const fileArray = Array.from(files);
    
    if (!multiple && fileArray.length > 1) {
      toast.error('Only one file allowed');
      return;
    }

    if (fileArray.length + filesList.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const validFiles = fileArray.filter(validateFile);
    
    if (validFiles.length === 0) return;

    setUploading(true);
    
    validFiles.forEach(file => {
      if (entityType && entityId) {
        uploadMutation.mutate({ file, entityType, entityId });
      }
    });

    if (onFilesChange) {
      onFilesChange(validFiles);
    }
  }, [filesList.length, maxFiles, multiple, entityType, entityId, onFilesChange]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files);
    }
  }, [handleFileSelect]);

  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFileSelect(files);
    }
    // Reset input
    e.target.value = '';
  };

  const handleDelete = (fileId) => {
    if (window.confirm('Delete this file?')) {
      deleteMutation.mutate(fileId);
    }
  };

  if (compact) {
    return (
      <CompactFileUpload
        filesList={filesList}
        uploading={uploading}
        uploadProgress={uploadProgress}
        onFileSelect={handleFileSelect}
        onDelete={handleDelete}
        className={className}
      />
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Paperclip className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Attachments ({filesList.length})
          </h3>
        </div>
      </div>

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragOver 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={acceptedTypes.join(',')}
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="space-y-2">
          <div className="flex justify-center">
            <Cloud className="w-12 h-12 text-gray-400" />
          </div>
          
          <div>
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              Drop files here or{' '}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                browse
              </button>
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {acceptedTypes.length > 0 
                ? `Accepted: ${acceptedTypes.join(', ')}`
                : 'All file types accepted'
              }
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Maximum {formatFileSize(maxFileSize)} per file
            </p>
          </div>
        </div>

        {uploading && (
          <div className="mt-4">
            <div className="flex items-center justify-center space-x-2 text-blue-600 dark:text-blue-400">
              <Upload className="w-4 h-4 animate-pulse" />
              <span className="text-sm">Uploading...</span>
            </div>
          </div>
        )}
      </div>

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="space-y-2">
          {Object.entries(uploadProgress).map(([filename, progress]) => (
            <div key={filename} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {filename}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {progress}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Files List */}
      <FilesList
        files={filesList}
        isLoading={isLoading}
        onDelete={handleDelete}
      />
    </div>
  );
};

// Files List Component
const FilesList = ({ files, isLoading, onDelete }) => {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-8">
        <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">No files uploaded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <FileItem key={file.id} file={file} onDelete={onDelete} />
      ))}
    </div>
  );
};

// Individual File Item
const FileItem = ({ file, onDelete }) => {
  const [showPreview, setShowPreview] = useState(false);
  const fileType = getFileType(file.filename);
  const FileIcon = FILE_ICONS[fileType] || FILE_ICONS.default;

  const handleDownload = () => {
    if (file.download_url) {
      window.open(file.download_url, '_blank');
    }
  };

  const handleCopyLink = () => {
    if (file.public_url) {
      navigator.clipboard.writeText(file.public_url);
      toast.success('Link copied to clipboard');
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className="flex-shrink-0 text-gray-500 dark:text-gray-400">
              {React.cloneElement(FileIcon, { className: "w-8 h-8" })}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {file.filename}
              </p>
              <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                <span>{formatFileSize(file.file_size)}</span>
                <span>{new Date(file.created_at).toLocaleDateString()}</span>
                {file.uploaded_by && (
                  <span>by {file.uploaded_by}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {fileType === 'image' && (
              <button
                onClick={() => setShowPreview(true)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                title="Preview"
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
            
            <button
              onClick={handleDownload}
              className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
            
            {file.public_url && (
              <button
                onClick={handleCopyLink}
                className="p-2 text-gray-400 hover:text-green-600 dark:hover:text-green-400 rounded"
                title="Copy link"
              >
                <Link className="w-4 h-4" />
              </button>
            )}
            
            <button
              onClick={() => onDelete(file.id)}
              className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {showPreview && fileType === 'image' && (
        <ImagePreviewModal
          file={file}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
};

// Compact File Upload (for inline use)
const CompactFileUpload = ({ 
  filesList, 
  uploading, 
  uploadProgress, 
  onFileSelect, 
  onDelete,
  className 
}) => {
  const fileInputRef = useRef(null);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Attachments ({filesList.length})
        </span>
        
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center space-x-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >
          <Plus className="w-4 h-4" />
          <span>Add</span>
        </button>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => onFileSelect(e.target.files)}
          className="hidden"
        />
      </div>

      {uploading && (
        <div className="text-xs text-blue-600 dark:text-blue-400">
          Uploading...
        </div>
      )}

      {filesList.length > 0 && (
        <div className="space-y-1">
          {filesList.map((file) => (
            <div key={file.id} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-800 rounded p-2">
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <div className="text-gray-500 dark:text-gray-400">
                  {FILE_ICONS[getFileType(file.filename)] || FILE_ICONS.default}
                </div>
                <span className="truncate text-gray-900 dark:text-white">
                  {file.filename}
                </span>
              </div>
              
              <button
                onClick={() => onDelete(file.id)}
                className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 ml-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Image Preview Modal
const ImagePreviewModal = ({ file, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {file.filename}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4">
          <img
            src={file.public_url}
            alt={file.filename}
            className="max-w-full max-h-[70vh] object-contain mx-auto"
          />
        </div>
        
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Size: {formatFileSize(file.file_size)}</span>
            <span>Uploaded: {new Date(file.created_at).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// File Upload Button (for quick access)
export const FileUploadButton = ({ 
  onFileSelect, 
  multiple = true, 
  acceptedTypes = [],
  className = '',
  children 
}) => {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      onFileSelect(Array.from(files));
    }
    e.target.value = '';
  };

  return (
    <>
      <button
        onClick={() => fileInputRef.current?.click()}
        className={className}
      >
        {children || (
          <>
            <Upload className="w-4 h-4" />
            <span>Upload Files</span>
          </>
        )}
      </button>
      
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={acceptedTypes.join(',')}
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  );
};

export default FileUpload;