import React, { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { closeTemplateDialog } from '../../store/uiSlice';
import { createFileFromTemplate } from '../../store/workspaceSlice';
import { generateContent } from '../../api/ai';

const CONTENT_TYPES = [
  { value: 'summary', label_en: 'Summary', label_am: 'ማጠቃለያ' },
  { value: 'story', label_en: 'Story', label_am: 'ታሪክ' },
  { value: 'essay', label_en: 'Essay', label_am: 'ድርሰት' },
  { value: 'outline', label_en: 'Outline', label_am: 'ዝርዝር' },
] as const;

export const AiTopicDialog: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { lang } = useSelector((state: RootState) => state.workspace);
  const [topic, setTopic] = useState('');
  const [contentType, setContentType] = useState<string>('summary');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = useCallback(async () => {
    const trimmed = topic.trim();
    if (!trimmed) {
      setError(lang === 'am' ? 'ርዕስ ያስገቡ' : 'Please enter a topic');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const result = await generateContent({
        topic: trimmed,
        lang,
        type: contentType as 'summary' | 'story' | 'essay' | 'outline',
      });

      const fileName = `AI · ${trimmed}.md`;

      dispatch(createFileFromTemplate({
        name: fileName,
        text: result.content,
        lang,
      }));
      dispatch(closeTemplateDialog());
    } catch (err: any) {
      setError(err.message || (lang === 'am' ? 'ስህተት ተፈጥሯል' : 'Generation failed'));
    } finally {
      setGenerating(false);
    }
  }, [topic, contentType, lang, dispatch]);

  return (
    <div className="ai-topic-panel">
      <div className="ai-topic-header">
        <span className="ai-icon">✦</span>
        <div>
          <b>{lang === 'am' ? 'AI መነሻ' : 'AI Starter'}</b>
          <span>{lang === 'am' ? 'ርዕስ ያስገቡ ይዘት ያመጡ' : 'Enter a topic to generate content'}</span>
        </div>
      </div>

      <div className="ai-topic-field">
        <label>{lang === 'am' ? 'ርዕስ' : 'Topic'}</label>
        <input
          type="text"
          className="ai-topic-input"
          value={topic}
          onChange={e => { setTopic(e.target.value); setError(''); }}
          placeholder={lang === 'am' ? 'ለምሳሌ፡ የኢትዮጵያ ታሪክ' : 'e.g. Ethiopian History'}
          onKeyDown={e => e.key === 'Enter' && handleGenerate()}
          autoFocus
          disabled={generating}
        />
      </div>

      <div className="ai-topic-field">
        <label>{lang === 'am' ? 'የይዘት ዓይነት' : 'Content Type'}</label>
        <div className="ai-type-buttons">
          {CONTENT_TYPES.map(ct => (
            <button
              key={ct.value}
              className={`ai-type-btn${contentType === ct.value ? ' active' : ''}`}
              onClick={() => setContentType(ct.value)}
              disabled={generating}
            >
              {lang === 'am' ? ct.label_am : ct.label_en}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="ai-error">{error}</div>}

      <div className="ai-topic-actions">
        <button
          className="ai-generate-btn"
          onClick={handleGenerate}
          disabled={generating || !topic.trim()}
        >
          {generating
            ? (lang === 'am' ? 'በመስራት ላይ...' : 'Generating...')
            : (lang === 'am' ? 'ይመርጡ' : 'Generate')
          }
        </button>
      </div>
    </div>
  );
};

export default AiTopicDialog;
