import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Settings,
  Plus,
  X,
  Edit,
  Trash2,
  Save,
  Calendar,
  Type,
  Hash,
  ToggleLeft,
  List,
  Users,
  Tag,
  Link,
  FileText,
  ChevronDown,
  Check,
  AlertCircle,
  Copy
} from 'lucide-react';
import toast from 'react-hot-toast';
import { customFields } from '../lib/api';

// Field Type Definitions
const FIELD_TYPES = [
  { 
    type: 'text', 
    label: 'Text', 
    icon: <Type className="w-4 h-4" />,
    description: 'Single line text input'
  },
  { 
    type: 'textarea', 
    label: 'Long Text', 
    icon: <FileText className="w-4 h-4" />,
    description: 'Multi-line text area'
  },
  { 
    type: 'number', 
    label: 'Number', 
    icon: <Hash className="w-4 h-4" />,
    description: 'Numeric input with validation'
  },
  { 
    type: 'date', 
    label: 'Date', 
    icon: <Calendar className="w-4 h-4" />,
    description: 'Date picker'
  },
  { 
    type: 'select', 
    label: 'Dropdown', 
    icon: <List className="w-4 h-4" />,
    description: 'Single selection from options'
  },
  { 
    type: 'multiselect', 
    label: 'Multi-select', 
    icon: <Tag className="w-4 h-4" />,
    description: 'Multiple selections from options'
  },
  { 
    type: 'boolean', 
    label: 'Checkbox', 
    icon: <ToggleLeft className="w-4 h-4" />,
    description: 'True/false toggle'
  },
  { 
    type: 'url', 
    label: 'URL', 
    icon: <Link className="w-4 h-4" />,
    description: 'Web link with validation'
  },
  { 
    type: 'user', 
    label: 'User', 
    icon: <Users className="w-4 h-4" />,
    description: 'User selection'
  }
];

// Main Custom Fields Component
export const CustomFields = ({ 
  entityType,
  entityId, 
  values = {}, 
  onValuesChange,
  isReadOnly = false,
  showAddButton = true,
  className = '' 
}) => {
  const queryClient = useQueryClient();
  const [showFieldManager, setShowFieldManager] = useState(false);

  // Fetch custom field definitions
  const { data: fieldsData } = useQuery({
    queryKey: ['custom-fields', entityType],
    queryFn: () => customFields.getByEntity(entityType),
    enabled: !!entityType,
  });

  // Update field value mutation
  const updateValueMutation = useMutation({
    mutationFn: ({ fieldId, value }) => 
      customFields.updateValue(entityType, entityId, fieldId, value),
    onSuccess: () => {
      queryClient.invalidateQueries(['custom-fields', entityType, entityId]);
      toast.success('Field updated');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update field');
    },
  });

  const fields = fieldsData?.data || [];
  const activeFields = fields.filter(field => field.is_active);

  const handleValueChange = (fieldId, value) => {
    const updatedValues = { ...values, [fieldId]: value };
    
    if (onValuesChange) {
      onValuesChange(updatedValues);
    }

    if (entityId) {
      updateValueMutation.mutate({ fieldId, value });
    }
  };

  if (activeFields.length === 0 && !showAddButton) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Custom Fields
          </h3>
        </div>
        
        {showAddButton && !isReadOnly && (
          <button
            onClick={() => setShowFieldManager(true)}
            className="flex items-center space-x-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            <Settings className="w-4 h-4" />
            <span>Manage Fields</span>
          </button>
        )}
      </div>

      {/* Fields */}
      {activeFields.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <Settings className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No custom fields configured
          </p>
          {showAddButton && !isReadOnly && (
            <button
              onClick={() => setShowFieldManager(true)}
              className="mt-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
            >
              Add custom fields
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeFields.map((field) => (
            <CustomFieldInput
              key={field.id}
              field={field}
              value={values[field.id]}
              onChange={(value) => handleValueChange(field.id, value)}
              isReadOnly={isReadOnly}
            />
          ))}
        </div>
      )}

      {/* Field Manager Modal */}
      {showFieldManager && (
        <CustomFieldManager
          entityType={entityType}
          onClose={() => setShowFieldManager(false)}
        />
      )}
    </div>
  );
};

