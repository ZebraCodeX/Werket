import React, { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { setLang, setActiveFile } from '../../store/workspaceSlice';
import { TEMPLATES } from '../../utils/constants';

interface HomeProps {
  onOpenEditor: () => void;
}

export const Home: React.FC<HomeProps> = ({ onOpenEditor }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { files, lang } = useSelector((state: RootState) => state.workspace);
  const [, setTick] = useState(0);

  // Refresh relative times every minute
  React.useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const recentFiles = [...files]
    .sort((a, b) => b.updated - a.updated)
    .slice(0, 6);

  const handleTemplateSelect = useCallback((_templateId: string) => {
    onOpenEditor();
  }, [onOpenEditor]);

  const handleRecentClick = useCallback((fileId: string) => {
    dispatch(setActiveFile(fileId));
    onOpenEditor();
  }, [dispatch, onOpenEditor]);

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return lang === 'am' ? 'አሁን' : 'just now';
    if (diff < 3600000) return lang === 'am' ? `${Math.floor(diff / 60000)} ደ.` : `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return lang === 'am' ? `${Math.floor(diff / 3600000)} ሰ.` : `${Math.floor(diff / 3600000)}h ago`;
    return lang === 'am' ? `${Math.floor(diff / 86400000)} ቀ.` : `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div className="home">
      <div className="home-inner">
        {/* Hero */}
        <div className="home-hero">
          <div className="home-logo">
            <span className="home-logo-icon">W</span>
          </div>
          <h1 className="home-title">Werket</h1>
          <p className="home-subtitle">
            {lang === 'am'
              ? 'በአማርኛ እና በእንግሊዝኛ የጽሁፍ ሥራ ቦታ'
              : 'Write in Amharic and English'}
          </p>
          <div className="home-lang-toggle">
            <button
              className={`home-lang-btn ${lang === 'am' ? 'active' : ''}`}
              onClick={() => dispatch(setLang('am'))}
            >አማ</button>
            <button
              className={`home-lang-btn ${lang === 'en' ? 'active' : ''}`}
              onClick={() => dispatch(setLang('en'))}
            >EN</button>
          </div>
        </div>

        {/* Templates */}
        <section className="home-section">
          <h2 className="home-section-title">
            {lang === 'am' ? 'ጀመር' : 'Start writing'}
          </h2>
          <div className="home-templates">
            {TEMPLATES.map(template => (
              <button
                key={template.id}
                className="home-template-card"
                onClick={() => handleTemplateSelect(template.id)}
              >
                <div className={`home-template-art artwork-${template.artwork}`}>
                  <span>{template.icon}</span>
                </div>
                <div className="home-template-info">
                  <b>{template.name[lang] || template.name.en}</b>
                  <span>{template.description[lang] || template.description.en}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Recent Documents */}
        {recentFiles.length > 0 && (
          <section className="home-section">
            <h2 className="home-section-title">
              {lang === 'am' ? 'የቅርብ ሰነዶች' : 'Recent documents'}
            </h2>
            <div className="home-recent">
              {recentFiles.map(file => (
                <button
                  key={file.id}
                  className="home-recent-card"
                  onClick={() => handleRecentClick(file.id)}
                >
                  <div className="home-recent-icon">
                    {file.lang === 'am' ? 'አ' : 'E'}
                  </div>
                  <div className="home-recent-info">
                    <b>{file.name}</b>
                    <span>{formatTime(file.updated)}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default Home;
