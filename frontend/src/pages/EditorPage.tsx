import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import type { RootState, AppDispatch } from '../store';
import { setActiveFile } from '../store/workspaceSlice';
import { LexicalEditor } from '../editor/LexicalEditor';
import { FileTree } from '../components/FileTree/FileTree';
import { InspectorSidebar } from '../components/Inspector';

export function EditorPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { fileId } = useParams<{ fileId?: string }>();
  const { activeId } = useSelector((state: RootState) => state.workspace);

  // If fileId in URL, set as active file
  useEffect(() => {
    if (fileId && fileId !== activeId) {
      dispatch(setActiveFile(fileId));
    }
  }, [fileId, activeId, dispatch]);

  // Allow local editing without auth
  return (
    <>
      <FileTree />
      <main className="editor-area">
        <LexicalEditor />
        <InspectorSidebar />
      </main>
    </>
  );
}