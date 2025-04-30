const fs = require('fs');

// Lire le fichier JSON
const filePath = './questions.json';
const data = fs.readFileSync(filePath, 'utf-8');

// Remplacer !qotd par /qotd
const updatedData = data.replace(/"!qotd/g, '"/qotd');

// Sauvegarder le fichier modifié
fs.writeFileSync(filePath, updatedData, 'utf-8');

console.log('Conversion terminée : !qotd → /qotd');
