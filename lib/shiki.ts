// lib/shiki.ts
import { createHighlighter, type Highlighter } from 'shiki';

let highlighter: Highlighter | null = null;

export const getHighlighterInstance = async () => {
  if (!highlighter) {
    highlighter = await createHighlighter({
      // 🔥 تغییر تم از dark-plus به github-light برای زمینه روشن
      themes: ['github-light'],
      langs: [
        'javascript',
        'typescript',
        'python',
        'java',
        'rust',
        'go',
        'html',
        'css',
        'json',
        'bash',
        'c',
        'cpp',
        'csharp',
        'php',
        'ruby',
        'swift',
        'kotlin',
        'dart',
        'r',
        'sql',
        'yaml',
        'toml',
        'xml',
        'markdown',
        'shell',
        'powershell',
        'dockerfile',
        'graphql',
        'vue',
        'svelte',
      ],
    });
  }
  return highlighter;
};

export const highlightCode = async (code: string, language: string) => {
  const shiki = await getHighlighterInstance();
  // 🔥 استفاده از تم github-light
  return shiki.codeToHtml(code, { lang: language, theme: 'github-light' });
};