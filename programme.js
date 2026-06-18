const EXERCISE_LIBRARY = [
  { name: 'Tractions', kind: 'strength', muscles: ['dos', 'biceps'], bodyweight: true, defaultLoad: 0, restSec: 120, defaultReps: '5' },
  { name: 'Tractions gilet 10 kg', kind: 'strength', muscles: ['dos', 'biceps'], bodyweight: true, defaultLoad: 10, restSec: 180, defaultReps: '3-4' },
  { name: 'Dips', kind: 'strength', muscles: ['pectoraux', 'triceps', 'epaules'], bodyweight: true, defaultLoad: 0, restSec: 120, defaultReps: '8-12' },
  { name: 'Dips gilet 10 kg', kind: 'strength', muscles: ['pectoraux', 'triceps', 'epaules'], bodyweight: true, defaultLoad: 10, restSec: 150, defaultReps: '4-6' },
  { name: 'Pompes', kind: 'strength', muscles: ['pectoraux', 'triceps', 'gainage'], bodyweight: true, defaultLoad: 0, restSec: 90, defaultReps: '20' },
  { name: 'Pompes gilet 10 kg', kind: 'strength', muscles: ['pectoraux', 'triceps', 'gainage'], bodyweight: true, defaultLoad: 10, restSec: 90, defaultReps: '10' },
  { name: 'Rowing kettlebell 24 kg', kind: 'strength', muscles: ['dos', 'biceps'], bodyweight: false, defaultLoad: 24, restSec: 75, defaultReps: '10-12/côté' },
  { name: 'Rowing kettlebell 16 kg', kind: 'strength', muscles: ['dos', 'biceps'], bodyweight: false, defaultLoad: 16, restSec: 75, defaultReps: '15-25/côté' },
  { name: 'Goblet squat 24 kg', kind: 'strength', muscles: ['jambes', 'fessiers', 'gainage'], bodyweight: false, defaultLoad: 24, restSec: 90, defaultReps: '8-12' },
  { name: 'Swing 24 kg', kind: 'strength', muscles: ['ischios', 'fessiers', 'dos'], bodyweight: false, defaultLoad: 24, restSec: 75, defaultReps: '15' },
  { name: 'Swing 16 kg', kind: 'strength', muscles: ['ischios', 'fessiers', 'dos'], bodyweight: false, defaultLoad: 16, restSec: 60, defaultReps: '20' },
  { name: 'RDL une jambe 16 kg', kind: 'strength', muscles: ['ischios', 'fessiers'], bodyweight: false, defaultLoad: 16, restSec: 75, defaultReps: '10/jambe' },
  { name: 'RDL 24 kg', kind: 'strength', muscles: ['ischios', 'fessiers', 'dos'], bodyweight: false, defaultLoad: 24, restSec: 75, defaultReps: '12' },
  { name: 'Fentes arrière gilet 10 kg', kind: 'strength', muscles: ['jambes', 'fessiers'], bodyweight: true, defaultLoad: 10, restSec: 75, defaultReps: '10/jambe' },
  { name: 'Step-up gilet 10 kg', kind: 'strength', muscles: ['jambes', 'fessiers'], bodyweight: true, defaultLoad: 10, restSec: 75, defaultReps: '10/jambe' },
  { name: 'Presse épaules kettlebell 16 kg', kind: 'strength', muscles: ['epaules', 'triceps'], bodyweight: false, defaultLoad: 16, restSec: 90, defaultReps: '10-15' },
  { name: 'Halo kettlebell 8 kg', kind: 'mobility', muscles: ['epaules', 'haut du dos'], bodyweight: false, defaultLoad: 8, restSec: 30, defaultReps: '10/sens' },
  { name: 'Y-T-W au sol', kind: 'mobility', muscles: ['haut du dos', 'epaules'], bodyweight: false, defaultLoad: 0, restSec: 30, defaultReps: '8' },
  { name: 'Scapular push-ups', kind: 'mobility', muscles: ['haut du dos', 'gainage'], bodyweight: true, defaultLoad: 0, restSec: 30, defaultReps: '15' },
  { name: 'Reverse snow angels', kind: 'mobility', muscles: ['haut du dos'], bodyweight: false, defaultLoad: 0, restSec: 30, defaultReps: '10' },
  { name: 'Dead hang actif', kind: 'mobility', muscles: ['dos', 'epaules'], bodyweight: true, defaultLoad: 0, restSec: 45, defaultReps: '30 s' },
  { name: 'Planche', kind: 'strength', muscles: ['gainage'], bodyweight: true, defaultLoad: 0, restSec: 45, defaultReps: '1 min' },
  { name: 'Planche latérale', kind: 'strength', muscles: ['gainage'], bodyweight: true, defaultLoad: 0, restSec: 45, defaultReps: '45 s/côté' },
  { name: 'Course libre', kind: 'run', muscles: ['cardio', 'jambes'], bodyweight: false, defaultLoad: 0, restSec: 0, defaultReps: 'distance + temps' },
  { name: 'Vélo libre', kind: 'bike', muscles: ['cardio', 'jambes'], bodyweight: false, defaultLoad: 0, restSec: 0, defaultReps: 'distance + temps' }
];

