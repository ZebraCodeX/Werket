import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { setActiveFile, closeTab, reorderTabs, addFile } from '../../store/workspaceSlice';

export const Tabs: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { files, openIds, activeId } = useSelector((state: RootState) => state.workspace);

  const handleTabClick = useCallback((id: string) => {
    dispatch(setActiveFile(id));
  }, [dispatch]);

  const handleTabClose = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dispatch(closeTab(id));
  }, [dispatch]);

  const handleAddTab = useCallback(() => {
    dispatch(addFile({ name: 'Untitled.md', text: '' }));
  }, [dispatch]);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    if (sourceId === targetId) return;
    const newOrder = [...openIds];
    const fromIndex = newOrder.indexOf(sourceId);
    const toIndex = newOrder.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, sourceId);
    dispatch(reorderTabs(newOrder));
  }, [openIds, dispatch]);

  return (
    <div className="tabs" role="tablist">
      {openIds.map((id) => {
        const file = files.find(f => f.id === id);
        if (!file) return null;
        const isActive = activeId === id;
        return (
          <div
            key={id}
            className={`tab ${isActive ? 'active' : ''}`}
            role="tab"
            aria-selected={isActive}
            onClick={() => handleTabClick(id)}
            onDragStart={e => handleDragStart(e, id)}
            onDragOver={handleDragOver}
            onDrop={e => handleDrop(e, id)}
            draggable
          >
            <span>{file.name}</span>
            {openIds.length > 1 && (
              <button
                onClick={e => handleTabClose(e, id)}
                aria-label={`Close ${file.name}`}
              >×</button>
            )}
          </div>
        );
      })}
      <button className="tab-add" onClick={handleAddTab} title="New document">＋</button>
    </div>
  );
};

export default Tabs;