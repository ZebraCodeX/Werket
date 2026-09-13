import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { closeExportDialog } from '../../store/uiSlice';
import { EXPORT_FORMATS } from '../../utils/constants';
import { 
  htmlToMarkdown, 
  htmlToPlainText, 
  buildDocx, 
  buildOdt, 
  buildRtf, 
  buildEpub, 
  buildPdf,
  htmlToHtml,
  downloadBlob 
} from '../../utils/exports';

export const ExportDialog: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { exportDialogOpen, exportFormat } = useSelector((state: RootState) => state.ui);
  const { activeId, files, projectName } = useSelector((state: RootState) => state.workspace);
  const activeFile = files.find(f => f.id === activeId);

  const handleExport = useCallback(async (format: string) => {
    if (!activeFile) return;
    const editor = document.getElementById('editor') as HTMLElement | null;
    if (!editor) return;

    const html = editor.innerHTML;
    const baseName = activeFile.name.replace(/\.[^.]+$/, '') || 'document';
    const title = activeFile.name;

    try {
      switch (format) {
        case 'md': {
          const md = htmlToMarkdown(html);
          downloadBlob(md, baseName + '.md', 'text/markdown;charset=utf-8');
          break;
        }
        case 'html': {
          const htmlDoc = htmlToHtml(html, { title });
          downloadBlob(htmlDoc, baseName + '.html', 'text/html;charset=utf-8');
          break;
        }
        case 'txt': {
          const txt = htmlToPlainText(html);
          downloadBlob(txt, baseName + '.txt', 'text/plain;charset=utf-8');
          break;
        }
        case 'doc': {
          const doc = htmlToHtml(html, { title }).replace(
            /^<html><head>/,
            '<html><head><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->'
          );
          downloadBlob(doc, baseName + '.doc', 'application/msword');
          break;
        }
        case 'docx': {
          const docx = await buildDocx(html, { title });
          downloadBlob(docx, baseName + '.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
          break;
        }
        case 'odt': {
          const odt = await buildOdt(html, { title });
          downloadBlob(odt, baseName + '.odt', 'application/vnd.oasis.opendocument.text');
          break;
        }
        case 'rtf': {
          const rtf = buildRtf(html, { title });
          downloadBlob(rtf, baseName + '.rtf', 'application/rtf');
          break;
        }
        case 'epub': {
          const epub = await buildEpub(html, { title, lang: activeFile.lang });
          downloadBlob(epub, baseName + '.epub', 'application/epub+zip');
          break;
        }
        case 'pdf': {
          const pdfBytes = await buildPdf(html, { title });
          downloadBlob(pdfBytes, baseName + '.pdf', 'application/pdf');
          break;
        }
        case 'json': {
          const backup = {
            exported: new Date().toISOString(),
            projectName,
            lang: activeFile.lang,
            files: files.map(f => ({ name: f.name, folder: f.folder || '', lang: f.lang, text: f.text })),
          };
          downloadBlob(JSON.stringify(backup, null, 2), (projectName || 'werket') + '-backup.json', 'application/json;charset=utf-8');
          break;
        }
      }
      dispatch({ type: 'ui/addToast', payload: { message: `Exported as ${EXPORT_FORMATS.find(f => f.id === format)?.label || format}`, type: 'success' } });
    } catch (err) {
      console.error('Export failed:', err);
      dispatch({ type: 'ui/addToast', payload: { message: 'Export failed', type: 'error' } });
    }
    dispatch(closeExportDialog());
  }, [activeFile, files, projectName, dispatch]);

  if (!exportDialogOpen || !exportFormat) return null;

  return (
    <dialog id="exportDialog" className="export-dialog" open={exportDialogOpen} onClose={() => dispatch(closeExportDialog())}>
      <div className="dialog-head">
        <div>
          <b>Export document</b>
          <span>Choose a format and save your work.</span>
        </div>
        <button onClick={() => dispatch(closeExportDialog())}>×</button>
      </div>
      <div className="template-grid" style={{ padding: '20px' }}>
        {EXPORT_FORMATS.map(format => (
          <button
            key={format.id}
            className="template-card"
            onClick={() => handleExport(format.id)}
          >
            <b>{format.label}</b>
            <span>Export as {format.extension}</span>
          </button>
        ))}
      </div>
    </dialog>
  );
};

export default ExportDialog;