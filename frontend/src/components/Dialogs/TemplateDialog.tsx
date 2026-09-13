import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { closeTemplateDialog } from '../../store/uiSlice';
import { createFileFromTemplate } from '../../store/workspaceSlice';
import { TEMPLATES } from '../../utils/constants';

export const TemplateDialog: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { templateDialogOpen } = useSelector((state: RootState) => state.ui);
  const { lang } = useSelector((state: RootState) => state.workspace);

  if (!templateDialogOpen) return null;

  const handleTemplateSelect = useCallback((templateId: string) => {
    const template = TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    const templateLang = lang;
    const templateFiles = template.files[templateLang] || template.files.en;
    templateFiles.forEach(([name, text]) => {
      dispatch(createFileFromTemplate({ name, text, lang: templateLang }));
    });
    dispatch(closeTemplateDialog());
  }, [dispatch, lang]);

  return (
    <dialog id="templateDialog" className="template-dialog" open={templateDialogOpen} onClose={() => dispatch(closeTemplateDialog())}>
      <div className="dialog-head">
        <div>
          <b>Start a new project</b>
          <span>Choose a structure and begin writing.</span>
        </div>
        <button id="closeTemplates" onClick={() => dispatch(closeTemplateDialog())}>×</button>
      </div>
      <div id="templateGrid" className="template-grid">
        {TEMPLATES.map(template => (
          <button
            key={template.id}
            className="template-card"
            onClick={() => handleTemplateSelect(template.id)}
          >
            <div className={`template-art artwork-${template.artwork}`}>
              <span>{template.icon}</span>
            </div>
            <b>{template.name[lang] || template.name.en}</b>
            <span>{template.description[lang] || template.description.en}</span>
          </button>
        ))}
      </div>
    </dialog>
  );
};

export default TemplateDialog;