import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { 
  closeNewDocDialog, 
  setNewDocLang, 
  setNewDocName, 
  setNewDocTemplate, 
  setNewDocShowKeyboard,
  setHomeOpen,
} from '../../store/uiSlice';
import { addFile } from '../../store/workspaceSlice';
import { TEMPLATES } from '../../utils/constants';

export const NewDocDialog: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { newDocDialogOpen, newDocData } = useSelector((state: RootState) => state.ui);

  if (!newDocDialogOpen) return null;

  const handleCreate = useCallback(() => {
    const template = TEMPLATES.find(t => t.id === newDocData.templateId);
    if (template) {
      const templateFiles = template.files[newDocData.lang] || template.files.en;
      templateFiles.forEach(([name, text]) => {
        dispatch(addFile({ name, text, lang: newDocData.lang }));
      });
    } else {
      dispatch(addFile({ name: newDocData.name, text: '', lang: newDocData.lang }));
    }
    dispatch(closeNewDocDialog());
    dispatch(setHomeOpen(false));
  }, [dispatch, newDocData]);

  const handleTemplateClick = useCallback((templateId: string) => {
    dispatch(setNewDocTemplate(templateId));
    const template = TEMPLATES.find(t => t.id === templateId);
    if (template) {
      dispatch(setNewDocName(template.defaultName[newDocData.lang] || template.defaultName.en));
    }
  }, [dispatch, newDocData.lang]);

  return (
    <dialog id="newDocDialog" className="newdoc-dialog" open={newDocDialogOpen} onClose={() => dispatch(closeNewDocDialog())}>
      <div className="newdoc-head">
        <div>
          <b id="newDocPickedName">New document</b>
          <span id="newDocPickedDesc">Choose a language and name your document.</span>
        </div>
        <button id="newDocCancel" className="newdoc-close" type="button" onClick={() => dispatch(closeNewDocDialog())}>×</button>
      </div>
      <form id="newDocForm" className="newdoc-form" onSubmit={e => { e.preventDefault(); handleCreate(); }}>
        <div className="newdoc-body">
          <div className="newdoc-section">
            <label className="newdoc-label">1. Choose a language</label>
            <div className="newdoc-langs">
              <label className={`newdoc-lang ${newDocData.lang === 'am' ? 'selected' : ''}`}>
                <input type="radio" name="newDocLang" checked={newDocData.lang === 'am'} onChange={() => dispatch(setNewDocLang('am'))} />
                <span className="newdoc-lang-badge">አማ</span>
                <b>Amharic</b>
                <small>አማርኛ</small>
              </label>
              <label className={`newdoc-lang ${newDocData.lang === 'en' ? 'selected' : ''}`}>
                <input type="radio" name="newDocLang" checked={newDocData.lang === 'en'} onChange={() => dispatch(setNewDocLang('en'))} />
                <span className="newdoc-lang-badge">EN</span>
                <b>English</b>
                <small>English</small>
              </label>
            </div>
          </div>
          <div className="newdoc-section">
            <label className="newdoc-label" htmlFor="newDocName" id="newDocNameLabel">2. Name your document</label>
            <input
              id="newDocName"
              className="newdoc-name"
              type="text"
              placeholder="Untitled.md"
              value={newDocData.name}
              onChange={e => dispatch(setNewDocName(e.target.value))}
              autoComplete="off"
            />
            <div id="newDocError" className="newdoc-error" hidden></div>
          </div>
          <div className="newdoc-section">
            <label className="newdoc-label">Template</label>
            <div id="newDocTemplateGrid" className="newdoc-templates">
              {TEMPLATES.map(template => (
                <button
                  key={template.id}
                  type="button"
                  className={`newdoc-tpl ${newDocData.templateId === template.id ? 'active' : ''}`}
                  onClick={() => handleTemplateClick(template.id)}
                >
                  <div className={`template-art artwork-${template.artwork}`}>
                    <span>{template.icon}</span>
                  </div>
                  <b>
                    {template.name[newDocData.lang] || template.name.en}
                    <small>{template.description[newDocData.lang] || template.description.en}</small>
                  </b>
                </button>
              ))}
            </div>
          </div>
          <label id="newDocOskWrap" className="newdoc-osk">
            <input
              type="checkbox"
              id="newDocOsk"
              checked={newDocData.showKeyboard}
              onChange={e => dispatch(setNewDocShowKeyboard(e.target.checked))}
            />
            <span>Show the on-screen Amharic keyboard <small>(አማርኛ ቁልፍ ሰሌዳ)</small></span>
          </label>
        </div>
        <div className="newdoc-foot">
          <button id="newDocCreate" className="newdoc-create" type="submit">Create document</button>
        </div>
      </form>
    </dialog>
  );
};

export default NewDocDialog;