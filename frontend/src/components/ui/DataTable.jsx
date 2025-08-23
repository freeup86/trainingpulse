import React, { useState, useCallback, useMemo } from 'react';
import { 
  ChevronUp, 
  ChevronDown, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Copy,
  Check,
  X,
  Calendar,
  User,
  Tag
} from 'lucide-react';

// Editable Cell Component
const EditableCell = ({ 
  value, 
  onChange, 
  type = 'text', 
  options = [], 
  isEditing, 
  onStartEdit, 
  onSaveEdit, 
  onCancelEdit 
}) => {
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    onChange(editValue);
    onSaveEdit();
  };

  const handleCancel = () => {
    setEditValue(value);
    onCancelEdit();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!isEditing) {
    return (
      <div 
        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded"
        onClick={onStartEdit}
      >
        {type === 'date' && value ? new Date(value).toLocaleDateString() : 
         type === 'select' && options.length > 0 ? 
           options.find(opt => opt.value === value)?.label || value :
         value || '-'}
      </div>
    );
  }

  if (type === 'select') {
    return (
      <div className="flex items-center space-x-1">
        <select
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          autoFocus
        >
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button onClick={handleSave} className="text-green-600 hover:text-green-800">
          <Check className="w-4 h-4" />
        </button>
        <button onClick={handleCancel} className="text-red-600 hover:text-red-800">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (type === 'date') {
    return (
      <div className="flex items-center space-x-1">
        <input
          type="date"
          value={editValue || ''}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          autoFocus
        />
        <button onClick={handleSave} className="text-green-600 hover:text-green-800">
          <Check className="w-4 h-4" />
        </button>
        <button onClick={handleCancel} className="text-red-600 hover:text-red-800">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (type === 'textarea') {
    return (
      <div className="flex items-start space-x-1">
        <textarea
          value={editValue || ''}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
          rows={2}
          autoFocus
        />
        <div className="flex flex-col space-y-1">
          <button onClick={handleSave} className="text-green-600 hover:text-green-800">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={handleCancel} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-1">
      <input
        type={type}
        value={editValue || ''}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        autoFocus
      />
      <button onClick={handleSave} className="text-green-600 hover:text-green-800">
        <Check className="w-4 h-4" />
      </button>
      <button onClick={handleCancel} className="text-red-600 hover:text-red-800">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// Row Actions Component
const RowActions = ({ row, actions, onAction }) => {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      
      {showMenu && (
        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[150px]">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={() => {
                onAction(action.key, row);
                setShowMenu(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 first:rounded-t-lg last:rounded-b-lg"
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Main DataTable Component
export const DataTable = ({
  data = [],
  columns = [],
  isLoading = false,
  sortBy,
  sortOrder,
  onSort,
  onCellEdit,
  onRowAction,
  selectedRows = [],
  onRowSelect,
  onSelectAll,
  showActions = true,
  rowActions = [],
  className = ''
}) => {
  const [editingCell, setEditingCell] = useState(null);

  const defaultRowActions = [
    { key: 'edit', label: 'Edit', icon: <Edit className="w-4 h-4" /> },
    { key: 'duplicate', label: 'Duplicate', icon: <Copy className="w-4 h-4" /> },
    { key: 'delete', label: 'Delete', icon: <Trash2 className="w-4 h-4" /> }
  ];

  const actions = rowActions.length > 0 ? rowActions : defaultRowActions;

  const handleSort = (columnKey) => {
    if (onSort) {
      const newOrder = sortBy === columnKey && sortOrder === 'asc' ? 'desc' : 'asc';
      onSort(columnKey, newOrder);
    }
  };

  const handleCellEdit = (rowId, columnKey, value) => {
    if (onCellEdit) {
      onCellEdit(rowId, columnKey, value);
    }
    setEditingCell(null);
  };

  const isAllSelected = selectedRows.length === data.length && data.length > 0;
  const isPartiallySelected = selectedRows.length > 0 && selectedRows.length < data.length;

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded mb-2"></div>
        ))}
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {onRowSelect && (
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={input => {
                    if (input) input.indeterminate = isPartiallySelected;
                  }}
                  onChange={onSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
            )}
            
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                {column.sortable ? (
                  <button
                    onClick={() => handleSort(column.key)}
                    className="flex items-center space-x-1 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <span>{column.label}</span>
                    {sortBy === column.key ? (
                      sortOrder === 'asc' ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )
                    ) : (
                      <div className="w-4 h-4" />
                    )}
                  </button>
                ) : (
                  column.label
                )}
              </th>
            ))}
            
            {showActions && (
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            )}
          </tr>
        </thead>
        
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {data.map((row, rowIndex) => (
            <tr 
              key={row.id || rowIndex}
              className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {onRowSelect && (
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedRows.includes(row.id)}
                    onChange={() => onRowSelect(row.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
              )}
              
              {columns.map((column) => {
                const cellId = `${row.id}-${column.key}`;
                const isEditing = editingCell === cellId;
                const value = column.render ? column.render(row[column.key], row) : row[column.key];
                
                return (
                  <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {column.editable ? (
                      <EditableCell
                        value={row[column.key]}
                        onChange={(newValue) => handleCellEdit(row.id, column.key, newValue)}
                        type={column.type || 'text'}
                        options={column.options || []}
                        isEditing={isEditing}
                        onStartEdit={() => setEditingCell(cellId)}
                        onSaveEdit={() => setEditingCell(null)}
                        onCancelEdit={() => setEditingCell(null)}
                      />
                    ) : (
                      <div>{value}</div>
                    )}
                  </td>
                );
              })}
              
              {showActions && (
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <RowActions
                    row={row}
                    actions={actions}
                    onAction={onRowAction}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      
      {data.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No data available</p>
        </div>
      )}
    </div>
  );
};

export default DataTable;