'use client';
import { forwardRef, useImperativeHandle, useState, useEffect, useRef, useCallback } from 'react';
import { Snippet, GenerateResponse } from '@/types';
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

export interface OutputPanelProps {
  snippet: Snippet | null;
  loading: boolean;
  fullAnalysis?: GenerateResponse | null;
  analysisMode?: 'simple' | 'medium' | 'advanced';
  onUsernameChange?: (name: string) => void;
  onGithubChange?: (name: string) => void;
  onSnippetUpdate?: (data: { username: string; github_username: string }) => void;
  lineExplanations?: any[];
  isExplaining?: boolean;
  onGenerateExplanation?: () => void;
  hoveredLine?: number | null;
  onLineHover?: (lineNumber: number | null) => void;
  generatedPrompt?: string;
  isGeneratingPrompt?: boolean;
  initialTab?: 'explanation' | 'linkedin' | 'preview' | 'analysis' | 'line-by-line' | 'prompt';
}

export type TabType = 'explanation' | 'linkedin' | 'preview' | 'analysis' | 'line-by-line' | 'prompt';

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

    // ===== تابع safeString برای تبدیل ایمن مقادیر =====
    const safeString = (value: any): string => {
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

    const updateSnippetInDatabase = useCallback(async (username: string, githubUsername: string) => {
      if (!snippet || !snippet.slug) return;

      setIsUpdating(true);
      try {
        const response = await fetch(`/api/update-snippet/${snippet.slug}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
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
      } catch (error: any) {
        console.error('Update error:', error);
        showToast(`❌ Failed to update: ${error.message}`);
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
        console.error('Error generating card image:', error);
        throw error;
      }
    }, []);

    const downloadCard = useCallback(async () => {
      if (isDownloading.current) {
        console.log('⏳ Download already in progress...');
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
        console.error('Download failed:', error);
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
        console.error('Card generation failed:', error);
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
        
        setIsGeneratingCard(true);
        generateCardImage()
          .then((dataUrl) => {
            setCardImageDataUrl(dataUrl);
          })
          .catch((error) => {
            console.error('Card generation failed:', error);
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

    // ===== توابع کپی و دانلود برای تب Analysis (حالت Advanced) =====
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
          if (fullAnalysis.performanceAnalysis.timeComplexity && fullAnalysis.performanceAnalysis.timeComplexity.length > 0) {
            content += `  Time Complexity:\n`;
            fullAnalysis.performanceAnalysis.timeComplexity.forEach((item) => {
              content += `    • ${safeString(item.target)}: ${safeString(item.complexity)} (${safeString(item.explanation)})\n`;
            });
          }
          if (fullAnalysis.performanceAnalysis.spaceComplexity && fullAnalysis.performanceAnalysis.spaceComplexity.length > 0) {
            content += `  Space Complexity:\n`;
            fullAnalysis.performanceAnalysis.spaceComplexity.forEach((item) => {
              content += `    • ${safeString(item.target)}: ${safeString(item.complexity)} (${safeString(item.explanation)})\n`;
            });
          }
          if (fullAnalysis.performanceAnalysis.scalabilityNotes && fullAnalysis.performanceAnalysis.scalabilityNotes.length > 0) {
            content += `  Scalability Notes:\n`;
            fullAnalysis.performanceAnalysis.scalabilityNotes.forEach((item) => {
              content += `    • ${safeString(item)}\n`;
            });
          }
          content += `\n`;
        }
        if (fullAnalysis.securityAnalysis) {
          content += `🔒 Security Analysis:\n`;
          content += `  Severity: ${safeString(fullAnalysis.securityAnalysis.severity)}\n`;
          if (fullAnalysis.securityAnalysis.issues && fullAnalysis.securityAnalysis.issues.length > 0) {
            content += `  Issues:\n`;
            fullAnalysis.securityAnalysis.issues.forEach((issue) => {
              content += `    • ${safeString(issue)}\n`;
            });
          }
          if (fullAnalysis.securityAnalysis.recommendations && fullAnalysis.securityAnalysis.recommendations.length > 0) {
            content += `  Recommendations:\n`;
            fullAnalysis.securityAnalysis.recommendations.forEach((rec) => {
              content += `    • ${safeString(rec)}\n`;
            });
          }
          content += `\n`;
        }
        if (fullAnalysis.productionReadiness) {
          content += `🛡️ Production Readiness:\n`;
          content += `  Ready: ${fullAnalysis.productionReadiness.isProductionReady ? 'Yes' : 'No'}\n`;
          if (fullAnalysis.productionReadiness.reasons && fullAnalysis.productionReadiness.reasons.length > 0) {
            fullAnalysis.productionReadiness.reasons.forEach((reason) => {
              content += `    • ${safeString(reason)}\n`;
            });
          }
          if (fullAnalysis.productionReadiness.requiredChanges && fullAnalysis.productionReadiness.requiredChanges.length > 0) {
            content += `  Required Changes:\n`;
            fullAnalysis.productionReadiness.requiredChanges.forEach((change) => {
              content += `    • ${safeString(change)}\n`;
            });
          }
          content += `\n`;
        }
        if (fullAnalysis.recommendedImprovements && fullAnalysis.recommendedImprovements.length > 0) {
          content += `🔧 Recommended Improvements:\n`;
          fullAnalysis.recommendedImprovements.forEach((item) => {
            content += `  [${safeString(item.priority)}] ${safeString(item.improvement)}\n`;
            content += `    Reason: ${safeString(item.reason)}\n`;
          });
          content += `\n`;
        }
        if (fullAnalysis.improvedCode && fullAnalysis.improvedCode.available) {
          content += `✨ Improved Code:\n`;
          content += `Notes: ${safeString(fullAnalysis.improvedCode.notes)}\n`;
          content += `${safeString(fullAnalysis.improvedCode.code)}\n\n`;
        }
        if (fullAnalysis.suggestedTests && fullAnalysis.suggestedTests.length > 0) {
          content += `🧪 Suggested Tests:\n`;
          fullAnalysis.suggestedTests.forEach((test) => {
            content += `  • ${safeString(test.name)}\n`;
            content += `    Input: ${safeString(test.input)}\n`;
            content += `    Expected: ${safeString(test.expectedOutput)}\n`;
            content += `    Type: ${safeString(test.type)}\n`;
          });
          content += `\n`;
        }
        if (fullAnalysis.scorecard) {
          content += `📊 Scorecard:\n`;
          const scores = fullAnalysis.scorecard;
          content += `  Correctness: ${safeString(scores.correctness)}/10\n`;
          content += `  Readability: ${safeString(scores.readability)}/10\n`;
          content += `  Performance: ${safeString(scores.performance)}/10\n`;
          content += `  Maintainability: ${safeString(scores.maintainability)}/10\n`;
          content += `  Production Readiness: ${safeString(scores.productionReadiness)}/10\n`;
          if (scores.security !== undefined) content += `  Security: ${safeString(scores.security)}/10\n`;
          if (scores.overall) content += `  Overall: ${safeString(scores.overall)}/10\n`;
          content += `\n`;
        }
        if (fullAnalysis.finalVerdict) {
          content += `🏁 Final Verdict:\n`;
          content += `  Summary: ${safeString(fullAnalysis.finalVerdict.summary)}\n`;
          content += `  Approved: ${fullAnalysis.finalVerdict.approved ? '✅ Yes' : '❌ No'}\n`;
          if (fullAnalysis.finalVerdict.nextSteps) {
            content += `  Next Steps: ${safeString(fullAnalysis.finalVerdict.nextSteps)}\n`;
          }
        }

        navigator.clipboard.writeText(content).then(() => {
          showToast('✅ Full analysis copied!');
        }).catch(() => {
          showToast('❌ Failed to copy');
        });
      } catch (error) {
        console.error('Copy error:', error);
        showToast('❌ Failed to copy analysis');
      }
    }, [fullAnalysis, isAdvanced]);

    const downloadAnalysisNew = useCallback(() => {
      if (!fullAnalysis || !isAdvanced) {
        showToast('❌ No analysis to download');
        return;
      }

      try {
        let content = `Zbloue - Code Analysis Report\n`;
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
          if (fullAnalysis.performanceAnalysis.timeComplexity && fullAnalysis.performanceAnalysis.timeComplexity.length > 0) {
            content += `  Time Complexity:\n`;
            fullAnalysis.performanceAnalysis.timeComplexity.forEach((item) => {
              content += `    • ${safeString(item.target)}: ${safeString(item.complexity)} (${safeString(item.explanation)})\n`;
            });
          }
          if (fullAnalysis.performanceAnalysis.spaceComplexity && fullAnalysis.performanceAnalysis.spaceComplexity.length > 0) {
            content += `  Space Complexity:\n`;
            fullAnalysis.performanceAnalysis.spaceComplexity.forEach((item) => {
              content += `    • ${safeString(item.target)}: ${safeString(item.complexity)} (${safeString(item.explanation)})\n`;
            });
          }
          if (fullAnalysis.performanceAnalysis.scalabilityNotes && fullAnalysis.performanceAnalysis.scalabilityNotes.length > 0) {
            content += `  Scalability Notes:\n`;
            fullAnalysis.performanceAnalysis.scalabilityNotes.forEach((item) => {
              content += `    • ${safeString(item)}\n`;
            });
          }
          content += `\n`;
        }
        if (fullAnalysis.securityAnalysis) {
          content += `🔒 Security Analysis:\n`;
          content += `  Severity: ${safeString(fullAnalysis.securityAnalysis.severity)}\n`;
          if (fullAnalysis.securityAnalysis.issues && fullAnalysis.securityAnalysis.issues.length > 0) {
            content += `  Issues:\n`;
            fullAnalysis.securityAnalysis.issues.forEach((issue) => {
              content += `    • ${safeString(issue)}\n`;
            });
          }
          if (fullAnalysis.securityAnalysis.recommendations && fullAnalysis.securityAnalysis.recommendations.length > 0) {
            content += `  Recommendations:\n`;
            fullAnalysis.securityAnalysis.recommendations.forEach((rec) => {
              content += `    • ${safeString(rec)}\n`;
            });
          }
          content += `\n`;
        }
        if (fullAnalysis.productionReadiness) {
          content += `🛡️ Production Readiness:\n`;
          content += `  Ready: ${fullAnalysis.productionReadiness.isProductionReady ? 'Yes' : 'No'}\n`;
          if (fullAnalysis.productionReadiness.reasons && fullAnalysis.productionReadiness.reasons.length > 0) {
            fullAnalysis.productionReadiness.reasons.forEach((reason) => {
              content += `    • ${safeString(reason)}\n`;
            });
          }
          if (fullAnalysis.productionReadiness.requiredChanges && fullAnalysis.productionReadiness.requiredChanges.length > 0) {
            content += `  Required Changes:\n`;
            fullAnalysis.productionReadiness.requiredChanges.forEach((change) => {
              content += `    • ${safeString(change)}\n`;
            });
          }
          content += `\n`;
        }
        if (fullAnalysis.recommendedImprovements && fullAnalysis.recommendedImprovements.length > 0) {
          content += `🔧 Recommended Improvements:\n`;
          fullAnalysis.recommendedImprovements.forEach((item) => {
            content += `  [${safeString(item.priority)}] ${safeString(item.improvement)}\n`;
            content += `    Reason: ${safeString(item.reason)}\n`;
          });
          content += `\n`;
        }
        if (fullAnalysis.improvedCode && fullAnalysis.improvedCode.available) {
          content += `✨ Improved Code:\n`;
          content += `Notes: ${safeString(fullAnalysis.improvedCode.notes)}\n`;
          content += `${safeString(fullAnalysis.improvedCode.code)}\n\n`;
        }
        if (fullAnalysis.suggestedTests && fullAnalysis.suggestedTests.length > 0) {
          content += `🧪 Suggested Tests:\n`;
          fullAnalysis.suggestedTests.forEach((test) => {
            content += `  • ${safeString(test.name)}\n`;
            content += `    Input: ${safeString(test.input)}\n`;
            content += `    Expected: ${safeString(test.expectedOutput)}\n`;
            content += `    Type: ${safeString(test.type)}\n`;
          });
          content += `\n`;
        }
        if (fullAnalysis.scorecard) {
          content += `📊 Scorecard:\n`;
          const scores = fullAnalysis.scorecard;
          content += `  Correctness: ${safeString(scores.correctness)}/10\n`;
          content += `  Readability: ${safeString(scores.readability)}/10\n`;
          content += `  Performance: ${safeString(scores.performance)}/10\n`;
          content += `  Maintainability: ${safeString(scores.maintainability)}/10\n`;
          content += `  Production Readiness: ${safeString(scores.productionReadiness)}/10\n`;
          if (scores.security !== undefined) content += `  Security: ${safeString(scores.security)}/10\n`;
          if (scores.overall) content += `  Overall: ${safeString(scores.overall)}/10\n`;
          content += `\n`;
        }
        if (fullAnalysis.finalVerdict) {
          content += `🏁 Final Verdict:\n`;
          content += `  Summary: ${safeString(fullAnalysis.finalVerdict.summary)}\n`;
          content += `  Approved: ${fullAnalysis.finalVerdict.approved ? '✅ Yes' : '❌ No'}\n`;
          if (fullAnalysis.finalVerdict.nextSteps) {
            content += `  Next Steps: ${safeString(fullAnalysis.finalVerdict.nextSteps)}\n`;
          }
        }

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `code-analysis-${snippet?.slug || Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('✅ Analysis downloaded!');
      } catch (error) {
        console.error('Download error:', error);
        showToast('❌ Failed to download');
      }
    }, [fullAnalysis, isAdvanced, snippet]);

    const publicUrl = `${appUrl}/snippet/${snippet?.slug || ''}`;
    const quickAnalysisText = !isAdvanced && fullAnalysis?.analysis ? fullAnalysis.analysis : null;

    if (loading) {
      return <LoadingState />;
    }

    if (!snippet) {
      return <EmptyState />;
    }

    return (
      <div className="flex flex-col h-full bg-white rounded-xl border-2 border-[#d0d0d8] overflow-hidden relative shadow-sm">
        {toastMessage && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-[#1a1a2e] text-white px-6 py-3 rounded-lg shadow-lg z-50 text-sm transition-all duration-300">
            {toastMessage}
          </div>
        )}

        {/* Hidden Card for image generation */}
        <div className="absolute left-[-9999px] top-[-9999px]">
          <CardPreview
            ref={cardRef}
            title={snippet?.card_title || 'Code Analysis'}
            summary={snippet?.key_concept || 'Analysis of the provided code snippet.'}
            username={displayUsername || 'Developer'}
            slug={snippet?.slug || ''}
            language={snippet?.language || 'javascript'}
            theme={selectedTheme}
            showCode={true}
            codeSnippet={snippet?.raw_code || ''}
            createdAt={snippet?.created_at}
            githubUsername={displayGithubUsername || undefined}
          />
        </div>

        <OutputPanelHeader 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          shareUrl={publicUrl}
          onCopyLink={() => {
            navigator.clipboard.writeText(publicUrl);
            showToast('✅ Link copied!');
          }}
        />

        <div className="flex-1 p-4 md:p-6 overflow-y-auto max-h-[calc(100vh-200px)] text-[#1a1a2e]">
          {/* Explanation Tab */}
          {activeTab === 'explanation' && (
            <ExplanationTab 
              snippet={snippet} 
              isAdvanced={isAdvanced} 
              quickAnalysisText={quickAnalysisText}
              analysisText={snippet.what_this_code_does || ''}
              debugAnalysis={snippet.debug_analysis || ''}
              optimization={snippet.optimization || ''}
              keyConcept={snippet.key_concept || ''}
              cardTitle={snippet.card_title || ''}
            />
          )}

          {/* LinkedIn Tab */}
          {activeTab === 'linkedin' && (
            <LinkedInTab 
              linkedinPost={snippet.linkedin_post || ''}
              shareUrl={publicUrl}
              showToast={showToast}
            />
          )}

          {/* Preview Tab */}
          {activeTab === 'preview' && (
            <PreviewTab
              snippet={snippet}
              selectedTheme={selectedTheme}
              setSelectedTheme={setSelectedTheme}
              cardImageDataUrl={cardImageDataUrl}
              isGeneratingCard={isGeneratingCard}
              showUsernameInput={showUsernameInput}
              setShowUsernameInput={setShowUsernameInput}
              tempUsername={tempUsername}
              setTempUsername={setTempUsername}
              tempGithubUsername={tempGithubUsername}
              setTempGithubUsername={setTempGithubUsername}
              isUpdating={isUpdating}
              updateCardImage={updateCardImage}
              showToast={showToast}
              publicUrl={publicUrl}
              appUrl={appUrl}
              downloadCard={downloadCard}
            />
          )}

          {/* Analysis Tab */}
          {activeTab === 'analysis' && (
            <AnalysisTab
              fullAnalysis={fullAnalysis}
              isAdvanced={isAdvanced}
              quickAnalysisText={quickAnalysisText}
              snippet={snippet}
              onCopyFullAnalysis={copyFullAnalysisNew}
              onDownloadFullAnalysis={downloadAnalysisNew}
            />
          )}

          {/* Line-by-Line Tab */}
          {activeTab === 'line-by-line' && (
            <LineByLineTab
              snippet={snippet}
              lineExplanations={lineExplanations}
              isExplaining={isExplaining}
              hoveredLine={hoveredLine}
              onLineHover={onLineHover}
              showToast={showToast}
              appUrl={appUrl}
            />
          )}

          {/* Prompt Tab */}
          {activeTab === 'prompt' && (
            <PromptTab
              snippet={snippet}
              generatedPrompt={generatedPrompt}
              isGeneratingPrompt={isGeneratingPrompt}
              showToast={showToast}
              appUrl={appUrl}
            />
          )}
        </div>
      </div>
    );
  }
);

OutputPanel.displayName = 'OutputPanel';

export default OutputPanel;