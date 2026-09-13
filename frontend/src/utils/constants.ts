/**
 * Constants for the editor - templates, paper sizes, fonts, etc.
 */

export interface Template {
  id: string;
  icon: string;
  artwork: string;
  name: { en: string; am: string };
  description: { en: string; am: string };
  defaultName: { en: string; am: string };
  files: {
    en: Array<[string, string]>;
    am: Array<[string, string]>;
  };
  book?: boolean;
}

export const TEMPLATES: Template[] = [
  {
    id: 'blank',
    icon: '□',
    artwork: 'blank',
    name: { en: 'Blank document', am: 'ባዶ ሰነድ' },
    description: { en: 'A clean page for notes or free writing.', am: 'ለማስታወሻ ወይም ለነጻ ጽሕፈት ንጹህ ገጽ።' },
    defaultName: { en: 'Untitled.md', am: 'አዲስ ሰነድ.md' },
    files: {
      en: [['Untitled.md', '']],
      am: [['አዲስ ሰነድ.md', '']],
    },
  },
  {
    id: 'letter',
    icon: '✉',
    artwork: 'letter',
    name: { en: 'Letter', am: 'ደብዳቤ' },
    description: { en: 'Greeting, body, and closing for a formal note.', am: 'መንከባከቢያ ለመደበኛ ማስታወቂያ፤ መግቢያ፣ ይዘት እና መዝጊያ።' },
    defaultName: { en: 'Letter.md', am: 'ደብዳቤ.md' },
    files: {
      en: [[
        'Letter.md',
        `<h1>Letter</h1><p>[Date]</p><p>Dear [Name],</p><p>I hope this letter finds you well. [Write your message here.]</p><p>Thank you for your time and consideration.</p><p>Sincerely,</p><p>[Your name]</p>`
      ]],
      am: [[
        'ደብዳቤ.md',
        `<h1>ደብዳቤ</h1><p>[ቀን]</p><p>ውድ [ስም]፣</p><p>ይህ ደብዳቤ ደህንነትን እያመጣልህ/ሽ ተመንጄያለሁ። [መልእክትዎን እዚህ ይጻፉ።]</p><p>ለጊዜዎና ለትኩረትዎ እናመሰግናለን።</p><p>በአክብሮት፣</p><p>[ስምዎ]</p>`
      ]],
    },
  },
  {
    id: 'journal',
    icon: '◷',
    artwork: 'journal',
    name: { en: 'Daily journal', am: 'የዕለታዊ ማስታወሻ' },
    description: { en: 'A focused page for reflection and daily notes.', am: 'ለማሰላሰል እና ለዕለታዊ ማስታወሻ የተዘጋጀ ገጽ።' },
    defaultName: { en: 'Journal.md', am: 'ማስታወሻ.md' },
    files: {
      en: [[
        'Journal.md',
        `<h1>Daily journal</h1><p>Today's date: [Date]</p><h2>What happened today?</h2><p>Describe your day, your feelings, and your thoughts.</p><h2>Gratitude</h2><p>Three things you are grateful for today:<br>1. <br>2. <br>3. </p><h2>Tomorrow</h2><p>What would you like to focus on tomorrow?</p>`
      ]],
      am: [[
        'ማስታወሻ.md',
        `<h1>የዕለታዊ ማስታወሻ</h1><p>የዛሬው ቀን፡ [ቀን]</p><h2>ዛሬ ምን ተከሰተ?</h2><p>ቀንዎን፣ ስሜቶችዎንና ሃሳቦችዎን ይግለጹ።</p><h2>ምስጋና</h2><p>ዛሬ ያመሰገናችሁት ሦስት ነገሮች፡<br>1. <br>2. <br>3. </p><h2>ነገ</h2><p>ነገ በምን ላይ ማተኮር ይፈልጋሉ?</p>`
      ]],
    },
  },
  {
    id: 'meeting',
    icon: '✎',
    artwork: 'meeting',
    name: { en: 'Meeting notes', am: 'የስብሰባ ማስታወሻ' },
    description: { en: 'Agenda, notes, and next steps.', am: 'መርሃ ግብር፣ ማስታወሻ እና ቀጣይ እርምጃዎች።' },
    defaultName: { en: 'Meeting Notes.md', am: 'ስብሰባ.md' },
    files: {
      en: [[
        'Meeting Notes.md',
        `<h1>Meeting notes</h1><p>Date: [Date]</p><p>Attendees: [Names]</p><h2>Agenda</h2><ul><li>Topic 1</li><li>Topic 2</li><li>Topic 3</li></ul><h2>Discussion</h2><p>Key points and decisions from the meeting.</p><h2>Action Items</h2><ul><li>[Task — owner — due date]</li><li>[Task — owner — due date]</li></ul>`
      ]],
      am: [[
        'ስብሰባ.md',
        `<h1>የስብሰባ ማስታወሻ</h1><p>ቀን: [ቀን]</p><p>ተሳታፊዎች: [ስሞች]</p><h2>መርሃ ግብር</h2><ul><li>ርዕስ 1</li><li>ርዕስ 2</li><li>ርዕስ 3</li></ul><h2>ውይይት</h2><p>በስብሰባው የተወያዩባቸው ዋና ነጥቦች እና ውሳኔዎች።</p><h2>ተግባራት</h2><ul><li>[ተግባር — ተጠያቂ — ጊዜ]</li><li>[ተግባር — ተጠያቂ — ጊዜ]</li></ul>`
      ]],
    },
  },
  {
    id: 'book',
    icon: '▤',
    artwork: 'book',
    name: { en: 'Book project', am: 'የመጽሐፍ ፕሮጀክት' },
    description: { en: 'Outline, characters, research, and chapter files.', am: 'ዝርዝር ገለጻ፣ ገጸ-ባሕሪያት፣ ምርምር እና ምዕራፎች።' },
    defaultName: { en: 'Book.md', am: 'መጽሐፍ.md' },
    book: true,
    files: {
      en: [
        ['Outline.md', '<h1>Book Outline</h1><p>Working title: [Title]</p><h2>Premise</h2><p>One-sentence summary of the story.</p><h2>Structure</h2><ul><li>Part 1: [Description]</li><li>Part 2: [Description]</li><li>Part 3: [Description]</li></ul><h2>Chapter breakdown</h2><ol><li>Chapter 1: [Summary]</li><li>Chapter 2: [Summary]</li><li>Chapter 3: [Summary]</li></ol>'],
        ['Characters.md', '<h1>Characters</h1><h2>Protagonist</h2><p><strong>Name:</strong> [Name]<br><strong>Role:</strong> [Role]<br><strong>Goal:</strong> [Goal]<br><strong>Conflict:</strong> [Internal/External conflict]</p><h2>Antagonist</h2><p><strong>Name:</strong> [Name]<br><strong>Role:</strong> [Role]<br><strong>Goal:</strong> [Goal]</p><h2>Supporting cast</h2><ul><li>[Name] — [Role] — [Key trait]</li></ul>'],
        ['Research.md', '<h1>Research Notes</h1><p>World-building, historical facts, technical details, etc.</p>'],
        ['chapters/Chapter 1.md', '<h1>Chapter 1</h1><p>[Start writing here...]</p>'],
        ['chapters/Chapter 2.md', '<h1>Chapter 2</h1><p>[Continue writing...]</p>'],
      ],
      am: [
        ['ዝርዝር.md', '<h1>የመጽሐፍ ዝርዝር</h1><p>የሚሠራው ርዕስ: [ርዕስ]</p><h2>መሠረት</h2><p>የታሪክው አንድ ቃል ማጠቃለያ።</p><h2>ቋም</h2><ul><li>ክፍል 1: [ግለጽ]</li><li>ክፍል 2: [ግለጽ]</li><li>ክፍል 3: [ግለጽ]</li></ul><h2>የምዕራፎች ማዕረግ</h2><ol><li>ምዕራፍ 1: [ማጠቃለያ]</li><li>ምዕራፍ 2: [ማጠቃለያ]</li><li>ምዕራፍ 3: [ማጠቃለያ]</li></ol>'],
        ['ባሕሪያት.md', '<h1>ገጸ-ባሕሪያት</h1><h2>ዋና ባሕሪ</h2><p><strong>ስም:</strong> [ስም]<br><strong>ተሃብር:</strong> [ተሃብር]<br><strong>ግብዓት:</strong> [ግብዓት]<br><strong>ግጭት:</strong> [ውስጥ/ውጭ ግጭት]</p><h2>ተቃዋሚ ባሕሪ</h2><p><strong>ስም:</strong> [ስም]<br><strong>ተሃብር:</strong> [ተሃብር]<br><strong>ግብዓት:</strong> [ግብዓት]</p><h2>የማይታየው ተጨማሪ ባለቤት</h2><ul><li>[ስም] — [ተሃብር] — [ዋና ባሕሪ]</li></ul>'],
        ['ምርምር.md', '<h1>የምርምር ማስታወሻዎች</h1><p>ዓለም ማስተላለያ፣ ታሪካዊ እውነቶች፣ ቴክኒካል ዝርዝሮች እና ሌሎች።</p>'],
        ['chapters/ምዕራፍ 1.md', '<h1>ምዕራፍ 1</h1><p>[ከዚህ ይጀምሩ...]</p>'],
        ['chapters/ምዕራፍ 2.md', '<h1>ምዕራፍ 2</h1><p>[ቁጥጥር ይጻፉ...]</p>'],
      ],
    },
  },
];

