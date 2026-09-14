import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import {
  deleteFile,
  duplicateFile,
  setActiveFile,
  closeTab,
} from '../../store/workspaceSlice';
import { openNewDocDialog, openTemplateDialog } from '../../store/uiSlice';

interface TreeFileProps {
  file: any;
  isActive: boolean;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

const TreeFile: React.FC<TreeFileProps> = ({ file, isActive, onSelect, onClose, onContextMenu }) => (
  <div
    className={`tree-file ${isActive ? 'active' : ''}`}
    onClick={() => onSelect(file.id)}
    onContextMenu={e => onContextMenu(e, file.id)}
  >
    <span className="file-icon">{file.name.endsWith('.md') ? '📄' : '📝'}</span>
    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {file.name}
    </span>
    {isActive && <button className="close-tab" onClick={e => { e.stopPropagation(); onClose(file.id); }}>×</button>}
  </div>
);

export const FileTree: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { files, activeId } = useSelector((state: RootState) => state.workspace);

  const handleNewFile = useCallback(() => {
    dispatch(openNewDocDialog());
  }, [dispatch]);

  // Build folder structure
  const folderMap = new Map<string, any[]>();
  files.forEach(file => {
    const folder = file.folder || '';
    if (!folderMap.has(folder)) folderMap.set(folder, []);
    folderMap.get(folder)!.push(file);
  });

  const rootFiles = folderMap.get('') || [];
  const folders = Array.from(folderMap.entries()).filter(([f]) => f).sort(([a], [b]) => a.localeCompare(b));

  return (
    <aside className="explorer" id="explorerPanel">
      <div className="panel-heading">
        <span>DOCUMENTS</span>
        <button id="newFileBtn" title="New file" onClick={handleNewFile}>＋</button>
      </div>
      <div id="fileTree" className="file-tree">
        {rootFiles.map(file => (
          <TreeFile
            key={file.id}
            file={file}
            isActive={activeId === file.id}
            onSelect={id => dispatch(setActiveFile(id))}
            onClose={id => dispatch(closeTab(id))}
            onContextMenu={e => { e.preventDefault(); }}
          />
        ))}
        {folders.map(([folderName, folderFiles]) => (
          <div key={folderName} className="tree-folder">
            <div className="tree-folder-label">
              <span>📁</span>
              <span>{folderName}</span>
            </div>
            {folderFiles.map(file => (
              <TreeFile
                key={file.id}
                file={file}
                isActive={activeId === file.id}
                onSelect={id => dispatch(setActiveFile(id))}
                onClose={id => dispatch(closeTab(id))}
                onContextMenu={e => { e.preventDefault(); }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="explorer-bottom">
        <button id="templatesBtn" className="outline-action" onClick={() => dispatch(openTemplateDialog())}>
          📄 Templates
        </button>
        <div className="file-actions">
          <button title="Rename selected file">Rename</button>
          <button title="Duplicate selected file" onClick={() => activeId && dispatch(duplicateFile(activeId))}>Duplicate</button>
          <button title="Delete selected file" onClick={() => activeId && dispatch(deleteFile(activeId))}>Delete</button>
        </div>
      </div>
    </aside>
  );
};

export default FileTree;