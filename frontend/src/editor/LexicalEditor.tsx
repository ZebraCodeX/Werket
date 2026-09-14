import React from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { initialConfig } from './editorConfig';
import { Toolbar } from './Toolbar';
import { AutoSavePlugin } from './plugins/AutoSavePlugin';
import { LoadContentPlugin } from './plugins/LoadContentPlugin';
import { PlaceholderPlugin } from './plugins/PlaceholderPlugin';
import { PhoneticCompositionPlugin } from './plugins/PhoneticCompositionPlugin';
import { FindOverlay } from './FindOverlay';
import { FidelKeyboard } from '../components/Keyboard/FidelKeyboard';

export function LexicalEditor() {
  const { font, size, align, activeId, files } = useSelector((state: RootState) => state.workspace);
  const { phoneticMode, deviceKeyboardMode } = useSelector((state: RootState) => state.keyboard);
  const zoom = useSelector((state: RootState) => state.ui.zoom);
  const activeFile = files.find(file => file.id === activeId);
  const isAmharicDoc = activeFile?.lang === 'am';

  return (
    <div className="lexical-editor-wrapper">
      <LexicalComposer initialConfig={initialConfig}>
        <Toolbar
          font={font}
          size={size}
          align={align}
          isAmharicDoc={isAmharicDoc}
          deviceKeyboardMode={deviceKeyboardMode}
        />
        <div className="document-paper" style={{ zoom }}>
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                id="editor"
                className="editor-content"
                style={{ fontFamily: font, fontSize: `${size}px` }}
              />
            }
            placeholder={<div className="editor-placeholder" />}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <TablePlugin />
          <AutoFocusPlugin />
          <LoadContentPlugin file={activeFile} />
          <AutoSavePlugin activeFileId={activeId} />
          <PlaceholderPlugin placeholder="Start writing..." isAmharicDoc={isAmharicDoc} />
          <PhoneticCompositionPlugin
            isAmharicDoc={isAmharicDoc}
            phoneticMode={phoneticMode}
            deviceKeyboardMode={deviceKeyboardMode}
          />
          <FindOverlay />
        </div>
        <FidelKeyboard />
      </LexicalComposer>
    </div>
  );
}