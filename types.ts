
export interface Question {
  id: number;
  statement: string;
  options: {
    label: string;
    text: string;
  }[];
  correctAnswer: string;
  explanation: string;
}

export interface Exam {
  title: string;
  category: string;
  questions: Question[];
  createdAt: string;
}

export interface MindMapNode {
  id: string;
  text: string;
  children?: MindMapNode[];
  description?: string;
}

export interface MindMap {
  title: string;
  root: MindMapNode;
  createdAt: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  GENERATING = 'GENERATING',
  SUCCESS_EXAM = 'SUCCESS_EXAM',
  SUCCESS_MINDMAP = 'SUCCESS_MINDMAP',
  ERROR = 'ERROR'
}

export type GenerationMode = 'EXAM' | 'MINDMAP';