export const PAPER_SIZES = {
  a4: { w: 794, h: 1123, name: 'A4 (210 × 297 mm)' },
  letter: { w: 816, h: 1056, name: 'US Letter (8.5 × 11 in)' },
  legal: { w: 816, h: 1344, name: 'US Legal (8.5 × 14 in)' },
  a5: { w: 559, h: 794, name: 'A5 (148 × 210 mm)' },
  a3: { w: 1123, h: 1587, name: 'A3 (297 × 420 mm)' },
} as const;

export type PaperSizeKey = keyof typeof PAPER_SIZES;

export const DEFAULT_MARGINS = { top: 72, right: 72, bottom: 72, left: 72 };

export const FONT_FAMILIES = [
  { value: 'Noto Sans Ethiopic', label: 'Noto Sans Ethiopic' },
  { value: 'Abyssinica SIL', label: 'Abyssinica SIL' },
  { value: 'Nyala', label: 'Nyala' },
  { value: 'Aptos', label: 'Aptos' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'system-ui', label: 'System UI' },
] as const;

export const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48] as const;

export const ZOOM_LEVELS = [0.75, 0.9, 1, 1.1, 1.25, 1.5, 2] as const;

export const PARAGRAPH_STYLES = [
  { value: 'body', label: 'Body' },
  { value: 'heading1', label: 'Heading 1' },
  { value: 'heading2', label: 'Heading 2' },
  { value: 'heading3', label: 'Heading 3' },
  { value: 'title', label: 'Title' },
  { value: 'subtitle', label: 'Subtitle' },
  { value: 'caption', label: 'Caption' },
  { value: 'code', label: 'Code' },
  { value: 'blockquote', label: 'Blockquote' },
] as const;

export const EXPORT_FORMATS = [
  { id: 'md', label: 'Markdown (.md)', extension: '.md', mime: 'text/markdown;charset=utf-8' },
  { id: 'html', label: 'Web page (.html)', extension: '.html', mime: 'text/html;charset=utf-8' },
  { id: 'txt', label: 'Plain text (.txt)', extension: '.txt', mime: 'text/plain;charset=utf-8' },
  { id: 'doc', label: 'Word document (.doc)', extension: '.doc', mime: 'application/msword' },
  { id: 'docx', label: 'Word document (.docx)', extension: '.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { id: 'odt', label: 'OpenDocument (.odt)', extension: '.odt', mime: 'application/vnd.oasis.opendocument.text' },
  { id: 'rtf', label: 'Rich Text (.rtf)', extension: '.rtf', mime: 'application/rtf' },
  { id: 'epub', label: 'E-book (.epub)', extension: '.epub', mime: 'application/epub+zip' },
  { id: 'pdf', label: 'Print to PDF (.pdf)', extension: '.pdf', mime: 'application/pdf' },
  { id: 'json', label: 'Backup workspace (.json)', extension: '.json', mime: 'application/json;charset=utf-8' },
] as const;