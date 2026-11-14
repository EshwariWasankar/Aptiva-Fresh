import type { TranslationDictionary } from './types.js';

export const hi: TranslationDictionary = {
  sections: {
    quantitative: 'संख्यात्मक अभियोग्यता',
    logical: 'तार्किक क्षमता',
    verbal: 'मौखिक क्षमता',
    dataInterpretation: 'डेटा व्याख्या',
  },
  difficulties: {
    easy: 'सरल',
    medium: 'मध्यम',
    hard: 'कठिन',
  },
  status: {
    ready: 'तैयार',
    gap: 'सुधार की आवश्यकता',
    inProgress: 'प्रगति में',
    completed: 'पूर्ण',
    active: 'सक्रिय',
    broken: 'समाप्त',
  },
  commitments: {
    streakActive: '{target} में से {daysDone} दिन पूरे।',
    restDayUsed: 'आपका विश्राम दिवस उपयोग किया गया है।',
    streakComplete: 'संकल्प पूरा हुआ। आप जब चाहें नया संकल्प शुरू कर सकते हैं।',
    streakEnded: 'यह संकल्प समाप्त हो गया है। आप जब चाहें नया संकल्प शुरू कर सकते हैं।',
    minutesActive: '{target} में से {minutesDone} मिनट पूरे।',
  },
  actions: {
    start: 'आरंभ करें',
    submit: 'जमा करें',
    continue: 'जारी रखें',
    finish: 'सत्र समाप्त करें',
    review: 'गलतियों की समीक्षा करें',
    diagnostics: 'निदानात्मक परीक्षा दें',
    reassessment: 'पुनर्मूल्यांकन दें',
  },
  feedback: {
    correct: 'सही उत्तर!',
    incorrect: 'गलत उत्तर',
    expectedTime: 'अनुमानित समय',
    yourTime: 'आपका समय',
    accuracy: 'सटीकता',
    score: 'अंक',
  },
  tiers: {
    free: 'निःशुल्क श्रेणी',
    sprintPass: 'स्प्रिंट पास',
    seasonPass: 'सीजन पास',
  },
};
