'use client';
import { forwardRef } from 'react';
import { themes, type CardTheme } from './themes';
import CardBackground from './CardBackground';
import CardHeader from './CardHeader';
import CardContent from './CardContent';
import CardFooter from './CardFooter';
import CardWatermark from './CardWatermark';

interface CardPreviewProps {
  title: string;
  summary: string;
  username?: string;
  slug: string;
  language: string;
  userAvatar?: string;
  theme?: CardTheme;
  showCode?: boolean;
  codeSnippet?: string;
  createdAt?: string;
  githubUsername?: string;
  views?: number;
  interactive?: boolean;
}

const CardPreview = forwardRef<HTMLDivElement, CardPreviewProps>(
  ({ 
    title, 
    summary, 
    username = 'Guest', 
    slug, 
    language, 
    userAvatar, 
    theme = 'blue', 
    showCode = true,
    codeSnippet = '',
    createdAt,
    githubUsername,
    views = 0,
    interactive = false,
  }, ref) => {
    const colors = themes[theme] || themes.blue;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://Zbloue.vercel.app';
    const fullUrl = `${appUrl}/snippet/${slug}`;

    return (
      <div
        ref={ref}
        className={`w-[1200px] h-[630px] ${colors.backgroundGradient} ${colors.background} p-8 flex flex-col font-sans relative overflow-hidden shadow-2xl rounded-2xl`}
        style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
        suppressHydrationWarning
      >
        <CardBackground theme={theme} />

        <CardHeader 
          colors={colors}
          theme={theme}
          username={username}
          githubUsername={githubUsername}
          userAvatar={userAvatar}
          interactive={interactive}
          appUrl={appUrl}
        />

        <CardContent
          colors={colors}
          theme={theme}
          language={language}
          title={title}
          summary={summary}
          codeSnippet={codeSnippet}
          createdAt={createdAt}
          showCode={showCode}
        />

        <CardFooter
          colors={colors}
          codeSnippet={codeSnippet}
          language={language}
          fullUrl={fullUrl}
          views={views}
        />

        <CardWatermark
          colors={colors}
          interactive={interactive}
          appUrl={appUrl}
        />
      </div>
    );
  }
);

CardPreview.displayName = 'CardPreview';

export default CardPreview;