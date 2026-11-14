export type Locale = 'en' | 'hi' | 'mr';

export interface TranslationDictionary {
  sections: {
    quantitative: string;
    logical: string;
    verbal: string;
    dataInterpretation: string;
  };
  difficulties: {
    easy: string;
    medium: string;
    hard: string;
  };
  status: {
    ready: string;
    gap: string;
    inProgress: string;
    completed: string;
    active: string;
    broken: string;
  };
  commitments: {
    streakActive: string;
    restDayUsed: string;
    streakComplete: string;
    streakEnded: string;
    minutesActive: string;
  };
  actions: {
    start: string;
    submit: string;
    continue: string;
    finish: string;
    review: string;
    diagnostics: string;
    reassessment: string;
  };
  feedback: {
    correct: string;
    incorrect: string;
    expectedTime: string;
    yourTime: string;
    accuracy: string;
    score: string;
  };
  tiers: {
    free: string;
    sprintPass: string;
    seasonPass: string;
  };
}