// Individual Custom Field Input
const CustomFieldInput = ({ field, value, onChange, isReadOnly }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const fieldType = FIELD_TYPES.find(type => type.type === field.field_type);
  const Icon = fieldType?.icon || <Type className="w-4 h-4" />;

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = () => {
    onChange(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const renderField = () => {
    const commonProps = {
      disabled: isReadOnly && !isEditing,
      className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
    };

    switch (field.field_type) {
      case 'textarea':
        return (
          <textarea
            value={isEditing ? editValue || '' : value || ''}
            onChange={(e) => isEditing ? setEditValue(e.target.value) : onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            {...commonProps}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={isEditing ? editValue || '' : value || ''}
            onChange={(e) => {
              const numValue = e.target.value ? parseFloat(e.target.value) : null;
              isEditing ? setEditValue(numValue) : onChange(numValue);
            }}
            placeholder={field.placeholder}
            {...commonProps}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={isEditing ? editValue || '' : value || ''}
            onChange={(e) => isEditing ? setEditValue(e.target.value) : onChange(e.target.value)}
            {...commonProps}
          />
        );

      case 'select':
        return (
          <select
            value={isEditing ? editValue || '' : value || ''}
            onChange={(e) => isEditing ? setEditValue(e.target.value) : onChange(e.target.value)}
            {...commonProps}
          >
            <option value="">Select an option</option>
            {field.options?.map((option, index) => (
              <option key={index} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'multiselect':
        const selectedValues = (isEditing ? editValue : value) || [];
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => (
              <label key={index} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option.value)}
                  onChange={(e) => {
                    let newValues;
                    if (e.target.checked) {
                      newValues = [...selectedValues, option.value];
                    } else {
                      newValues = selectedValues.filter(v => v !== option.value);
                    }
                    isEditing ? setEditValue(newValues) : onChange(newValues);
                  }}
                  disabled={isReadOnly && !isEditing}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        );

      case 'boolean':
        return (
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={isEditing ? !!editValue : !!value}
              onChange={(e) => isEditing ? setEditValue(e.target.checked) : onChange(e.target.checked)}
              disabled={isReadOnly && !isEditing}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {field.placeholder || 'Enable option'}
            </span>
          </label>
        );

      case 'url':
        return (
          <input
            type="url"
            value={isEditing ? editValue || '' : value || ''}
            onChange={(e) => isEditing ? setEditValue(e.target.value) : onChange(e.target.value)}
            placeholder={field.placeholder || 'https://example.com'}
            {...commonProps}
          />
        );

      default:
        return (
          <input
            type="text"
            value={isEditing ? editValue || '' : value || ''}
            onChange={(e) => isEditing ? setEditValue(e.target.value) : onChange(e.target.value)}
            placeholder={field.placeholder}
            {...commonProps}
          />
        );
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          {React.cloneElement(Icon, { className: "w-4 h-4 text-gray-500" })}
          <span>{field.label}</span>
          {field.is_required && (
            <span className="text-red-500">*</span>
          )}
        </label>
        
        {!isReadOnly && (
          <div className="flex items-center space-x-1">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  className="p-1 text-green-600 hover:text-green-800"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCancel}
                  className="p-1 text-red-600 hover:text-red-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
      
      {renderField()}
      
      {field.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {field.description}
        </p>
      )}
    </div>
  );
};

// Custom Field Manager Modal
const CustomFieldManager = ({ entityType, onClose }) => {
  const queryClient = useQueryClient();
  const [fields, setFields] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Fetch existing fields
  const { data: fieldsData } = useQuery({
    queryKey: ['custom-fields', entityType],
    queryFn: () => customFields.getByEntity(entityType),
    onSuccess: (data) => setFields(data.data || []),
  });

  // Create field mutation
  const createFieldMutation = useMutation({
    mutationFn: customFields.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['custom-fields']);
      toast.success('Field created successfully');
      setShowCreateForm(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create field');
    },
  });

  // Update field mutation
  const updateFieldMutation = useMutation({
    mutationFn: ({ id, data }) => customFields.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['custom-fields']);
      toast.success('Field updated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update field');
    },
  });

  // Delete field mutation
  const deleteFieldMutation = useMutation({
    mutationFn: customFields.delete,
    onSuccess: () => {
      queryClient.invalidateQueries(['custom-fields']);
      toast.success('Field deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete field');
    },
  });

  const handleToggleActive = (fieldId, isActive) => {
    updateFieldMutation.mutate({
      id: fieldId,
      data: { is_active: isActive }
    });
  };

  const handleDeleteField = (fieldId) => {
    if (window.confirm('Delete this custom field? This action cannot be undone.')) {
      deleteFieldMutation.mutate(fieldId);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Manage Custom Fields - {entityType}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Create New Field */}
          <div className="mb-6">
            {showCreateForm ? (
              <CustomFieldForm
                entityType={entityType}
                onSubmit={(data) => createFieldMutation.mutate(data)}
                onCancel={() => setShowCreateForm(false)}
                isLoading={createFieldMutation.isPending}
              />
            ) : (
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                <span>Add Custom Field</span>
              </button>
            )}
          </div>

          {/* Existing Fields */}
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
        </div>

        <div className="flex items-center justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

// Custom Field Form
const CustomFieldForm = ({ entityType, field = null, onSubmit, onCancel, isLoading }) => {
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

  useEffect(() => {
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
    <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-4">
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
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
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
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button
                type="button"
                onClick={handleAddOption}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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

      <div className="flex items-center justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : field ? 'Update Field' : 'Create Field'}
        </button>
      </div>
    </form>
  );
};

// Custom Field Card
const CustomFieldCard = ({ field, onToggleActive, onDelete, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);

  const fieldType = FIELD_TYPES.find(type => type.type === field.field_type);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            {fieldType && React.cloneElement(fieldType.icon, { 
              className: "w-5 h-5 text-gray-500" 
            })}
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
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {field.description}
            </p>
          )}
          
          {field.options && field.options.length > 0 && (
            <div className="mt-2">
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
};

