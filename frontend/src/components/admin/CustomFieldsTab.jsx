import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Settings,
  Plus,
  X,
  Edit,
  Trash2,
  Type,
  Hash,
  ToggleLeft,
  List,
  Users,
  Tag,
  Link,
  FileText,
  Calendar,
  BookOpen,
  FolderOpen,
  User,
  Package
} from 'lucide-react';
import toast from 'react-hot-toast';
import { customFields } from '../../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';

// Entity types available for custom fields
const ENTITY_TYPES = [
  { 
    type: 'course', 
    label: 'Courses', 
    icon: BookOpen,
    description: 'Custom fields for training courses'
  },
  { 
    type: 'program', 
    label: 'Programs', 
    icon: FolderOpen,
    description: 'Custom fields for programs and clients'
  },
  { 
    type: 'user', 
    label: 'Users', 
    icon: User,
    description: 'Custom fields for user profiles'
  },
  { 
    type: 'task', 
    label: 'Tasks', 
    icon: Package,
    description: 'Custom fields for course tasks'
  }
];

// Field Type Definitions
const FIELD_TYPES = [
  { 
    type: 'text', 
    label: 'Text', 
    icon: Type,
    description: 'Single line text input'
  },
  { 
    type: 'textarea', 
    label: 'Long Text', 
    icon: FileText,
    description: 'Multi-line text area'
  },
  { 
    type: 'number', 
    label: 'Number', 
    icon: Hash,
    description: 'Numeric input with validation'
  },
  { 
    type: 'date', 
    label: 'Date', 
    icon: Calendar,
    description: 'Date picker'
  },
  { 
    type: 'select', 
    label: 'Dropdown', 
    icon: List,
    description: 'Single selection from options'
  },
  { 
    type: 'multiselect', 
    label: 'Multi-select', 
    icon: Tag,
    description: 'Multiple selections from options'
  },
  { 
    type: 'boolean', 
    label: 'Checkbox', 
    icon: ToggleLeft,
    description: 'True/false toggle'
  },
  { 
    type: 'url', 
    label: 'URL', 
    icon: Link,
    description: 'Web link with validation'
  },
  { 
    type: 'user', 
    label: 'User', 
    icon: Users,
    description: 'User selection'
  }
];

