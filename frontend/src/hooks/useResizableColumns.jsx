import { useState, useRef, useEffect, useCallback } from 'react';
import React from 'react';

export function useResizableColumns(columns, tableId) {
  const [columnWidths, setColumnWidths] = useState(() => {
    // Build default widths - ensuring we use the exact values from columns
    const defaultWidths = {};
    
    if (!columns || columns.length === 0) {
      console.warn('No columns provided to useResizableColumns');
      return {};
    }
    
    // Force reset to proper defaults - ignore any stored values for now
    columns.forEach((col, index) => {
      defaultWidths[index] = col.defaultWidth || 150;
      console.log(`Initializing column ${index} (${col.name}): width=${defaultWidths[index]}`);
    });
    
    console.log('Initial columnWidths:', defaultWidths);
    return defaultWidths;
  });

  const isResizing = useRef(false);
  const currentColumn = useRef(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback((e, columnIndex) => {
    const column = columns[columnIndex];
    console.log(`Starting resize: column ${columnIndex} (${column?.name}), current width: ${columnWidths[columnIndex]}`);
    
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
    
    if (!column) {
      console.warn(`Column at index ${columnIndex} not found`);
      return;
    }
    
    const minWidth = column.minWidth || 50;
    const attemptedWidth = startWidth.current + diff;
    const newWidth = Math.max(minWidth, attemptedWidth);
    
    console.log(`Resizing ${column.name}: from ${startWidth.current} to ${newWidth}`);
    
    setColumnWidths(prev => {
      const updated = {
        ...prev,
        [columnIndex]: newWidth
      };
      console.log('Updated widths:', updated);
      return updated;
    });
  }, [columns]);

  const handleMouseUp = useCallback(() => {
    if (!isResizing.current) return;
    
    isResizing.current = false;
    currentColumn.current = null;
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
    
    // localStorage saving disabled for now
  }, []);

  // Reset column widths when number of columns changes
  useEffect(() => {
    if (columns.length !== Object.keys(columnWidths).length) {
      const defaultWidths = {};
      columns.forEach((col, index) => {
        defaultWidths[index] = col.defaultWidth || 150;
      });
      console.log('Resetting columnWidths due to column count change:', defaultWidths);
      setColumnWidths(defaultWidths);
    }
  }, [columns.length]);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const createResizeHandle = (columnIndex) => {
    console.log(`Creating resize handle for column ${columnIndex}`);
    return (
      <div
        className="absolute top-0 h-full cursor-col-resize group z-50"
        style={{ 
          right: '-4px',
          width: '8px',
          backgroundColor: 'rgba(0,0,0,0.1)' // Make it visible for debugging
        }}
        onMouseDown={(e) => {
          console.log(`Mouse down on column ${columnIndex}`);
          e.stopPropagation();
          e.preventDefault();
          handleMouseDown(e, columnIndex);
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-px h-full mx-auto transition-all duration-150 group-hover:w-0.5" 
             style={{ backgroundColor: '#2563eb' }} />
      </div>
    );
  };

  const resetToDefaults = useCallback(() => {
    const defaultWidths = {};
    columns.forEach((col, index) => {
      defaultWidths[index] = col.defaultWidth || 150;
    });
    console.log('Manually resetting to defaults:', defaultWidths);
    setColumnWidths(defaultWidths);
  }, [columns]);

  return {
    columnWidths,
    createResizeHandle,
    setColumnWidths,
    resetToDefaults
  };
}