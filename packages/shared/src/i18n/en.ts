import type { TranslationDictionary } from './types.js';

export const en: TranslationDictionary = {
  sections: {
    quantitative: 'Quantitative Aptitude',
    logical: 'Logical Reasoning',
    verbal: 'Verbal Ability',
    dataInterpretation: 'Data Interpretation',
  },
  difficulties: {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
  },
  status: {
    ready: 'Ready',
    gap: 'Needs Improvement',
    inProgress: 'In Progress',
    completed: 'Completed',
    active: 'Active',
    broken: 'Ended',
  },
  commitments: {
    streakActive: 'Day {daysDone} of {target} done.',
    restDayUsed: 'Your rest day has been used.',
    streakComplete: 'Commitment complete. You can set a new one whenever you like.',
    streakEnded: 'This commitment has ended. You can start a new one whenever you like.',
    minutesActive: '{minutesDone} of {target} minutes done.',
  },
  actions: {
    start: 'Start',
    submit: 'Submit',
    continue: 'Continue',
    finish: 'Finish Session',
    review: 'Review Mistakes',
    diagnostics: 'Take Diagnostic',
    reassessment: 'Take Reassessment',
  },
  feedback: {
    correct: 'Correct!',
    incorrect: 'Incorrect',
    expectedTime: 'Expected Time',
    yourTime: 'Your Time',
    accuracy: 'Accuracy',
    score: 'Score',
  },
  tiers: {
    free: 'Free Tier',
    sprintPass: 'Sprint Pass',
    seasonPass: 'Season Pass',
  },
};
