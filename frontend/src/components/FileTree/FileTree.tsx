import React, { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import {
  deleteFile,
  duplicateFile,
  setActiveFile,
  closeTab,
  restoreFile,
  permanentlyDeleteFile,
  emptyTrash,
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

const TrashFile: React.FC<{ file: any; onRestore: (id: string) => void; onPermanentDelete: (id: string) => void }> = ({ file, onRestore, onPermanentDelete }) => (
  <div className="tree-file trash-file">
    <span className="file-icon">🗑️</span>
    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {file.name}
    </span>
    <div className="trash-actions">
      <button className="trash-btn restore" title="Restore" onClick={e => { e.stopPropagation(); onRestore(file.id); }}>↩</button>
      <button className="trash-btn delete" title="Delete permanently" onClick={e => { e.stopPropagation(); onPermanentDelete(file.id); }}>×</button>
    </div>
  </div>
);

export const FileTree: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { files, deletedFiles, activeId } = useSelector((state: RootState) => state.workspace);
  const [showTrash, setShowTrash] = useState(false);

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
        {deletedFiles.length > 0 && (
          <div className="tree-folder trash-folder">
            <div className="tree-folder-label" onClick={() => setShowTrash(!showTrash)} style={{ cursor: 'pointer' }}>
              <span>{showTrash ? '📂' : '📁'}</span>
              <span>🗑️ Trash ({deletedFiles.length})</span>
            </div>
            {showTrash && (
              <div className="trash-files">
                {deletedFiles.map(file => (
                  <TrashFile
                    key={file.id}
                    file={file}
                    onRestore={id => dispatch(restoreFile(id))}
                    onPermanentDelete={id => dispatch(permanentlyDeleteFile(id))}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="explorer-bottom">
        <button id="templatesBtn" className="outline-action" onClick={() => dispatch(openTemplateDialog())}>
          📄 Templates
        </button>
        <div className="file-actions">
          <button title="Rename selected file">Rename</button>
          <button title="Duplicate selected file" onClick={() => activeId && dispatch(duplicateFile(activeId))}>Duplicate</button>
          <button title="Delete selected file" onClick={() => activeId && dispatch(deleteFile(activeId))}>Delete</button>
          {deletedFiles.length > 0 && (
            <button title="Empty trash" onClick={() => dispatch(emptyTrash())} style={{ color: 'var(--danger)' }}>Empty Trash</button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default FileTree;