'use client';
import { forwardRef, useImperativeHandle, useState, useEffect, useRef, useCallback } from 'react';
import { Snippet, GenerateResponse, LineExplanation } from '@/types';
import { toPng } from 'html-to-image';
import CardPreview from '../card/CardPreview';
import { CardTheme, themes } from '../card/themes';
import LoadingState from './LoadingState';
import EmptyState from './EmptyState';
import OutputPanelHeader from './OutputPanelHeader';
import ExplanationTab from './tabs/ExplanationTab';
import LinkedInTab from './tabs/LinkedInTab';
import PreviewTab from './tabs/PreviewTab';
import AnalysisTab from './tabs/AnalysisTab';
import LineByLineTab from './tabs/LineByLineTab';
import PromptTab from './tabs/PromptTab';
import AllOutputsTab from './tabs/AllOutputsTab';

export interface OutputPanelProps {
  snippet: Snippet | null;
  loading: boolean;
  fullAnalysis?: GenerateResponse | null;
  analysisMode?: 'simple' | 'medium' | 'advanced';
  onUsernameChange?: (name: string) => void;
  onGithubChange?: (name: string) => void;
  onSnippetUpdate?: (data: { username: string; github_username: string }) => void;
  lineExplanations?: LineExplanation[];
  isExplaining?: boolean;
  onGenerateExplanation?: () => void;
  hoveredLine?: number | null;
  onLineHover?: (lineNumber: number | null) => void;
  generatedPrompt?: string;
  isGeneratingPrompt?: boolean;
  initialTab?: 'explanation' | 'linkedin' | 'preview' | 'analysis' | 'line-by-line' | 'prompt' | 'all-outputs';
}

export type TabType = 'explanation' | 'linkedin' | 'preview' | 'analysis' | 'line-by-line' | 'prompt' | 'all-outputs';

const safeString = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '[Object]';
    }
  }
  return String(value);
};

