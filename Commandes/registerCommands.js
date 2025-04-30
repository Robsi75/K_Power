import { REST } from 'discord.js';
import { Routes } from 'discord-api-types/v9';
import dotenv from 'dotenv';

dotenv.config();

const commands = [
  {
    name: 'bonjour',
    description: 'Dire bonjour au bot.',
  },
  {
    name: 'aide',
    description: 'Afficher la liste des commandes disponibles.',
  },
];

export async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log('🔄 Enregistrement des commandes slash...');
    
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands,
    });

    console.log('✅ Commandes slash enregistrées.');
  } catch (error) {
    console.error('❌ Erreur lors de l\'enregistrement des commandes :', error);
  }
}