export default function CustomFieldsTab() {
  const queryClient = useQueryClient();
  const [selectedEntityType, setSelectedEntityType] = useState('course');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Fetch custom fields for selected entity type
  const { data: fieldsData, isLoading } = useQuery({
    queryKey: ['custom-fields', selectedEntityType],
    queryFn: () => customFields.getByEntity(selectedEntityType),
  });

  // Create field mutation
  const createFieldMutation = useMutation({
    mutationFn: customFields.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['custom-fields']);
      toast.success('Custom field created successfully');
      setShowCreateForm(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create custom field');
    },
  });

  // Update field mutation
  const updateFieldMutation = useMutation({
    mutationFn: ({ id, data }) => customFields.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['custom-fields']);
      toast.success('Custom field updated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update custom field');
    },
  });

  // Delete field mutation
  const deleteFieldMutation = useMutation({
    mutationFn: customFields.delete,
    onSuccess: () => {
      queryClient.invalidateQueries(['custom-fields']);
      toast.success('Custom field deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete custom field');
    },
  });

  const fields = fieldsData?.data || [];
  const selectedEntity = ENTITY_TYPES.find(entity => entity.type === selectedEntityType);

  const handleToggleActive = (fieldId, isActive) => {
    updateFieldMutation.mutate({
      id: fieldId,
      data: { is_active: isActive }
    });
  };

  const handleDeleteField = (fieldId) => {
    if (window.confirm('Delete this custom field? This action cannot be undone and will remove all associated data.')) {
      deleteFieldMutation.mutate(fieldId);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Custom Fields Management
            </CardTitle>
            <CardDescription>
              Create and manage custom fields for different entity types
            </CardDescription>
          </div>
          <Button 
            onClick={() => setShowCreateForm(true)}
            disabled={!selectedEntityType}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Field
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Entity Type Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Select Entity Type
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {ENTITY_TYPES.map((entity) => {
              const Icon = entity.icon;
              return (
                <button
                  key={entity.type}
                  onClick={() => setSelectedEntityType(entity.type)}
                  className={`p-4 border rounded-lg text-left transition-colors ${
                    selectedEntityType === entity.type
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {entity.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {entity.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
            <CustomFieldForm
              entityType={selectedEntityType}
              onSubmit={(data) => createFieldMutation.mutate(data)}
              onCancel={() => setShowCreateForm(false)}
              isLoading={createFieldMutation.isPending}
            />
          </div>
        )}

        {/* Fields List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {selectedEntity?.label} Custom Fields
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {fields.length} field{fields.length !== 1 ? 's' : ''}
            </span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : fields.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
              <Settings className="h-8 w-8 text-gray-400 mx-auto mb-3" />
              <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No custom fields
              </h4>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Create custom fields to capture additional information for {selectedEntity?.label?.toLowerCase()}.
              </p>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Field
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {fields.map((field) => (
                <CustomFieldCard
                  key={field.id}
                  field={field}
                  onToggleActive={handleToggleActive}
                  onDelete={handleDeleteField}
                  onUpdate={(data) => updateFieldMutation.mutate({ id: field.id, data })}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Custom Field Form Component
function CustomFieldForm({ entityType, field = null, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    entity_type: entityType,
    label: '',
    field_type: 'text',
    description: '',
    placeholder: '',
    is_required: false,
    is_active: true,
    options: [],
    validation_rules: {}
  });

  const [newOption, setNewOption] = useState({ label: '', value: '' });

  React.useEffect(() => {
    if (field) {
      setFormData(field);
    }
  }, [field]);

  const isSelectType = ['select', 'multiselect'].includes(formData.field_type);

  const handleAddOption = () => {
    if (newOption.label && newOption.value) {
      setFormData(prev => ({
        ...prev,
        options: [...prev.options, { ...newOption }]
      }));
      setNewOption({ label: '', value: '' });
    }
  };

  const handleRemoveOption = (index) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          {field ? 'Edit' : 'Create'} Custom Field
        </h4>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Field Label *
          </label>
          <input
            type="text"
            required
            value={formData.label}
            onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter field label"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Field Type *
          </label>
          <select
            value={formData.field_type}
            onChange={(e) => setFormData(prev => ({ ...prev, field_type: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {FIELD_TYPES.map((type) => (
              <option key={type.type} value={type.type}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description
        </label>
        <input
          type="text"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Optional description"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Placeholder
        </label>
        <input
          type="text"
          value={formData.placeholder}
          onChange={(e) => setFormData(prev => ({ ...prev, placeholder: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Placeholder text"
        />
      </div>

      {/* Options for select fields */}
      {isSelectType && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Options
          </label>
          <div className="space-y-2">
            {formData.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={option.label}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveOption(index)}
                  className="p-2 text-red-600 hover:text-red-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Option label"
                value={newOption.label}
                onChange={(e) => setNewOption(prev => ({ 
                  ...prev, 
                  label: e.target.value,
                  value: e.target.value.toLowerCase().replace(/\s+/g, '_')
                }))}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={handleAddOption}
                className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center space-x-6">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={formData.is_required}
            onChange={(e) => setFormData(prev => ({ ...prev, is_required: e.target.checked }))}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Required field</span>
        </label>

        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={formData.is_active}
            onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
        </label>
      </div>

      <div className="flex items-center justify-end space-x-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : field ? 'Update Field' : 'Create Field'}
        </Button>
      </div>
    </form>
  );
}

// Custom Field Card Component
function CustomFieldCard({ field, onToggleActive, onDelete, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);

  const fieldType = FIELD_TYPES.find(type => type.type === field.field_type);
  const Icon = fieldType?.icon || Type;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <Icon className="h-5 w-5 text-gray-500" />
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">
                {field.label}
                {field.is_required && <span className="text-red-500 ml-1">*</span>}
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {fieldType?.label} field
              </p>
            </div>
          </div>
          
          {field.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {field.description}
            </p>
          )}
          
          {field.options && field.options.length > 0 && (
            <div className="mb-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Options:</p>
              <div className="flex flex-wrap gap-1">
                {field.options.map((option, index) => (
                  <span 
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    {option.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={field.is_active}
              onChange={(e) => onToggleActive(field.id, e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Active</span>
          </label>
          
          <button
            onClick={() => setIsEditing(true)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <Edit className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => onDelete(field.id)}
            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <CustomFieldForm
            field={field}
            onSubmit={(data) => {
              onUpdate(data);
              setIsEditing(false);
            }}
            onCancel={() => setIsEditing(false)}
          />
        </div>
      )}
    </div>
  );
}