const OutputPanel = forwardRef<{ setActiveTab: (tab: TabType) => void }, OutputPanelProps>(
  function OutputPanel({
    snippet,
    loading,
    fullAnalysis,
    analysisMode,
    onUsernameChange,
    onGithubChange,
    onSnippetUpdate,
    lineExplanations = [],
    isExplaining = false,
    onGenerateExplanation,
    hoveredLine,
    onLineHover,
    generatedPrompt,
    isGeneratingPrompt = false,
    initialTab = 'explanation',
  }, ref) {
    const [activeTab, setActiveTab] = useState<TabType>(initialTab);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [cardImageDataUrl, setCardImageDataUrl] = useState<string | null>(null);
    const [isGeneratingCard, setIsGeneratingCard] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    const [selectedTheme, setSelectedTheme] = useState<CardTheme>('blue');
    const [displayUsername, setDisplayUsername] = useState<string>('Developer');
    const [displayGithubUsername, setDisplayGithubUsername] = useState<string>('');
    const [tempUsername, setTempUsername] = useState<string>('Developer');
    const [tempGithubUsername, setTempGithubUsername] = useState<string>('');
    const [showUsernameInput, setShowUsernameInput] = useState<boolean>(false);
    const [isUpdating, setIsUpdating] = useState<boolean>(false);
    const isFirstRender = useRef(true);
    const isUpdatingCard = useRef(false);
    const isDownloading = useRef(false);

    // ===== STATEهای جدید برای آپلود تصویر =====
    const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [hasUploaded, setHasUploaded] = useState(false);

    // ===== NEW STATE for avatar upload =====
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    const isAdvanced = analysisMode === 'advanced';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://Zbloue.vercel.app';

    const showToast = (message: string) => {
      setToastMessage(message);
      setTimeout(() => setToastMessage(null), 3000);
    };

    useImperativeHandle(ref, () => ({
      setActiveTab: (tab: TabType) => {
        setActiveTab(tab);
      },
    }));

    // ===== تابع آپلود تصویر کارت =====
    const handleUploadImage = useCallback(async () => {
      if (!snippet?.slug || !cardImageDataUrl) {
        showToast('❌ No image to upload');
        return;
      }

      setIsUploading(true);
      try {
        const response = await fetch('/api/upload-card-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: snippet.slug,
            imageDataUrl: cardImageDataUrl,
          }),
        });

        const data = await response.json();
        if (data.success) {
          setSavedImageUrl(data.imageUrl);
          setHasUploaded(true);
          showToast('✅ Card image uploaded successfully!');
        } else {
          throw new Error(data.error || 'Upload failed');
        }
      } catch (error: any) {
        console.error('Upload error:', error);
        showToast(`❌ ${error.message || 'Failed to upload'}`);
      } finally {
        setIsUploading(false);
      }
    }, [snippet, cardImageDataUrl]);

    // ===== NEW: Avatar upload handler =====
    const handleUploadAvatar = useCallback(async (file: File) => {
      if (!snippet?.slug) {
        showToast('❌ No snippet available');
        return;
      }

      setIsUploadingAvatar(true);
      try {
        const formData = new FormData();
        formData.append('avatar', file);
        formData.append('slug', snippet.slug);

        const response = await fetch('/api/upload-avatar', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        if (data.success) {
          setAvatarUrl(data.avatarUrl);
          // Update snippet in database
          await updateSnippetInDatabase(snippet.slug, {
            avatar_url: data.avatarUrl,
          });
          showToast('✅ Avatar uploaded successfully!');
        } else {
          throw new Error(data.error || 'Upload failed');
        }
      } catch (error: any) {
        console.error('Avatar upload error:', error);
        showToast(`❌ ${error.message || 'Failed to upload avatar'}`);
      } finally {
        setIsUploadingAvatar(false);
      }
    }, [snippet]);

    const updateSnippetInDatabase = useCallback(async (username: string, githubUsername: string) => {
      if (!snippet || !snippet.slug) return;

      setIsUpdating(true);
      try {
        const response = await fetch(`/api/update-snippet/${snippet.slug}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.NEXT_PUBLIC_API_KEY || '',
          },
          body: JSON.stringify({
            username: username,
            github_username: githubUsername,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Update failed');
        }

        const data = await response.json();

        if (onSnippetUpdate) {
          onSnippetUpdate({ username, github_username: githubUsername });
        }

        showToast('✅ User info updated successfully!');
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Update failed';
        if (process.env.NODE_ENV === 'development') {
          console.error('Update error:', error);
        }
        showToast(`❌ Failed to update: ${message}`);
      } finally {
        setIsUpdating(false);
      }
    }, [snippet, onSnippetUpdate]);

    const generateCardImage = useCallback(async (): Promise<string> => {
      if (!cardRef.current) {
        throw new Error('Card element not found');
      }

      try {
        const dataUrl = await toPng(cardRef.current, {
          pixelRatio: 2,
          cacheBust: true,
          backgroundColor: '#0f0f1a',
          style: {
            transform: 'scale(1)',
          },
        });
        return dataUrl;
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error generating card image:', error);
        }
        throw error;
      }
    }, []);

    const downloadCard = useCallback(async () => {
      if (isDownloading.current) {
        if (process.env.NODE_ENV === 'development') {
          console.log('⏳ Download already in progress...');
        }
        return;
      }

      if (!snippet) {
        showToast('❌ No snippet available');
        return;
      }

      isDownloading.current = true;
      showToast('⏳ Generating card image...');

      try {
        let dataUrl = cardImageDataUrl;
        if (!dataUrl) {
          setIsGeneratingCard(true);
          dataUrl = await generateCardImage();
          setCardImageDataUrl(dataUrl);
          setIsGeneratingCard(false);
        }

        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Zbloue-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        showToast('✅ Image downloaded!');
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Download failed:', error);
        }
        showToast('❌ Failed to download image');
      } finally {
        isDownloading.current = false;
      }
    }, [snippet, cardImageDataUrl, generateCardImage]);

    const updateCardImage = useCallback(async () => {
      if (!snippet || activeTab !== 'preview' || isUpdatingCard.current) return;

      isUpdatingCard.current = true;

      const newUsername = tempUsername || 'Developer';
      const newGithubUsername = tempGithubUsername || '';

      setDisplayUsername(newUsername);
      setDisplayGithubUsername(newGithubUsername);

      if (onUsernameChange) {
        onUsernameChange(newUsername);
      }
      if (onGithubChange) {
        onGithubChange(newGithubUsername);
      }

      await updateSnippetInDatabase(newUsername, newGithubUsername);

      setIsGeneratingCard(true);
      try {
        const dataUrl = await generateCardImage();
        setCardImageDataUrl(dataUrl);
        showToast('✅ Card updated successfully!');
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Card generation failed:', error);
        }
        showToast('❌ Failed to generate card');
      } finally {
        setIsGeneratingCard(false);
        isUpdatingCard.current = false;
      }
    }, [snippet, activeTab, generateCardImage, tempUsername, tempGithubUsername, onUsernameChange, onGithubChange, updateSnippetInDatabase]);

    useEffect(() => {
      if (snippet && activeTab === 'preview' && isFirstRender.current) {
        isFirstRender.current = false;

        if (snippet.username) {
          setDisplayUsername(snippet.username);
          setTempUsername(snippet.username);
        }
        if (snippet.github_username) {
          setDisplayGithubUsername(snippet.github_username);
          setTempGithubUsername(snippet.github_username);
        }
        if (snippet.avatar_url) {
          setAvatarUrl(snippet.avatar_url);
        }

        setIsGeneratingCard(true);
        generateCardImage()
          .then((dataUrl) => {
            setCardImageDataUrl(dataUrl);
          })
          .catch((error) => {
            if (process.env.NODE_ENV === 'development') {
              console.error('Card generation failed:', error);
            }
            showToast('❌ Failed to generate card');
          })
          .finally(() => {
            setIsGeneratingCard(false);
          });
      }
    }, [snippet, activeTab, generateCardImage]);

    useEffect(() => {
      if (showUsernameInput) {
        setTempUsername(displayUsername);
        setTempGithubUsername(displayGithubUsername);
      }
    }, [showUsernameInput]);

    const copyFullAnalysisNew = useCallback(() => {
      if (!fullAnalysis || !isAdvanced) {
        showToast('❌ No analysis to copy');
        return;
      }

      try {
        let content = `📊 Code Analysis Report\n`;
        content += `═══════════════════════════════════════\n\n`;
        content += `📌 Title: ${safeString(fullAnalysis.title)}\n\n`;
        if (fullAnalysis.highLevelSummary) {
          content += `💡 High-Level Summary:\n${safeString(fullAnalysis.highLevelSummary)}\n\n`;
        }
        if (fullAnalysis.codeWalkthrough && fullAnalysis.codeWalkthrough.length > 0) {
          content += `🧩 Code Walkthrough:\n`;
          fullAnalysis.codeWalkthrough.forEach((item) => {
            content += `  • ${safeString(item.section)}: ${safeString(item.explanation)}\n`;
          });
          content += `\n`;
        }
        if (fullAnalysis.whatWorksWell && fullAnalysis.whatWorksWell.length > 0) {
          content += `✅ What Works Well:\n`;
          fullAnalysis.whatWorksWell.forEach((item) => {
            content += `  • ${safeString(item)}\n`;
          });
          content += `\n`;
        }
        if (fullAnalysis.bugsAndRiskyCases && fullAnalysis.bugsAndRiskyCases.length > 0) {
          content += `🐛 Bugs and Risky Cases:\n`;
          fullAnalysis.bugsAndRiskyCases.forEach((item) => {
            content += `  • ${safeString(item.issue)}\n`;
            content += `    Impact: ${safeString(item.impact)}\n`;
            if (item.example) content += `    Example: ${safeString(item.example)}\n`;
          });
          content += `\n`;
        }
        if (fullAnalysis.edgeCases && fullAnalysis.edgeCases.length > 0) {
          content += `🧪 Edge Cases:\n`;
          fullAnalysis.edgeCases.forEach((item) => {
            content += `  • ${safeString(item.case)}\n`;
            content += `    Current: ${safeString(item.currentBehavior)}\n`;
            content += `    Expected: ${safeString(item.expectedBehavior)}\n`;
            content += `    Risk: ${safeString(item.risk)}\n`;
          });
          content += `\n`;
        }
        if (fullAnalysis.performanceAnalysis) {
          content += `⚡ Performance Analysis:\n`;
          if (fullAnalysis.performanceAnalysis.timeComplexity && fullAnalysis.performanceAnalysis.timeComplexity && fullAnalysis.performanceAnalysis.timeComplexity.length > 0) {
.timeComplexity.length > 0)            content += `  Time Complexity:\n`;
 {
            content += `  Time Complexity:\n`;
            fullAnalysis.performanceAnalysis.timeComplexity            fullAnalysis.performanceAnalysis.timeComplexity.forEach((item) => {
              content += `    • ${safeString(item.target.forEach((item) => {
              content += `    • ${safeString(item.target)}:)}: ${safeString(item.complexity)} ( ${safeString(item.complexity)} (${safeString(item.explanation)}${safeString(item.explanation)})\n`;
            });
          }
          if (fullAnalysis)\n`;
            });
          }
          if (fullAnalysis.performanceAnalysis..performanceAnalysis.spaceComplexity && fullAnalysis.performanceAnalysis.spaceComplexspaceComplexity && fullAnalysis.performanceAnalysis.spaceComplexity.length > 0) {
           ity.length > 0) {
            content += `  Space Complexity:\n content += `  Space Complexity:\n`;
`;
            fullAnalysis.performanceAnalysis.spaceComplexity.forEach            fullAnalysis.performanceAnalysis.spaceComplexity.forEach((item) => {
              content +=((item) => {
              content += `    • ${safeString(item.target)}: `    • ${safeString(item.target ${safeString(item.complexity)} (${)}: ${safeString(item.complexity)} (${safeString(item.explanation)})\safeString(item.explanation)})\n`;
            });
          }
          if (fulln`;
            });
          }
          if (fullAnalysis.performanceAnalysis.scalabilityNotes && fullAnalysis.performanceAnalysis.scalabilityNotes && fullAnalysis.performanceAnalysis.scalabilityNotesAnalysis.performanceAnalysis.scalabilityNotes.length > 0) {
            content += ` .length > 0) {
            content += `  Scalability Notes:\n`;
            fullAnalysis Scalability Notes:\n`;
            fullAnalysis.performanceAnalysis.scalabilityNotes.forEach.performanceAnalysis.scalabilityNotes.forEach((item) => {
              content += `((item) => {
              content += `       • ${safeString(item)}\n`;
            • ${safeString(item)}\n`;
            });
          }
          content += `\n });
          }
          content += `\n`;
        }
        if (fullAnalysis`;
        }
        if (fullAnalysis.securityAnalysis).securityAnalysis) {
          content += `🔒 Security Analysis {
          content += `🔒 Security Analysis:\n`;
          content += ` :\n`;
          content += `  Severity: ${safeString(full Severity: ${safeString(fullAnalysis.securityAnalysis.securityAnalysis.severity)}\n`;
Analysis.severity)}\n`;
          if          if (fullAnalysis.securityAnalysis.issues && full (fullAnalysis.securityAnalysis.issues && fullAnalysis.securityAnalysis.issues.length > Analysis.securityAnalysis.issues.length > 0) {
            content += `  Issues:\0) {
            content += `  Issuesn`;
            fullAnalysis.securityAnalysis.issues.forEach:\n`;
            fullAnalysis.securityAnalysis.issues.forEach((issue) => {
              content +=((issue) => {
              content += `    • ${safeString(issue `    • ${safeString(issue)}\n`;
            });
          }
          if ()}\n`;
            });
          }
          if (fullAnalysis.securityAnalysis.recommendations && fullAnalysis.securityAnalysis.recommendations.lengthfullAnalysis.securityAnalysis.recommendations && fullAnalysis.securityAnalysis.recommendations.length > 0) {
            content += > 0) {
            content += `  Recommendations:\n`;
            full `  Recommendations:\n`;
            fullAnalysis.securityAnalysis.recommendations.forEachAnalysis.securityAnalysis.recommendations.forEach((rec) => {
              content += `    • ${safeString(rec)}\n`;
            });
((rec) => {
              content += `    • ${safeString(rec)}\n`;
                     }
          content += `\n`;
        });
          }
          content += `\n`;
        }
        if (fullAnalysis.productionRead }
        if (fullAnalysis.productionReadiness) {
          content += `🛡iness) {
          content += `️ Production Readiness:\n`;
          content += `  Ready: ${fullAnalysis.pro🛡️ Production Readiness:\n`;
          content += `  Ready: ${fullAnalysis.productionReadiness.isProductionReady ? 'ductionReadiness.isProductionReady ? 'Yes' : 'No'}\nYes' : 'No'}\n`;
          if (`;
          if (fullAnalysis.productionReadiness.reasonsfullAnalysis.productionReadiness.reasons && fullAnalysis.productionReadiness.re && fullAnalysis.productionReadiness.reasons.length > 0) {
            fullAnalysis.productionasons.length > 0) {
            fullAnalysis.productionReadiness.reasons.forEach((reason)Readiness.reasons.forEach((reason) => {
              content += `    • => {
              content += `    • ${safeString(reason)}\n`;
            ${safeString(reason)}\n`;
            });
          }
          if (fullAnalysis.productionRead });
          }
          if (fullAnalysis.productionReadiness.requiredChanges && fullAnalysis.proiness.requiredChanges && fullAnalysis.productionReadiness.requiredChanges.length > 0ductionReadiness.requiredChanges.length > 0) {
            content += `  Required Changes:\) {
            content += `  Required Changes:\n`;
            fullAnalysis.productionReadn`;
            fullAnalysis.productionReadiness.requiredChanges.forEach((change) => {
iness.requiredChanges.forEach((change) =>              content += `    • ${safeString( {
              content += `    • ${safeString(change)}\n`;
            });
          }
          content += `\n`;
        }
change)}\n`;
            });
          }
          content += `\n`;
               if (fullAnalysis.recommendedImprovements && }
        if (fullAnalysis.recommendedImprovements && fullAnalysis.recommendedImprovements.length >  fullAnalysis.recommendedImprovements.length > 0) {
          content0) {
          content += `🔧 Recommended Improvements:\n`;
          fullAnalysis.re += `🔧 Recommended Improvements:\n`;
         commendedImprovements.forEach((item fullAnalysis.recommendedImprovements.forEach((item) => {
            content += `  [${safe) => {
            content += `  [${safeString(item.priority)}] ${safeString(item.priority)}] ${safeString(item.improvement)}\nString(item.improvement)}\n`;
            content += `    Reason: ${safeString(item.re`;
            content += `    Reason: ${safeString(itemason)}\n`;
          });
          content.reason)}\n`;
          });
          content += `\n`;
        }
        += `\n`;
        }
        if (fullAnalysis.improvedCode && full if (fullAnalysis.improvedCode &&Analysis.improvedCode.available) {
          fullAnalysis.improvedCode.available) {
          content += `✨ Improved Code:\n content += `✨ Improved Code:\n`;
          content += `Notes: ${`;
          content += `Notes: ${safeString(fullAnalysis.improvedCode.notes)}\safeString(fullAnalysis.improvedCode.notes)}\n`;
          content += `${safeString(fullAnalysis.improvedCoden`;
          content += `${safeString(fullAnalysis.improvedCode.code)}\.code)}\n\n`;
        }
        if (fullAnalysis.suggestedTests && fullAnalysis.suggestedTests.length > 0) {
          content += `🧪 Suggested Tests:\n`;
          fullAnalysis.suggestedTests.forEach((test) => {
            content += `  • ${safen\n`;
        }
        if (fullAnalysis.suggestedTests && fullAnalysis.suggestedTests.length > 0) {
          content += `🧪 Suggested Tests:\n`;
          fullAnalysis.suggestedTests.forEach((test) => {
            content += `  • ${safeString(test.name)}\String(test.name)}\n`;
            content +=n`;
            content += `    Input: ${safeString(test.input)}\n `    Input: ${safeString(test.input)}\n`;
            content += `    Expected:`;
            content += `    Expected: ${safeString(test.expectedOutput)}\n`;
            content ${safeString(test.expectedOutput)}\n`;
 += `    Type: ${safeString(test.type)}\n            content += `    Type: ${safeString(test.type)}\n`;
          });
          content += `\`;
          });
          content += `\n`;
        }
        if (fullAnalysis.scorecard)n`;
        }
        if (fullAnalysis.scorecard) {
          content += `📊 Score {
          content += `📊 Scorecard:\n`;
          const scores =card:\n`;
          const scores = fullAnalysis.scorecard;
          content += `  Correct fullAnalysis.scorecard;
          content += `  Correctness: ${safeString(scoresness: ${safeString(scores.correctness)}/10\n`;
         .correctness)}/10\n`;
          content += `  Readability: ${safeString content += `  Readability: ${safeString(scores.readability)}/(scores.readability)}/10\n`;
          content += `  Performance: ${safe10\n`;
          content += `  Performance:String(scores.performance)}/10\n`;
 ${safeString(scores.performance)}/10\n`;
          content += `  Maintain          content += `  Maintainability: ${safeString(scores.maintainability)}/ability: ${safeString(scores.main10\n`;
          content += ` tainability)}/10\n`;
          content += `  Production Readiness: ${safeString(scores.productionRead Production Readiness: ${safeString(scores.productionReadiness)}/10\n`;
          ifiness)}/10\n`;
          if (scores.security !== undefined) content += ` (scores.security !== undefined) content  Security: ${safeString(scores.security)} += `  Security: ${safeString(scores.security)}/10\n`;
          if (s/10\n`;
          if (scores.overall) content += `  Overall: ${cores.overall) content += `safeString(scores.overall)}/10\n  Overall: ${safeString(scores.overall)}/10\n`;
          content += ``;
          content += `\n`;
        }
        if (fullAnalysis.final\n`;
        }
        if (fullAnalysis.finalVerdict) {
          content +=Verdict) {
          content += `🏁 Final `🏁 Final Verdict:\n Verdict:\n`;
          content +=`;
          content += `  Summary: ${safeString(f `  Summary: ${safeString(fullAnalysis.finalVerdict.summary)}\n`;
          content += `ullAnalysis.finalVerdict.summary)}\n`;
          content += `  Approved: ${fullAnalysis.finalVerdict.app  Approved: ${fullAnalysis.finalVroved ? '✅ Yes' :erdict.approved ? '✅ Yes' : '❌ No'}\n`;
          if ( '❌ No'}\n`;
          if (fullAnalysis.finalVfullAnalysis.finalVerdict.nextSteps) {
            content += `  Nexterdict.nextSteps) {
            content += `  Next Steps: ${safeString(fullAnalysis.finalVerd Steps: ${safeString(fullAnalysis.finalVerdict.nextSteps)}\nict.nextSteps)}\n`;
          }
        }

        navigator.clipboard`;
          }
        }

        navigator.clipboard.writeText(content).then(() => {
          showToast('✅ Full analysis copied!');
.writeText(content).then(() => {
          showToast('✅ Full analysis        }).catch(() => {
          showToast copied!');
        }).catch(() => {
          showToast('❌ Failed to copy');
       ('❌ Failed to copy');
        });
      } catch (error) {
        if (process });
      } catch (error) {
        if (process.env.NODE_ENV ===.env.NODE_ENV === 'development 'development') {
          console.error('Copy') {
          console.error('Copy error error:', error);
        }
        showToast('❌:', error);
        }
        showToast('❌ Failed to copy analysis');
      }
    }, [fullAnalysis, isAdvanced Failed to copy analysis');
      }
    }, [fullAnalysis, isAdvanced]);

    const downloadAnalysisNew = useCallback(() => {
      if (!fullAnalysis]);

    const downloadAnalysisNew = useCallback(() => {
      if (!fullAnalysis || !isAdvanced || !isAdvanced) {
        showToast('❌) {
        showToast('❌ No analysis to download No analysis to download');
        return');
        return;
      }

      try {
        let content = `Z;
      }

      try {
        let contentbloue - Code Analysis Report\n`;
 = `Zbloue - Code Analysis Report\n`;
        content += `════════        content += `═══════════════════════════════════════\n\n══════════════════════════════`;
        content += `📌 Title:═\n\n`;
        content += `📌 Title: ${safeString(fullAnalysis ${safeString(fullAnalysis.title)}\n\n.title)}\n\n`;
        if (fullAnalysis.highLevelSummary) {
          content`;
        if (fullAnalysis.highLevelSummary) {
          content += `💡 += `💡 High-Level Summary:\n${ High-Level Summary:\n${safeString(fullAnalysis.highLevelSummary)}\n\nsafeString(fullAnalysis.highLevelSummary)}\n\n`;
        }
       `;
        }
        if (fullAnalysis if (fullAnalysis.codeWalkthrough && full.codeWalkthrough && fullAnalysis.codeWalkthroughAnalysis.codeWalkthrough.length > 0) {
          content += `🧩 Code Walk.length > 0) {
          content += `🧩 Code Walkthrough:\n`;
          fullAnalysis.codeWalkthrough.forEach((through:\n`;
          fullAnalysis.codeWalkthrough.forEach((item) => {
            contentitem) => {
            content += `  • += `  • ${safeString(item.s ${safeString(item.section)}: ${ection)}: ${safeString(item.exsafeString(item.explanation)}\n`;
          });
          content += `\n`;
planation)}\n`;
          });
          content += `\n`;
        }
        if (full        }
        if (fullAnalysis.whatWorksWell && fullAnalysis.whatWorksWellAnalysis.whatWorksWell && fullAnalysis.what.length > 0) {
WorksWell.length > 0) {
          content += `✅ What Works Well:\n          content += `✅ What Works Well:\n`;
          fullAnalysis`;
          fullAnalysis.whatWorksWell.forEach((item).whatWorksWell.forEach((item) => {
            content += `  • => {
            content += `  • ${safeString(item)}\n`;
          ${safeString(item)}\n`;
          });
          });
          content += `\n`;
        }
        if (fullAnalysis.bugsAndR content += `\n`;
        }
        if (fullAnalysis.bugsAndRiskyCases && fullAnalysis.bugsAndRiskyCases.length > 0iskyCases && fullAnalysis.bugsAndRiskyCases.length > 0) {
         ) {
          content += `🐛 Bugs and Ris content += `🐛 Bugs and Risky Cases:\n`;
          fullAnalysis.bugsAndRiskyCases.forEachky Cases:\n`;
          fullAnalysis.bugsAndRiskyCases.forEach((item) =>((item) => {
            content += `  • ${ {
            content += `  • ${safeString(item.issue)}\nsafeString(item.issue)}\n`;
            content += `    Impact: ${safeString(item`;
            content += `    Impact: ${safeString(item.impact)}\n`;
            if (item.impact)}\n`;
            if (item.example) content += `    Example.example) content += `    Example: ${safeString(item.example)}\n`;
          });
          content += `\n`;
       : ${safeString(item.example)}\n`;
          });
          content += `\ }
        if (fullAnalysis.edgeCasesn`;
        }
        if (fullAnalysis.edgeCases && fullAnalysis.edgeCases.length > 0) {
          content += ` && fullAnalysis.edgeCases.length > 0) {
          content += `🧪 Edge Cases:\n`;
          fullAnalysis.edge🧪 Edge Cases:\n`;
          fullAnalysis.edgeCases.forEach((item) => {
            content += `  • ${safeString(itemCases.forEach((item) => {
            content += `  • ${safeString.case)}\n`;
            content += `    Current(item.case)}\n`;
            content += `: ${safeString(item.currentBehavior)}\n`;
            content += `    Expected:    Current: ${safeString(item.currentBehavior)}\n`;
            content += `    ${safeString(item.expectedBehavior)}\ Expected: ${safeString(item.expectedn`;
            content += `    Risk: ${Behavior)}\n`;
            content += `    Risk: ${safeString(item.risk)}\nsafeString(item.risk)}\n`;
          });
          content += `\n`;
          });
          content += `\n`;
        }
        if (fullAnalysis.performanceAnalysis`;
        }
        if (fullAnalysis.performanceAnalysis) {
          content += `⚡ Performance) {
          content += `⚡ Performance Analysis:\n`;
          if (full Analysis:\n`;
          if (fullAnalysis.performanceAnalysis.timeComplexity && fullAnalysis.performanceAnalysis.timeComplexityAnalysis.performanceAnalysis.timeComplexity && fullAnalysis.performanceAnalysis.timeComplexity.length > 0) {
            content += `  Time Complexity:\n`;
            fullAnalysis.performanceAnalysis.timeComplexity.forEach((item) => {
              content += `    • ${safeString(item.target)}: ${safeString(item.complexity)} (${safeString(item.explanation)})\n.length > 0) {
            content += `  Time Complexity:\n`;
            fullAnalysis.performanceAnalysis.timeComplexity.forEach((item) => {
              content += `    • ${safeString(item.target)}: ${safeString(item.complexity)} (${safeString(item.explanation)})\n`;
            });
          }
          if (fullAnalysis.performance`;
            });
          }
          if (fullAnalysis.performanceAnalysis.spaceComplexity &&Analysis.spaceComplexity && fullAnalysis. fullAnalysis.performanceAnalysis.spaceComplexity.length > 0) {
            contentperformanceAnalysis.spaceComplexity.length > 0) {
            content += `  += `  Space Complexity:\n`;
            fullAnalysis.performanceAnalysis.spaceComplexity.forEach((item) Space Complexity:\n`;
            fullAnalysis.performanceAnalysis.spaceComplexity.forEach((item) => {
              content += `    • ${safeString(item.target)}: ${safeString(item => {
              content += `    • ${safeString(item.target)}: ${safeString(item.com.complexity)} (${safeString(itemplexity)} (${safeString(item.explanation)})\n`;
            });
         .explanation)})\n`;
            }
          if (fullAnalysis.performanceAnalysis.sc });
          }
          if (fullAnalysis.performanceAnalysis.scalabilityNotes && fullAnalysis.performancealabilityNotes && fullAnalysis.performanceAnalysis.scalabilityNotes.length > 0) {
           Analysis.scalabilityNotes.length >  content += `  Scalability Notes:\n`;
            fullAnalysis.performanceAnalysis0) {
            content += `  Scalability Notes:\n`;
            fullAnalysis.performanceAnalysis.scalabilityNotes.forEach((item) => {
             .scalabilityNotes.forEach((item) content += `    • ${safeString(item => {
              content += `    • ${safeString(item)}\n`;
            });
          }
         )}\n`;
            });
          }
          content += `\n`;
        }
        if (fullAnalysis.securityAnalysis content += `\n`;
        }
        if (fullAnalysis.securityAnalysis) {
) {
          content += `🔒 Security Analysis:\n`;
          content += `  Severity          content += `🔒 Security Analysis:\n`;
          content += `  Severity: ${safeString(fullAnalysis.security: ${safeString(fullAnalysis.securityAnalysisAnalysis.severity)}\n`;
          if (fullAnalysis.severity)}\n`;
          if (fullAnalysis.securityAnalysis.issues && fullAnalysis.security.securityAnalysis.issues && fullAnalysis.securityAnalysis.issues.length > 0) {
            content += `  Issues:\n`;
Analysis.issues.length > 0) {
            content += `  Issues:\n`;
            fullAnalysis.securityAnalysis.issues.forEach((issue            fullAnalysis.securityAnalysis.issues.forEach((issue) => {
              content += `   ) => {
              content += `    • ${safeString(issue)}\n`;
            • ${safeString(issue)}\n`;
            });
          }
          if (fullAnalysis.securityAnalysis });
          }
          if (fullAnalysis.securityAnalysis.recommendations && fullAnalysis.security.recommendations && fullAnalysis.securityAnalysis.recommendations.length > Analysis.recommendations.length > 0) {
            content += `  Recommendations:\n0) {
            content += `  Recommendations:\n`;
            fullAnalysis.securityAnalysis.recommend`;
            fullAnalysis.securityAnalysis.recommendations.forEach((rec) => {
              content +=ations.forEach((rec) => {
              content += `    • ${safeString(rec)}\n `    • ${safeString(rec)}\n`;
            });
          }
          content +=`;
            });
          }
          content += `\n`;
        }
        if (fullAnalysis.pro `\n`;
        }
        ifductionReadiness) {
          content += (fullAnalysis.productionReadiness) {
          content += `🛡️ Production Readiness `🛡️ Production Readiness:\n`;
          content += `  Ready::\n`;
          content += `  Ready ${fullAnalysis.productionReadiness.isProductionReady: ${fullAnalysis.productionReadiness.isProductionReady ? 'Yes' ? 'Yes' : 'No'}\n`;
          if (fullAnalysis.productionReadiness : 'No'}\n`;
         .reasons && fullAnalysis.productionRead if (fullAnalysis.productionReadiness.reasons && fullAnalysis.productionReadiness.reasons.lengthiness.reasons.length > 0) {
            fullAnalysis.productionReadiness.reasons.forEach > 0) {
            fullAnalysis((reason) => {
              content += `.productionReadiness.reasons.forEach((reason) => {
              content += `       • ${safeString(reason)}\n`;
            });
          }
          if • ${safeString(reason)}\n`;
            (fullAnalysis.productionReadiness.requiredChanges && fullAnalysis.productionReadiness.requiredChanges });
          }
          if (fullAnalysis.productionReadiness.requiredChanges && fullAnalysis.productionReadiness.requiredChanges.length >.length > 0) {
            content += `  Required Changes:\n`;
 0) {
            content += `  Required Changes:\n`;
            fullAnalysis.pro            fullAnalysis.productionReadiness.requiredChanges.forEach((ductionReadiness.requiredChanges.forEach((change) => {
              content += `    • ${change) => {
              content += `    • ${safeString(change)}\safeString(change)}\n`;
           n`;
            });
          }
          content });
          }
          content += `\n`;
        }
        if (fullAnalysis += `\n`;
        }
        if (fullAnalysis.recommendedImprovements && fullAnalysis.recommendedImprovements && fullAnalysis.recommendedImpro.recommendedImprovements.length > 0) {
         vements.length > 0) {
          content += `🔧 Recommended Improvements:\ content += `🔧 Recommended Improvements:\n`;
          fullAnalysis.recommendedn`;
          fullAnalysis.recommendedImprovements.forEach((item) => {
           Improvements.forEach((item) => {
            content += `  [${safeString(item.priority content += `  [${safeString(item.priority)}] ${safeString(item.impro)}] ${safeString(item.improvement)}\n`;
            content += `    Reason: ${safeString(item.reason)}\nvement)}\n`;
            content += `    Reason: ${safeString(item.reason)}\n`;
          });
          content += `\`;
          });
          content += `\n`;
        }
        if (fulln`;
        }
        if (fullAnalysis.improvedCode && fullAnalysisAnalysis.improvedCode && fullAnalysis.improvedCode.improvedCode.available) {
         .available) {
          content += ` content += `✨ Improved Code:\n`;
          content += `Notes: ${safeString(f✨ Improved Code:\n`;
          content += `Notes: ${safeString(fullAnalysis.improvedCode.notesullAnalysis.improvedCode.notes)}\n`;
)}\n`;
          content += `${safeString(fullAnalysis.improvedCode.code)}\n\n          content += `${safeString(fullAnalysis.improvedCode.code)}\n\n`;
        }
        if (fullAnalysis`;
        }
        if (fullAnalysis.s.suggestedTests && fullAnalysis.suggestedTests.lengthuggestedTests && fullAnalysis.suggestedTests.length > 0) {
          content += > 0) {
          content += `🧪 Suggested Tests:\n `🧪 Suggested Tests:\n`;
          fullAnalysis.suggestedTests.forEach`;
          fullAnalysis.suggestedTests.forEach((test) => {
            content((test) => {
            content += `  • ${safeString(test += `  • ${safeString(test.name)}\n`;
            content += `.name)}\n`;
            content += `    Input: ${safeString(test.input)}\n`;
               Input: ${safeString(test.input)}\n`;
            content += `    Expected: ${safe content += `    Expected: ${safeString(test.expectedOutput)}\nString(test.expectedOutput)}\n`;
            content += `    Type: ${`;
            content += `    Type: ${safeString(test.type)}\n`;
         safeString(test.type)}\n`;
          });
          content += `\n`;
        }
        });
          content += `\n`;
 if (fullAnalysis.scorecard) {
                 }
        if (fullAnalysis.scorecard) {
          content += `📊 Scorecard:\n`;
          const content += `📊 Scorecard:\n`;
          const scores = fullAnalysis.scorecard;
          scores = fullAnalysis.scorecard;
          content += `  Correctness: ${safeString(scores.correctness)} content += `  Correctness: ${safeString(scores.correctness)}/10\n`;
          content += `  Read/10\n`;
          content += `  Readability: ${safeString(scores.readability)}ability: ${safeString(scores.readability)}/10\n`;
          content += `/10\n`;
          content += `  Performance: ${safeString(scores  Performance: ${safeString(scores.performance)}/10\n`;
          content.performance)}/10\n`;
          content += `  Maintainability: ${safeString(scores += `  Maintainability: ${safeString(s.maintainability)}/10\ncores.maintainability)}/10\n`;
          content += `  Production Readiness`;
          content += `  Production Readiness: ${safeString(scores.productionReadiness)}/: ${safeString(scores.productionReadiness)}/10\n`;
          if (scores.security !== undefined) content += ` 10\n`;
          if (scores.security !== undefined) content += `  Security: ${safeString(scores.security)} Security: ${safeString(scores.security)}//10\n`;
          if (scores.overall) content += `  Overall:10\n`;
          if (scores.overall) content += `  Overall: ${safeString(scores.overall ${safeString(scores.overall)}/10\n`;
          content += `\n`;
        }
        if (fullAnalysis.f)}/10\n`;
          content += `\n`;
        }
        if (fullAnalysis.finalVerdict) {
          content += `🏁inalVerdict) {
          content += `🏁 Final Verdict:\n`;
          content += `  Summary: Final Verdict:\n`;
          content += `  Summary: ${safeString ${safeString(fullAnalysis.finalVerdict(fullAnalysis.finalVerdict.summary)}\n`;
          content += `  Approved:.summary)}\n`;
          content += `  Approved: ${fullAnalysis.finalVerdict.approved ? '✅ Yes' ${fullAnalysis.finalVerdict.approved ? '✅ Yes' : '❌ No'}\n : '❌ No'}\n`;
`;
          if (fullAnalysis.finalVerdict.nextSteps)          if (fullAnalysis.finalVerdict.nextSteps) {
            content += ` {
            content += `  Next Steps:  Next Steps: ${safeString(fullAnalysis.finalVerdict.next ${safeString(fullAnalysis.finalVerdict.nextSteps)}\n`;
          }
        }

       Steps)}\n`;
          }
        }

        const blob = new Blob const blob = new Blob([content], { type: 'text/plain;charset([content], { type: 'text/plain;charset=utf-8' });
        const url=utf-8' });
        const url = URL.create = URL.createObjectURL(blob);
        const a = document.createElement('a');
        aObjectURL(blob);
        const a.href = url;
        a.download = `code-analysis-${s = document.createElement('a');
        a.href = url;
        a.download =nippet?.slug || Date.now()}.txt`;
        document.body.appendChild(a);
        a.click `code-analysis-${snippet?.slug || Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
       .body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('✅ showToast('✅ Analysis downloaded!');
      } catch (error) {
        if (process.env Analysis downloaded!');
      } catch (error) {
        if (process.env.NODE_ENV.NODE_ENV === 'development') {
          console.error('Download error:', error);
        === 'development') {
          console.error('Download error:', error);
        }
 }
        showToast('❌ Failed to download');
      }
    }, [full        showToast('❌ Failed to download');
      }
    }, [fullAnalysis, isAdvancedAnalysis, isAdvanced, snippet]);

    const publicUrl = `${appUrl}/snippet/${s, snippet]);

    const publicUrl = `${appUrl}/snippet/${snippet?.slugnippet?.slug || ''}`;

    // ===== cardPageUrl || ''}`;

    // ===== cardPageUrl calculation =====
    const cardPageUrl = snippet?.slug ? `${app calculation =====
    const cardPageUrl = snippet?.slug ? `${appUrl}/snippet/${snippet.slug}/card?theme=${selectedTheme}` : '';

    const quickAnalysisText = !isAdvanced && fullUrl}/snippet/${snippet.slug}/card?theme=${selectedTheme}` : '';

    const quickAnalysisText = !isAdvanced && fullAnalysis?.analysis ?Analysis?.analysis ? fullAnalysis.analysis : null;

    if (loading) {
      return <LoadingState />;
    }

    if fullAnalysis.analysis : null;

    if (loading) {
      return <LoadingState />;
    }

    if (!snippet) (!snippet) {
      return {
      return <EmptyState />;
    }

    return (
      <div className="flex flex <EmptyState />;
    }

    return (
      <div className="flex flex-col h-full bg-col h-full bg-white rounded-xl border-white rounded-xl border-2 border-[#d0d0d8] overflow-hidden relative shadow-2 border-[#d0d0d8] overflow-hidden relative shadow-sm">
        {toastMessage && (
          <div-sm">
        {toastMessage && (
          <div className="absolute top className="absolute top-4 left-1/2 transform -translate-x--4 left-1/2 transform -translate-x-1/2 bg-[#1a1a2e1/2 bg-[#1a1a2e] text-white px] text-white px-6 py-3 rounded-lg shadow-lg z-50-6 py-3 rounded-lg shadow-lg z-50 text-sm transition-all duration-300 text-sm transition-all duration-300">
            {toast">
            {toastMessage}
          </Message}
          </div>
        )}

        <div className="absolute left-[-9999div>
        )}

        <div className="absolute left-[-9999px]px] top-[-9999px]">
          <CardPreview
            top-[-9999px]">
          <CardPreview
            ref={cardRef ref={cardRef}
            title={snippet?.card_title || 'Code Analysis'}
            summary}
            title={snippet?.card_title || 'Code Analysis'}
            summary={snippet?.key_concept || 'Analysis of the={snippet?.key_concept || provided code snippet.'}
            username={ 'Analysis of the provided code snippet.'}
            username={displayUsername || 'Developer'}
           displayUsername || 'Developer'}
            slug={snippet?.slug || ''}
            language={s slug={snippet?.slug || ''}
            language={snippet?.language || 'nippet?.language || 'javascript'}
           javascript'}
            theme={selectedTheme}
            showCode={true}
            codeSnippet={ theme={selectedTheme}
            showCode={true}
            codeSnippet={snippet?.raw_code || ''}
            createdAt={ssnippet?.raw_code || ''}
            createdAt={snippet?.created_at}
            githubUsernamenippet?.created_at}
            githubUsername={displayGithub={displayGithubUsername || undefined}
          />
        </div>

       Username || undefined}
          />
        </div>

        <OutputPanel <OutputPanelHeader
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        <div className="flex-1 pHeader
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

       -4 md:p-6 overflow-y-auto <div className="flex-1 p-4 md:p-6 overflow-y-auto max-h-[calc(100vh-200px)] text-[#1 max-h-[calc(100vh-200px)] text-[#1a1a2ea1a2e]">
          {]">
          {activeTab === 'explanation' && (
            <ExplanationTab
              snippetactiveTab === 'explanation' && (
            <ExplanationTab
              snippet={snippet={snippet}
              isAdvanced={}
              isAdvanced={isAdvanced}
             isAdvanced}
              quickAnalysisText={quickAnalysisText}
              analysisText={snippet.what_this_code_does || '' quickAnalysisText={quickAnalysisText}
              analysisText={snippet.what_this_code_does || ''}
              debug}
              debugAnalysis={snippet.debug_analysis || ''}
              optimization={snippet.Analysis={snippet.debug_analysis || ''}
              optimization={snippet.optimizationoptimization || ''}
              key || ''}
              keyConcept={snippetConcept={snippet.key_concept || ''}
              cardTitle={snippet.card_title || ''.key_concept || ''}
              cardTitle={snippet.card_title || ''}
            />
          )}

          {activeTab === 'linkedin' &&}
            />
          )}

          {activeTab === 'linkedin' && (
            <LinkedInTab
              linkedinPost={ (
            <LinkedInTab
              linkedinPost={snippet.linkedsnippet.linkedin_post || ''}
              shareUrl={publicUrlin_post || ''}
              shareUrl={publicUrl}
              showToast={showToast}
            />
          )}

          {activeTab}
              showToast={showToast}
            />
          )}

          {activeTab === 'preview === 'preview' && (
            <PreviewTab
              snippet={s' && (
            <PreviewTab
              snippet={snippet}
              selectedTheme={selectedTheme}
              setSelectedTheme={setSelectedTheme}
              cardImageDataUrl={cardImageDataUrlnippet}
              selectedTheme={selectedTheme}
              setSelectedTheme={setSelectedTheme}
              cardImageDataUrl={}
              isGeneratingCard={iscardImageDataUrl}
              isGeneratingCard={isGeneratingCardGeneratingCard}
              showUsernameInput={showUsernameInput}
              setShowUsernameInput={setShowUsernameInput}
              tempUsername={}
              showUsernameInput={showUsernameInput}
              setShowUsernameInput={setShowUsernameInputtempUsername}
              setTempUsername={}
              tempUsername={tempUsername}
              setTempUsername={setTempUsername}
              tempsetTempUsername}
              tempGithubUsername={tempGithubUsername}
              setTempGithubGithubUsername={tempGithubUsername}
              setTempGithubUsername={setTempUsername={setTempGithubUsername}
              isUpdating={isUpdatingGithubUsername}
              isUpdating={isUpdating}
              updateCard}
              updateCardImage={updateCardImage}
              showToast={showToast}
              publicUrl={publicUrl}
              appUrlImage={updateCardImage}
              showToast={showToast}
              publicUrl={publicUrl}
              appUrl={appUrl={appUrl}
              downloadCard={downloadCard}
              savedImageUrl={savedImage}
              downloadCard={downloadCard}
              savedImageUrl={savedImageUrl}
             Url}
              isUploading={isUploading}
              hasUploaded={hasUpload isUploading={isUploading}
              hasUploaded={hasUploaded}
              onUploadImage={handleUploadImageed}
              onUploadImage={handleUploadImage}
              cardPageUrl={cardPageUrl}
              avatarUrl={avatarUrl}
              isUpload}
              cardPageUrl={cardPageUrl}
              avatarUrl={avatarUrl}
              isUploadingAvatar={isUploadingAvataringAvatar={isUploadingAvatar}
              onUploadAvatar={handleUploadAvatar}
            />
         }
              onUploadAvatar={handleUploadAvatar}
            />
          )}

          {activeTab === 'analysis' && (
            <AnalysisTab )}

          {activeTab === 'analysis' && (
            <AnalysisTab
              fullAnalysis={fullAnalysis}
              isAdvanced={isAdvanced}
              quickAnalysis
              fullAnalysis={fullAnalysis}
              isAdvanced={isAdvanced}
              quickAnalysisText={Text={quickAnalysisText}
              snippet={snippet}
              onCopyFullAnalysisquickAnalysisText}
              snippet={snippet}
              onCopyFullAnalysis={copyFullAnalysis={copyFullAnalysisNew}
              onDownloadFullAnalysis={downloadAnalysisNew}
            />
          )New}
              onDownloadFullAnalysis={downloadAnalysisNew}
            />
          )}

          {activeTab === 'line-by-line' &&}

          {activeTab === 'line-by-line' && (
            <LineByLineTab
              snippet={snippet}
              line (
            <LineByLineTab
              snippet={snippet}
              lineExplanations={lineExplanations}
              isExplaining={isExplExplanations={lineExplanations}
              isExplaining={isExplaining}
aining}
              hoveredLine={hoveredLine}
              onLineHover              hoveredLine={hoveredLine}
              onLineHover={onLineH={onLineHover}
              showToast={showToast}
              appUrl={appUrlover}
              showToast={showToast}
              appUrl={appUrl}
            />
          )}

          {activeTab === 'prompt' &&}
            />
          )}

          {activeTab === 'prompt' && (
            <Prompt (
            <PromptTab
              snippet={snippet}
              generatedPrompt={generTab
              snippet={snippet}
              generatedPrompt={generatedPrompt}
             atedPrompt}
              isGeneratingPrompt={isGener isGeneratingPrompt={isGeneratingPrompt}
              showToast={showToast}
              appUrl={appUrl}
            />
          )}

atingPrompt}
              showToast={showToast}
              appUrl={appUrl}
            />
          )}

          {activeTab === 'all-outputs' && (
                     {activeTab === 'all-outputs' && (
            <AllOutputsTab <AllOutputsTab
              snippet={snippet}
              showToast={showToast
              snippet={snippet}
              showToast={showToast}
              appUrl={appUrl}
            />
          )}
        </div>
}
              appUrl={appUrl}
            />
          )}
        </div>
      </div      </div>
    );
  }
);

OutputPanel.display>
    );
  }
);

OutputPanel.displayName = 'OutputPanel';

export default OutputPanel;
Name = 'OutputPanel';

export default OutputPanel;