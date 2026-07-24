// context/AppContext.tsx

'use client';

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import {
  type AnalysisMode,
  type LegacyGenerateResponse,
  type Snippet,
  type LineExplanation,
  type ModeOutput,
  type PromptInfo,
} from '@/types';

// ============================================================
// 1. State Type
// ============================================================

export interface AppState {
  code: string;
  language: string;
  mode: AnalysisMode;
  loading: boolean;
  isConverting: boolean;
  isExplaining: boolean;
  isGeneratingPrompt: boolean;
  errorMessage: string | null;
  convertError: string | null;
  explainError: string | null;
  promptError: string | null;
  outputs: {
    simple: ModeOutput;
    medium: ModeOutput;
    advanced: ModeOutput;
  };
  username: string;
  githubUsername: string;
  avatarUrl: string | null;
  convertLanguage: string;
  hoveredLine: number | null;
  toastMessage: string | null;
  promptInfo: PromptInfo | null;
}

// ============================================================
// 2. Initial State
// ============================================================

const initialState: AppState = {
  code: '',
  language: 'javascript',
  mode: 'simple',
  loading: false,
  isConverting: false,
  isExplaining: false,
  isGeneratingPrompt: false,
  errorMessage: null,
  convertError: null,
  explainError: null,
  promptError: null,
  outputs: {
    simple: {
      snippet: null,
      fullAnalysis: null,
      lineExplanations: [],
      generatedPrompt: '',
    },
    medium: {
      snippet: null,
      fullAnalysis: null,
      lineExplanations: [],
      generatedPrompt: '',
    },
    advanced: {
      snippet: null,
      fullAnalysis: null,
      lineExplanations: [],
      generatedPrompt: '',
    },
  },
  username: '',
  githubUsername: '',
  avatarUrl: null,
  convertLanguage: '',
  hoveredLine: null,
  toastMessage: null,
  promptInfo: null,
};

// ============================================================
// 3. Action Types
// ============================================================

type AppAction =
  | { type: 'SET_CODE'; payload: string }
  | { type: 'SET_LANGUAGE'; payload: string }
  | { type: 'SET_MODE'; payload: AnalysisMode }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CONVERTING'; payload: boolean }
  | { type: 'SET_EXPLAINING'; payload: boolean }
  | { type: 'SET_GENERATING_PROMPT'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CONVERT_ERROR'; payload: string | null }
  | { type: 'SET_EXPLAIN_ERROR'; payload: string | null }
  | { type: 'SET_PROMPT_ERROR'; payload: string | null }
  | { type: 'SET_OUTPUTS'; payload: { mode: AnalysisMode; snippet: Snippet | null; fullAnalysis: LegacyGenerateResponse | null; lineExplanations: LineExplanation[]; generatedPrompt: string } }
  | { type: 'SET_USERNAME'; payload: string }
  | { type: 'SET_GITHUB_USERNAME'; payload: string }
  | { type: 'SET_AVATAR'; payload: string | null }
  | { type: 'SET_CONVERT_LANGUAGE'; payload: string }
  | { type: 'SET_HOVERED_LINE'; payload: number | null }
  | { type: 'SET_TOAST'; payload: string | null }
  | { type: 'SET_PROMPT_INFO'; payload: PromptInfo | null }
  | { type: 'CLEAR_ALL' };

// ============================================================
// 4. Reducer
// ============================================================

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CODE':
      return { ...state, code: action.payload };

    case 'SET_LANGUAGE':
      return { ...state, language: action.payload };

    case 'SET_MODE':
      return { ...state, mode: action.payload };

    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_CONVERTING':
      return { ...state, isConverting: action.payload };

    case 'SET_EXPLAINING':
      return { ...state, isExplaining: action.payload };

    case 'SET_GENERATING_PROMPT':
      return { ...state, isGeneratingPrompt: action.payload };

    case 'SET_ERROR':
      return { ...state, errorMessage: action.payload };

    case 'SET_CONVERT_ERROR':
      return { ...state, convertError: action.payload };

    case 'SET_EXPLAIN_ERROR':
      return { ...state, explainError: action.payload };

    case 'SET_PROMPT_ERROR':
      return { ...state, promptError: action.payload };

    case 'SET_OUTPUTS': {
      const { mode, snippet, fullAnalysis, lineExplanations, generatedPrompt } = action.payload;
      return {
        ...state,
        outputs: {
          ...state.outputs,
          [mode]: {
            snippet,
            fullAnalysis,
            lineExplanations,
            generatedPrompt,
          },
        },
      };
    }

    case 'SET_USERNAME':
      return { ...state, username: action.payload };

    case 'SET_GITHUB_USERNAME':
      return { ...state, githubUsername: action.payload };

    case 'SET_AVATAR':
      return { ...state, avatarUrl: action.payload };

    case 'SET_CONVERT_LANGUAGE':
      return { ...state, convertLanguage: action.payload };

    case 'SET_HOVERED_LINE':
      return { ...state, hoveredLine: action.payload };

    case 'SET_TOAST':
      return { ...state, toastMessage: action.payload };

    case 'SET_PROMPT_INFO':
      return { ...state, promptInfo: action.payload };

    case 'CLEAR_ALL':
      return {
        ...initialState,
        username: state.username,
        githubUsername: state.githubUsername,
        avatarUrl: state.avatarUrl,
      };

    default:
      return state;
  }
}

// ============================================================
// 5. Context
// ============================================================

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}>({
  state: initialState,
  dispatch: () => null,
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}