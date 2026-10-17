// Stammdaten: Vereine und Namen (alle Vereine sind frei erfunden)
var DATA = {
  // [Name, Kürzel, Farbe 1, Farbe 2, Ansehen]
  leagues: [
    {
      name: '1. Liga',
      clubs: [
        ['FC Rheinstadt 04', 'RHE', '#c8102e', '#ffffff', 86],
        ['Borussia Kohlenberg', 'BKO', '#f5d000', '#111111', 83],
        ['VfB Neckarburg', 'VFB', '#e30613', '#ffffff', 78],
        ['Eintracht Mainfurt', 'EIM', '#111111', '#e1000f', 77],
        ['Werder Weserau', 'WER', '#1d9053', '#ffffff', 75],
        ['SV Ruhrtal', 'RUH', '#004b9c', '#ffffff', 74],
        ['1. FC Domstadt', 'DOM', '#ed1c24', '#ffffff', 72],
        ['Hertha Spreeberg', 'SPR', '#005ca9', '#ffffff', 71],
        ['VfL Wolfsheide', 'WOL', '#65b32e', '#ffffff', 70],
        ['Union Elbflorenz', 'ELB', '#fdd300', '#000000', 69],
        ['Fortuna Altrhein', 'FOR', '#da291c', '#ffffff', 68],
        ['TSV Alpenstadt', 'ALP', '#6cace4', '#ffffff', 67],
        ['SC Schwarzwald', 'SCS', '#000000', '#e2001a', 66],
        ['Alemannia Kaiserbad', 'ALE', '#fde100', '#000000', 65],
        ['Kickers Offenau', 'KOF', '#ee1d23', '#ffffff', 64],
        ['Arminia Teutoburg', 'ARM', '#004e9e', '#ffffff', 63],
        ['Sportfreunde Siegtal', 'SIE', '#1e3a8a', '#fbbf24', 62],
        ['FC Hansestadt', 'HAN', '#003d7c', '#ffffff', 61]
      ]
    },
    {
      name: '2. Liga',
      clubs: [
        ['SpVgg Frankenhöhe', 'FRA', '#009b3a', '#ffffff', 60],
        ['Holstein Förde', 'HOL', '#004f9f', '#e30613', 59],
        ['Rot-Weiß Emscher', 'RWE', '#d6001c', '#ffffff', 58],
        ['Preußen Westfalia', 'PRE', '#00843d', '#000000', 57],
        ['FC Ostseestrand', 'OST', '#0069b4', '#ffffff', 56],
        ['Viktoria Taunus', 'VIK', '#7a1f3d', '#ffffff', 55],
        ['Dynamo Lausitz', 'DYN', '#f7d117', '#000000', 54],
        ['KSV Fuldatal', 'KSV', '#e2001a', '#ffffff', 54],
        ['Jahn Donautal', 'JAH', '#c00000', '#ffffff', 53],
        ['FV Kurpfalz', 'KUR', '#1d3f8f', '#ffffff', 52],
        ['TuS Vogelsberg', 'VOG', '#2e7d32', '#ffeb3b', 52],
        ['Germania Odenwald', 'ODE', '#212121', '#ffffff', 51],
        ['SC Bodensee', 'BOD', '#0097d8', '#ffffff', 50],
        ['Energie Spreewald', 'ENE', '#d8232a', '#ffffff', 50],
        ['1. FC Saarhügel', 'SAA', '#5b2c83', '#ffffff', 49],
        ['SV Wattenmeer', 'WAT', '#00a3e0', '#ffffff', 48],
        ['Blau-Weiß Havelland', 'BWH', '#003f87', '#ffffff', 47],
        ['FC Erzberg', 'ERZ', '#6b0f1a', '#ffffff', 46]
      ]
    }
  ],
  firstNames: [
    'Lukas', 'Jonas', 'Leon', 'Finn', 'Paul', 'Felix', 'Max', 'Tim', 'Jan', 'Niklas', 'Moritz', 'Tobias', 'Florian',
    'Sebastian', 'Marco', 'Kevin', 'Dennis', 'Daniel', 'Stefan', 'Thomas', 'Michael', 'Andreas', 'Christian', 'Mats',
    'Julian', 'Kai', 'Timo', 'Marcel', 'Benedikt', 'Manuel', 'Sven', 'Jens', 'Dirk', 'Olaf', 'Uwe', 'Rudi', 'Lothar',
    'Kalle', 'Toni', 'Jupp', 'Mehmet', 'Emre', 'Can', 'Luca', 'Mario', 'Ivan', 'Milan', 'Pavel', 'Jakub', 'Kacper',
    'Lars', 'Mikkel', 'Rasmus', 'Bastian', 'Philipp', 'Robin', 'Pascal', 'Yannick', 'Joel', 'Noah', 'Elias', 'Ben',
    'Diego', 'Rafael', 'Thiago', 'Pedro', 'Hugo', 'Kofi', 'Moussa', 'Ismail', 'Arne', 'Henrik', 'Ole', 'Hannes'
  ],
  lastNames: [
    'Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Koch',
    'Richter', 'Klein', 'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Braun', 'Zimmermann', 'Hartmann', 'Krüger',
    'Werner', 'Lange', 'Krause', 'Lehmann', 'Köhler', 'Maier', 'Herrmann', 'König', 'Walter', 'Huber', 'Kaiser',
    'Fuchs', 'Peters', 'Möller', 'Scholz', 'Jung', 'Hahn', 'Vogel', 'Keller', 'Frank', 'Berger', 'Roth', 'Beck',
    'Lorenz', 'Baumann', 'Franke', 'Albrecht', 'Ludwig', 'Winter', 'Kraus', 'Martin', 'Schuster', 'Böhm', 'Brandt',
    'Yilmaz', 'Kaya', 'Demir', 'Nowak', 'Kowalski', 'Novak', 'Horvat', 'Jensen', 'Hansen', 'Larsen', 'Rossi',
    'Ferrari', 'Silva', 'Santos', 'Costa', 'Diallo', 'Traoré', 'Mensah', 'Petrović', 'Kovač', 'Dvořák', 'Janssen',
    'de Vries', 'Bakker', 'Olsen', 'Lindqvist', 'Moreno', 'Garcia', 'Ndiaye', 'Okafor', 'Brehme', 'Matthias', 'Kuntz'
  ]
};
if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
