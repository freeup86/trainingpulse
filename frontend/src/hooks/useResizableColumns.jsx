import { useState, useRef, useEffect, useCallback } from 'react';

export function useResizableColumns(columns, tableId) {
  const [columnWidths, setColumnWidths] = useState(() => {
    // Try to load saved widths from localStorage
    const savedWidths = localStorage.getItem(`table-widths-${tableId}`);
    if (savedWidths) {
      try {
        return JSON.parse(savedWidths);
      } catch (e) {
        console.error('Failed to parse saved column widths:', e);
      }
    }
    
    // Use default widths
    const defaultWidths = {};
    columns.forEach((col, index) => {
      defaultWidths[index] = col.defaultWidth || 150;
    });
    return defaultWidths;
  });

  const isResizing = useRef(false);
  const currentColumn = useRef(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // Save widths to localStorage when they change
  useEffect(() => {
    if (tableId) {
      localStorage.setItem(`table-widths-${tableId}`, JSON.stringify(columnWidths));
    }
  }, [columnWidths, tableId]);

  const handleMouseDown = useCallback((e, columnIndex) => {
    isResizing.current = true;
    currentColumn.current = columnIndex;
    startX.current = e.clientX;
    startWidth.current = columnWidths[columnIndex] || columns[columnIndex]?.defaultWidth || 150;
    
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }, [columnWidths, columns]);

  const handleMouseMove = useCallback((e) => {
    if (!isResizing.current) return;
    
    const diff = e.clientX - startX.current;
    const columnIndex = currentColumn.current;
    const column = columns[columnIndex];
    
    if (!column) return;
    
    const minWidth = column.minWidth || 50;
    const newWidth = Math.max(minWidth, startWidth.current + diff);
    
    setColumnWidths(prev => ({
      ...prev,
      [columnIndex]: newWidth
    }));
  }, [columns]);

  const handleMouseUp = useCallback(() => {
    if (!isResizing.current) return;
    
    isResizing.current = false;
    currentColumn.current = null;
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const createResizeHandle = (columnIndex) => {
    return (
      <div
        className="absolute top-0 h-full cursor-col-resize group"
        style={{ 
          right: '-1px',
          width: '3px',
          padding: '0 1px'
        }}
        onMouseDown={(e) => handleMouseDown(e, columnIndex)}
      >
        <div className="w-px h-full bg-gray-200 dark:bg-gray-700 opacity-50 group-hover:opacity-100 group-hover:bg-gray-300 dark:group-hover:bg-gray-600 transition-all mx-auto" />
      </div>
    );
  };

  const resetToDefaults = useCallback(() => {
    const defaultWidths = {};
    columns.forEach((col, index) => {
      defaultWidths[index] = col.defaultWidth || 150;
    });
    setColumnWidths(defaultWidths);
    if (tableId) {
      localStorage.removeItem(`table-widths-${tableId}`);
    }
  }, [columns, tableId]);

  return {
    columnWidths,
    createResizeHandle,
    setColumnWidths,
    resetToDefaults
  };
}