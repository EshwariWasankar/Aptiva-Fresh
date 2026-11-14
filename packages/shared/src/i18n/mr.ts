import type { TranslationDictionary } from './types.js';

export const mr: TranslationDictionary = {
  sections: {
    quantitative: 'संख्यात्मक अभियोग्यता',
    logical: 'तार्किक क्षमता',
    verbal: 'भाषिक क्षमता',
    dataInterpretation: 'माहितीचे विश्लेषण',
  },
  difficulties: {
    easy: 'सोपे',
    medium: 'मध्यम',
    hard: 'कठीण',
  },
  status: {
    ready: 'तयार',
    gap: 'सुधारणेची गरज',
    inProgress: 'प्रगतीपथावर',
    completed: 'पूर्ण',
    active: 'सक्रिय',
    broken: 'समाप्त',
  },
  commitments: {
    streakActive: '{target} पैकी {daysDone} दिवस पूर्ण झाले.',
    restDayUsed: 'तुमचा विश्रांतीचा दिवस वापरला गेला आहे.',
    streakComplete: 'संकल्प पूर्ण झाला. तुम्ही हवे तेव्हा नवीन संकल्प सुरू करू शकता.',
    streakEnded: 'हा संकल्प समाप्त झाला. तुम्ही हवे तेव्हा नवीन संकल्प सुरू करू शकता.',
    minutesActive: '{target} पैकी {minutesDone} मिनिटे पूर्ण.',
  },
  actions: {
    start: 'सुरू करा',
    submit: 'सादर करा',
    continue: 'पुढे चालू ठेवा',
    finish: 'सत्र पूर्ण करा',
    review: 'चुकांची उजळणी करा',
    diagnostics: 'निदानात्मक चाचणी घ्या',
    reassessment: 'पुनर्मूल्यांकन चाचणी घ्या',
  },
  feedback: {
    correct: 'बरोबर उत्तर!',
    incorrect: 'चूक उत्तर',
    expectedTime: 'अपेक्षित वेळ',
    yourTime: 'तुमचा वेळ',
    accuracy: 'अचूकता',
    score: 'गुण',
  },
  tiers: {
    free: 'मोफत श्रेणी',
    sprintPass: 'स्प्रिंट पास',
    seasonPass: 'सीझन पास',
  },
};