function ex(name, sets, reps, target, restSec, kind = 'strength') {
  const found = EXERCISE_LIBRARY.find(e => e.name === name) || {};
  return { name, sets, reps, target, restSec, kind: found.kind || kind, muscles: found.muscles || [], bodyweight: !!found.bodyweight, defaultLoad: found.defaultLoad || 0 };
}

const PROGRAMME = {
  A: {
    label: 'Semaine A - 10 km + volume musculaire',
    days: {
      1: { name: 'Lundi', title: 'Haut du corps volume + dos', objective: 'Tractions, dips, pompes et renforcement entre les omoplates.', exercises: [
        ex('Halo kettlebell 8 kg', 2, '10/sens', 'Échauffement épaules', 30, 'mobility'), ex('Tractions', 6, '5', 'Volume propre, 1-2 reps en réserve', 120), ex('Rowing kettlebell 24 kg', 5, '12/côté', 'Pause 1 s en haut', 75), ex('Y-T-W au sol', 3, '8 de chaque', 'Contrôle total', 45, 'mobility'), ex('Dips', 4, '8-10', 'Sans échec', 120), ex('Pompes', 4, '20', 'Gainage fort', 90), ex('Planche', 3, '1 min', 'Gainage', 45)
      ]},
      2: { name: 'Mardi', title: 'Course intervalles', objective: "Rendre l'allure 4:00/km plus naturelle.", exercises: [
        ex('Course libre', 1, '15 min', 'Échauffement footing facile + 4 accélérations', 0, 'run'), ex('Course libre', 8, '400 m', 'Intervalles 3:50-4:00/km selon cycle', 75, 'run'), ex('Course libre', 1, '10 min', 'Retour au calme facile', 0, 'run'), ex('Dead hang actif', 2, '30 s', 'Mini dos', 30, 'mobility'), ex('Y-T-W au sol', 2, '8', 'Activation omoplates', 30, 'mobility')
      ]},
      3: { name: 'Mercredi', title: 'Footing facile + jambes kettlebell', objective: 'Footing facile habituel puis force jambes sans ruiner la récupération.', exercises: [
        ex('Course libre', 1, '40-55 min', 'Footing facile, conversation possible', 0, 'run'), ex('Course libre', 6, '100 m', 'Lignes droites relâchées', 60, 'run'), ex('Goblet squat 24 kg', 4, '8-12', 'Amplitude propre', 90), ex('Swing 24 kg', 5, '15', 'Explosif', 75), ex('RDL une jambe 16 kg', 3, '10/jambe', 'Contrôle bassin', 75), ex('Fentes arrière gilet 10 kg', 3, '10/jambe', 'Stabilité genou', 75), ex('Mollets debout', 4, '20', 'Prévention course', 45, 'strength')
      ]},
      4: { name: 'Jeudi', title: 'Pompes/dips + haut du dos', objective: 'Volume haut du corps, endurance musculaire et posture vélo.', exercises: [
        ex('Pompes', 10, '10-15', 'EMOM 10 min', 60), ex('Dips', 5, '8-12', 'Volume, sans échec', 90), ex('Rowing kettlebell 16 kg', 3, '20/côté', 'Endurance haut du dos', 60), ex('Reverse snow angels', 3, '10', 'Haut du dos', 30, 'mobility'), ex('Scapular push-ups', 2, '15', 'Dentelé antérieur', 30, 'mobility'), ex('Planche latérale', 3, '45 s/côté', 'Gainage', 45)
      ]},
      5: { name: 'Vendredi', title: 'Vélo sweet spot / VO2', objective: 'Puissance durable, relances, capacité à tenir haut.', exercises: [
        ex('Vélo libre', 1, '15 min', 'Échauffement progressif', 0, 'bike'), ex('Vélo libre', 3, '8-20 min', 'Sweet spot ou VO2 selon cycle', 240, 'bike'), ex('Vélo libre', 1, '10 min', 'Retour au calme facile', 0, 'bike'), ex('Halo kettlebell 8 kg', 2, '10/sens', 'Avant/après vélo', 30, 'mobility'), ex('Y-T-W au sol', 2, '8', 'Posture omoplates', 30, 'mobility')
      ]},
      6: { name: 'Samedi', title: 'Sortie longue course', objective: 'Construire endurance spécifique 10 km.', exercises: [
        ex('Course libre', 1, '9-15 km', 'Sortie longue facile selon phase', 0, 'run'), ex('Course libre', 1, '3-5 km', 'Bloc tempo optionnel 4:25 puis 4:15/km', 0, 'run'), ex('Halo kettlebell 8 kg', 1, '8 min', 'Mobilité retour', 0, 'mobility')
      ]},
      0: { name: 'Dimanche', title: 'Repos', objective: 'Repos complet si la sortie a été faite samedi.', exercises: [ex('Y-T-W au sol', 1, '8 min', 'Routine douce optionnelle', 0, 'mobility')]}
    }
  },
  B: {
    label: 'Semaine B - vélo + intensité/posture',
    days: {
      1: { name: 'Lundi', title: 'Haut du corps intensité + scapulas', objective: 'Force tractions/dips sans trop de volume, posture vélo.', exercises: [
        ex('Halo kettlebell 8 kg', 2, '10/sens', 'Échauffement scapulas', 30, 'mobility'), ex('Tractions gilet 10 kg', 5, '3-4', 'Force, reps propres', 180), ex('Tractions', 3, '5-6', 'Technique', 120), ex('Dips gilet 10 kg', 5, '4-6', 'Stop si inconfort', 150), ex('Pompes gilet 10 kg', 5, '10', 'Solide', 90), ex('Rowing kettlebell 24 kg', 4, '10/côté', 'Lourd propre', 75), ex('Y-T-W au sol', 3, '8', 'Contrôle scapulas', 30)
      ]},
      2: { name: 'Mardi', title: 'Course seuil / tempo', objective: 'Tenir vite longtemps, essentiel pour le 10 km.', exercises: [
        ex('Course libre', 1, '15 min', 'Échauffement + accélérations', 0, 'run'), ex('Course libre', 3, '8-15 min', 'Seuil 4:10-4:20/km selon cycle', 180, 'run'), ex('Course libre', 1, '10 min', 'Retour au calme facile', 0, 'run')
      ]},
      3: { name: 'Mercredi', title: 'Footing facile + routine dos', objective: 'Footing facile habituel, récupération active et protection omoplates.', exercises: [
        ex('Course libre', 1, '40-55 min', 'Footing facile, terrain souple si possible', 0, 'run'), ex('Course libre', 4, '20 s', 'Accélérations relâchées optionnelles', 60, 'run'), ex('Scapular push-ups', 3, '15', 'Activation haut du dos', 30, 'mobility'), ex('Y-T-W au sol', 3, '8', 'Trapèzes moyens/inférieurs', 30, 'mobility'), ex('Dead hang actif', 3, '30 s', 'Stabilité épaule', 45, 'mobility')
      ]},
      4: { name: 'Jeudi', title: 'Tractions faciles + pompes endurance', objective: 'Endurance musculaire sans fatigue excessive.', exercises: [
        ex('Tractions', 8, '4', 'Aucune série dure', 75), ex('Pompes', 3, '70% max', 'Endurance', 120), ex('Rowing kettlebell 16 kg', 3, '20/côté', 'Haut du dos', 60), ex('Reverse snow angels', 3, '10', 'Posture', 30, 'mobility'), ex('Planche', 3, '1 min', 'Gainage', 45)
      ]},
      5: { name: 'Vendredi', title: 'Vélo force basse cadence / tempo', objective: 'Grimpe, puissance sur le plat, pédalage fort.', exercises: [
        ex('Vélo libre', 1, '15 min', 'Échauffement progressif', 0, 'bike'), ex('Vélo libre', 6, '5 min', 'Force basse cadence 55-65 rpm', 180, 'bike'), ex('Vélo libre', 1, '10 min', 'Retour au calme', 0, 'bike'), ex('Goblet squat 24 kg', 4, '8', 'Option si jambes fraîches', 90), ex('Swing 16 kg', 6, '20', 'Explosif', 60), ex('Planche latérale', 3, '45 s/côté', 'Gainage', 45)
      ]},
      6: { name: 'Samedi', title: 'Sortie vélo longue / Longchamp', objective: 'Tenir vite longtemps, objectif 2 h proche de 35 km/h.', exercises: [
        ex('Vélo libre', 1, '1h30-2h30', 'Sortie longue endurance', 0, 'bike'), ex('Vélo libre', 3, '10-25 min', 'Blocs rapides Longchamp', 300, 'bike'), ex('Halo kettlebell 8 kg', 1, '8 min', 'Mobilité retour', 0, 'mobility')
      ]},
      0: { name: 'Dimanche', title: 'Repos', objective: 'Repos complet si sortie vélo faite samedi.', exercises: [ex('Y-T-W au sol', 1, '8 min', 'Routine douce optionnelle', 0, 'mobility')]}
    }
  }
};

const DAILY_ROUTINE = [
  { name: 'Cat-cow', target: 'Mobilité colonne', sets: 1, reps: '10 reps', restSec: 15, kind: 'mobility' },
  { name: 'Thread the needle', target: 'Rotation thoracique', sets: 2, reps: '8/côté', restSec: 30, kind: 'mobility' },
  { name: 'Scapular push-ups', target: 'Dentelé antérieur', sets: 2, reps: '15', restSec: 30, kind: 'mobility' },
  { name: 'Y-T-W au sol', target: 'Trapèzes moyens/inférieurs', sets: 2, reps: '6 de chaque', restSec: 30, kind: 'mobility' },
  { name: 'Halo kettlebell 8 kg', target: 'Contrôle épaule', sets: 2, reps: '10/sens', restSec: 30, kind: 'mobility' },
  { name: 'Dead hang actif', target: 'Stabilité scapulaire', sets: 2, reps: '30 s', restSec: 45, kind: 'mobility' },
  { name: 'Respiration allongée', target: 'Relâcher trapèzes', sets: 1, reps: '2 min', restSec: 0, kind: 'mobility' }
];

const TESTS = [
  { key: 'run10k', label: '10 km', unit: 'min', goal: '40:00' },
  { key: 'pullups', label: 'Tractions max', unit: 'reps', goal: '4 x 10 facile' },
  { key: 'pushups', label: 'Pompes max', unit: 'reps', goal: '60' },
  { key: 'dips', label: 'Dips max', unit: 'reps', goal: '20' },
  { key: 'bike2h', label: 'Vélo 2 h', unit: 'km/h', goal: '> 35 km/h' },
  { key: 'backPain', label: 'Douleur omoplates', unit: '/10', goal: '≤ 2' }
];
