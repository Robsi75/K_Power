const { 
    Client, GatewayIntentBits, EmbedBuilder, Collection, GuildScheduledEventEntityType,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, Partials, 
    ModalBuilder, TextInputBuilder, TextInputStyle, 
    InteractionType, ChannelType, PermissionFlagsBits, PermissionsBitField, 
    ThreadAutoArchiveDuration, SlashCommandBuilder 
} = require('discord.js');
const cron = require('node-cron');
require('dotenv').config();
const quizzes = require('./questions.js');
const fs = require('fs');
const axios = require('axios');
const schedule = require('node-schedule'); // Planification avancée
const moment = require('moment-timezone');
// Création du client Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,                // Gestion des serveurs
        GatewayIntentBits.GuildMessages,         // Gestion des messages
        GatewayIntentBits.MessageContent,        // Lire le contenu des messages
        GatewayIntentBits.GuildMessageReactions, // Lire les réactions
        GatewayIntentBits.GuildMembers,          // Accéder aux membres du serveur
        GatewayIntentBits.DirectMessages,        // Lire les messages privés (MP)
        GatewayIntentBits.GuildPresences,        // (optionnel) Voir les statuts des membres
        GatewayIntentBits.GuildVoiceStates,      // (optionnel) Gérer les connexions vocales
        GatewayIntentBits.GuildScheduledEvents   // (optionnel) Gérer les événements planifiés
    ],
    partials: [
        Partials.Message,  // Permet de récupérer les messages supprimés/modifiés
        Partials.Channel,  // Gérer les interactions dans les MP
        Partials.Reaction, // Suivi des réactions même après un redémarrage du bot
        Partials.GuildMember, // Accéder aux membres même partiellement
        Partials.User // Accéder aux utilisateurs même si partiellement chargés
    ]
});
axios.get("https://api64.ipify.org?format=json")
  .then(response => {
    console.log("Votre IP publique est :", response.data.ip);
  })
  .catch(error => {
    console.error("Erreur :", error);
  });
const { EventEmitter } = require('events');
EventEmitter.defaultMaxListeners = 50; // Augmente la limite à 50

const playerPoints = {}; // Stocke les points des joueurs
let previousRanking = {}; // Classement précédent
let rankingMessageId = null; // ID du message de classement
let rankingChannel = null; // Canal où le classement est affiché

client.once('ready', async () => {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);

    // Vérification des dates de l'anniversaire
    const now = new Date();
    const startAnniversary = new Date(now.getFullYear(), 2, 12); // 12 mars
    const endAnniversary = new Date(now.getFullYear(), 3, 7); // 7 avril
    const isAnniversary = now >= startAnniversary && now <= endAnniversary;

    // Mise à jour du statut du bot
    client.user.setPresence({
        activities: isAnniversary ? [{ name: '🎉 Celebration of Krystal Power\'s Anniversary! 🎉', type: 4 }] : [],
        status: 'online'
    });

    console.log(`🟢 Statut défini sur : ${isAnniversary ? 'Mode Anniversaire' : 'Mode Normal'}`);

    // Mise à jour du classement toutes les 30 secondes
    setInterval(updateRanking, 30000);
});

// Connexion du bot à Discord
client.login(process.env.TOKEN);

// Fonction pour générer l'embed du classement
function generateRankingEmbed() {
    const sortedPlayers = Object.entries(playerPoints).sort((a, b) => b[1] - a[1]);
    let changes = {};
    let maxPointsGained = -Infinity;
    let minPointsGained = Infinity;
    let topGainer = null;
    let lowGainer = null;

    sortedPlayers.forEach(([player, points], index) => {
        const previousPosition = Object.keys(previousRanking).indexOf(player);
        const currentPosition = index;

        if (previousPosition === -1) {
            changes[player] = '🆕';
        } else if (previousPosition > currentPosition) {
            changes[player] = '📈';
        } else if (previousPosition < currentPosition) {
            changes[player] = '📉';
        } else {
            changes[player] = '➖';
        }

        const pointsDiff = points - (previousRanking[player] || 0);
        if (pointsDiff > maxPointsGained) {
            maxPointsGained = pointsDiff;
            topGainer = player;
        }
        if (pointsDiff < minPointsGained) {
            minPointsGained = pointsDiff;
            lowGainer = player;
        }
    });

    const timestamp = Math.floor(Date.now() / 1000); // Convertit en timestamp Unix

    const embed = new EmbedBuilder()
        .setTitle('🏆 Player Rankings')
        .setColor('#FFD700')
        .setTimestamp()
        .addFields({
            name: `📅 Ranking the <t:${timestamp}:d>`, // Utilisation du timestamp Discord
            value: '\u200B', // Vide pour espacer
            inline: false
        });

    // Classement des joueurs
    sortedPlayers.forEach(([player, points], index) => {
        let symbol = changes[player] || '➖';
        if (player === topGainer) symbol += ' 🔥';

        let specialTag = '';
        if (index === 0) specialTag = '🥇';
        if (index === 1) specialTag = '🥈';
        if (index === 2) specialTag = '🥉';

        embed.addFields({ name: `${specialTag} ${player} ${symbol}`, value: `${points} points`, inline: false });
    });

    // Ligne de séparation
    embed.addFields({
        name: '\u200B', // Vide
        value: '───────────────────', // Séparation
        inline: false
    });

    // Légende des symboles
    embed.addFields({
         name: '📜 **Symbol Legend:**',
    value: "🆕 : New player\n" +
        "📈 : Moved up in the ranking\n" +
        "📉 : Moved down in the ranking\n" +
        "➖ : No change\n" +
        "🔥 : Biggest points gain\n" +
        "🥇 : First\n" +
        "🥈 : Second\n" +
        "🥉 : Third",
        inline: false
    });

    return embed;
}

// Fonction pour mettre à jour le classement
async function updateRanking() {
    if (!rankingChannel || !rankingMessageId) return;
    try {
        const message = await rankingChannel.messages.fetch(rankingMessageId);
        if (message) {
            const embed = generateRankingEmbed();
            await message.edit({ embeds: [embed] });
        }
    } catch (error) {
        console.error("Erreur lors de la mise à jour du classement:", error);
    }
    previousRanking = { ...playerPoints };
}
const DEFAULT_CHANNEL_ID = '1048940253534240775'; // Remplace par l'ID du canal que tu veux utiliser par défaut


// Commandes de base du bot
client.once('ready', async () => {
    const commands = [
        new SlashCommandBuilder()
            .setName('ranking')
            .setDescription('📊 Displays and updates player rankings'),
        new SlashCommandBuilder()
            .setName('points')
            .setDescription('🔢 Sets the number of points for a player')
            .addUserOption(option => option.setName('player').setDescription('The player to change').setRequired(true))
            .addNumberOption(option => option.setName('points').setDescription('Number of points').setRequired(true)),
        new SlashCommandBuilder()
            .setName('resetpoints')
            .setDescription('♻️ Resets all player points to zero'),
        new SlashCommandBuilder()
            .setName('drops')
            .setDescription('Schedules a drop event at a specified time')
            .addStringOption(option => 
                option.setName('time')
                    .setDescription('Time to schedule the drop event (HH:MM)')
                    .setRequired(true)
            )
            .addChannelOption(option => 
                option.setName('channel')
                    .setDescription('Channel to post the drop event (optional)')
                    .setRequired(false)
            ),
    ].map(command => command.toJSON());

    await client.application.commands.set(commands);
    console.log(`Bot en ligne et commandes slash enregistrées.`);
});

// Traitement des interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    // Commande 'points'
    if (commandName === 'points') {
        const player = interaction.options.getUser('player');
        const points = interaction.options.getNumber('points');

        if (!player || points === null || points < 0) {
            return interaction.reply({ content: '⚠️ Please specify a player and a valid number of points (≥ 0).', ephemeral: true });
        }

        playerPoints[player.tag] = points;
        interaction.reply({ content: `✅ ${player.tag} now has **${points} points**.`, ephemeral: false });
        updateRanking();
    }

    // Commande 'ranking'
    if (commandName === 'ranking') {
        if (Object.keys(playerPoints).length === 0) {
            return interaction.reply('No player has any points yet.');
        }

        rankingChannel = interaction.channel;
        const embed = generateRankingEmbed();
        const rankingMessage = await rankingChannel.send({ embeds: [embed] });
        rankingMessageId = rankingMessage.id;
        interaction.reply({ content: '📊 Ranking initialized!', ephemeral: true });
        previousRanking = { ...playerPoints };
    }

    // Commande 'resetpoints'
    if (commandName === 'resetpoints') {
        Object.keys(playerPoints).forEach(player => {
            playerPoints[player] = 0;
        });
        interaction.reply({ content: '🔄 All players have been reset to **0 points**.', ephemeral: false });
        updateRanking();
    }
client.once('ready', async () => {
    const commands = [
        new SlashCommandBuilder()
            .setName('updatepoints')
            .setDescription('📊 Update multiple player scores')
            .addStringOption(option =>
                option.setName('data')
                    .setDescription('Paste the player scores in the format "Player Points"')
                    .setRequired(true)
            ),
    ].map(command => command.toJSON());

    await client.application.commands.set(commands);
    console.log(`🆕 Commande updatepoints ajoutée.`);
});




    // Commande 'drops'
    if (commandName === 'drops') {
        const time = interaction.options.getString('time');
        const channelOption = interaction.options.getChannel('channel') || interaction.guild.channels.cache.get(DEFAULT_CHANNEL_ID);

        if (!time) {
            return interaction.reply("Veuillez spécifier l'heure ! Exemple : `/drops 14:52`.");
        }

        const [hour, minute] = time.split(':');
        const targetTime = new Date();
        targetTime.setHours(hour);
        targetTime.setMinutes(minute);
        targetTime.setSeconds(0);

        // Calcul du délai jusqu'à l'heure cible
        const delay = targetTime.getTime() - Date.now();
        if (delay <= 0) {
            return interaction.reply("L'heure spécifiée est déjà passée!");
        }

        interaction.reply(`Le drop aura lieu à ${time} dans <#${channelOption.id}> !`);

        setTimeout(async () => {
            if (!channelOption) {
                return console.error(`❌ Erreur : Impossible de trouver le canal spécifié.`);
            }

            const dropMessage = await channelOption.send("🎉 **It's drop time!** 🎉React quickly to win a reward!");
            await dropMessage.react('🎁');

            // Gestion des réactions
            const filter = (reaction, user) => reaction.emoji.name === '🎁' && !user.bot;
            const collector = dropMessage.createReactionCollector({ filter, max: 1, time: 3600000 });

            collector.on('collect', (reaction, user) => {
                channelOption.send(`🎉 ${user.tag} won the drop! Congratulations! 🎁`);
                collector.stop();
            });

            collector.on('end', (collected) => {
                if (collected.size === 0) {
                    channelOption.send("The drop is over, no one reacted in time!");
                }
            });
        }, delay);
    }
});
let activeQuizzes = new Set();
let scores = new Map();
let leaderboardMessage = null;

client.once('ready', async () => {
    console.log(`Connected as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.startsWith('!quiz')) {
        const categoryId = '1335608245133377556';
        if (!message.channel.parent || message.channel.parent.id !== categoryId) {
            return message.reply("❌ This command can only be used in the authorized category.");
        }
        
        const quizId = message.content.slice(5).trim();
        if (!quizzes[quizId]) {
            return message.reply("❌ Quiz not found!");
        }

        const today = new Date().getDate();
        const restrictionChar = quizId.slice(-1); // Prend le dernier caractère
        if ((restrictionChar === '1' && today !== 19) || (restrictionChar === '2' && today !== 24)) {
            return message.reply("❌ This quiz can only be played on the allowed day of the month!");
        }
        
        await startQuiz(message, quizzes[quizId]);
    } else if (message.content === '!stopquiz') {
        if (!activeQuizzes.has(message.channel.id)) {
            return message.reply("❌ No quiz is currently running!");
        }
        activeQuizzes.delete(message.channel.id);
        return message.reply("🛑 The quiz has been stopped!");
    }
});



async function startQuiz(message, quizQuestions) {
    if (activeQuizzes.has(message.channel.id)) {
        return message.reply("❌ A quiz is already in progress!");
    }
    
    activeQuizzes.add(message.channel.id);
    let userId = message.author.id;
    let username = message.author.username;
    
    if (!scores.has(userId)) {
        scores.set(userId, { username, score: 0 });
    }
    
    if (!leaderboardMessage) {
        leaderboardMessage = await message.channel.send({ embeds: [createLeaderboardEmbed()] });
    }
    
    message.reply("📢 The quiz is starting!");
    
    let quizSummary = [];
    let questionMessages = [];

    for (let i = 0; i < quizQuestions.length; i++) {
        if (!activeQuizzes.has(message.channel.id)) return;
        const questionData = quizQuestions[i];
        
        const embed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle(`Question ${i + 1}`)
            .setDescription(questionData.question)
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/2464/2464317.png');
        
        if (questionData.image) {
            embed.setImage(questionData.image);
        }
        
        const row = new ActionRowBuilder();
        questionData.options.forEach(option => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(option)
                    .setLabel(option)
                    .setStyle(ButtonStyle.Primary)
            );
        });
        
        const questionMessage = await message.channel.send({ embeds: [embed], components: [row] });
        questionMessages.push(questionMessage);
        
        try {
            const filter = (i) => i.user.id === message.author.id;
            const collected = await questionMessage.awaitMessageComponent({ filter, time: 10000 }); // 10 secondes
            
            if (!activeQuizzes.has(message.channel.id)) return;
            
            let chosenAnswer = collected.customId;
            let correctAnswer = questionData.answer;
            
            quizSummary.push({
                question: questionData.question,
                chosenAnswer,
                correctAnswer
            });
            
            if (chosenAnswer === correctAnswer) {
                scores.get(userId).score += 1;
                await collected.reply({ content: '✅ Correct answer!', ephemeral: true });
            } else {
                await collected.reply({ content: `❌ Wrong answer! The correct answer was **${correctAnswer}**.`, ephemeral: true });
            }
            
            updateLeaderboard();
        } catch (error) {
            if (!activeQuizzes.has(message.channel.id)) return;
            quizSummary.push({
                question: questionData.question,
                chosenAnswer: "No answer",
                correctAnswer: questionData.answer
            });
            
            const timeUpMessage = await message.channel.send(`⏳ Time's up! The correct answer was **${questionData.answer}**.`);
            setTimeout(() => {
                timeUpMessage.delete().catch(console.error);
            }, 5000);
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    if (!activeQuizzes.has(message.channel.id)) return;
    
    let summaryText = quizSummary.map((entry, index) => `**Q${index + 1}:** ${entry.question}
   **Your answer:** ${entry.chosenAnswer}
   **Correct answer:** ${entry.correctAnswer}`).join('\n\n');
    
    const finalEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('Quiz finished!')
        .setDescription(`🎉 Your final score is: **${scores.get(userId).score}** out of **${quizQuestions.length}**!\n\n${summaryText}`)
        .setThumbnail('https://cdn-icons-png.flaticon.com/512/2464/2464317.png');
    
    await message.channel.send({ embeds: [finalEmbed] });
    questionMessages.forEach(msg => msg.delete().catch(console.error));
    activeQuizzes.delete(message.channel.id);
}

function updateLeaderboard() {
    if (!leaderboardMessage) return;
    
    const leaderboardEmbed = createLeaderboardEmbed();
    leaderboardMessage.edit({ embeds: [leaderboardEmbed] }).catch(console.error);
}

function createLeaderboardEmbed() {
    let scoreArray = Array.from(scores.values());
    scoreArray.sort((a, b) => b.score - a.score);
    scoreArray = scoreArray.slice(0, 10);
    
    return new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 Real-time Leaderboard')
        .setDescription(scoreArray.map((entry, index) => `**${index + 1}.** ${entry.username} - ${entry.score} points`).join("\n"))
        .setFooter({ text: "Use !quiz<id> to play!" })
        .setThumbnail('https://cdn-icons-png.flaticon.com/512/2464/2464317.png');
}

process.on('unhandledRejection', error => {
    console.error('Unhandled error:', error);
});
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content === '!listquiz') {
        if (Object.keys(quizzes).length === 0) {
            return message.reply("📜 Il n'y a aucun quiz disponible pour le moment !");
        }
        
        const quizList = Object.keys(quizzes).map(quizId => `- **${quizId}**`).join("\n");
        return message.reply(`📚 Voici la liste des quiz disponibles :\n${quizList}`);
    }
});
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content === '!allscores') {
        if (scores.size === 0) {
            return message.reply("📊 No scores recorded at this time !");
        }

        let scoreArray = Array.from(scores.values());
        scoreArray.sort((a, b) => b.score - a.score);

        let scoreList = scoreArray.map((entry, index) => `**${index + 1}.** ${entry.username} - ${entry.score} points`).join("\n");

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('📊 Scores for all players')
            .setDescription(scoreList)
            .setFooter({ text: "Use !quiz<id> to play!" })
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/2464/2464317.png');

        return message.channel.send({ embeds: [embed] });
    }
});
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'classement') {
        const input = interaction.options.getString('scores');
        if (!input) return interaction.reply({ content: '🚨 Aucun score fourni.', ephemeral: true });

        let players = input.split('\n').map(line => {
            const parts = line.trim().split(/\s+/);
            const name = parts.slice(0, -1).join(' ');
            const score = parseInt(parts.at(-1), 10);
            return { name, score };
        });

        players = players.filter(p => !isNaN(p.score)).sort((a, b) => b.score - a.score);
        
        const today = new Date().toISOString().split('T')[0].split('-').reverse().join('/');
        
        const ranks = ['🥇', '🥈', '🥉'];
        let lastScore = null;
        let rankEmoji = '';
        
        const description = players.map((player, index) => {
            if (index < 3) {
                rankEmoji = ranks[index];
            } else if (player.score === lastScore) {
                rankEmoji = '➖';
            } else {
                rankEmoji = '📉';
            }
            lastScore = player.score;
            return `${rankEmoji} **${player.name}** ➖\n${player.score} points`;
        }).join('\n\n');

        const embed = new EmbedBuilder()
            .setTitle('🏆 Player Rankings')
            .setDescription(`📅 Ranking the ${today}\n\n${description}`)
            .setColor('#FFD700');

        await interaction.reply({ embeds: [embed] });
    }
});
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content === '!resetscores') {
        if (!message.member.permissions.has('ADMINISTRATOR')) {
            return message.reply("❌ You do not have permission to execute this command !");
        }

        if (scores.size === 0) {
            return message.reply("📊 There are no scores to reset !");
        }

        scores.clear(); // Vide la Map des scores
        leaderboardMessage = null; // Supprime le message du classement
        activeQuizzes.clear(); // Arrête tous les quiz en cours

        return message.channel.send("🔄 **All scores have been reset by an administrator!**");
    }
});

client.once('ready', () => {
    console.log(`Connecté en tant que ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Commande pour afficher le bouton de création d'embed
    if (message.content.toLowerCase() === '!embed') {
        const button = new ButtonBuilder()
            .setCustomId('open_embed_modal')
            .setLabel('Créer un Embed')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);
        await message.reply({ content: 'Clique sur le bouton pour créer un embed.', components: [row] });
    }

    // Commande pour repost un message
    if (message.reference && message.content.toLowerCase().startsWith('!repost')) {
        const args = message.content.split(' ');

        if (args.length < 2) {
            return message.reply('❌ Utilisation : !repost #canal [HH:MM] [thread] [nom_du_thread] [message_id]');
        }

        const channelMention = args[1];
        const targetChannel = message.guild.channels.cache.find(c => `<#${c.id}>` === channelMention);

        if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
            return message.reply('❌ Canal invalide ou introuvable.');
        }

        const createThread = args.includes('thread');
        const threadName = createThread ? args.slice(args.indexOf('thread') + 1).join(' ') : null;

        try {
            // Récupération du message référencé
            const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
            if (!referencedMessage) return message.reply('❌ Impossible de trouver le message référencé.');

            let content = referencedMessage.content || ' ';
            let attachments = referencedMessage.attachments.map(att => att.url);
            let embeds = referencedMessage.embeds.map(e => EmbedBuilder.from(e));

            let replyToMessage = null;
            let time = null;

            // Vérification de l'option de réponse à un message spécifique dans le canal cible
            if (args.length >= 3 && !isNaN(args[args.length - 1])) {
                try {
                    replyToMessage = await targetChannel.messages.fetch(args[args.length - 1]);
                } catch (error) {
                    return message.reply('❌ Impossible de trouver le message cible dans le canal de destination.');
                }
            }

            // Gestion de la planification
            if (args.length >= 3) {
                const timeRegex = /^\d{2}:\d{2}$/;
                if (timeRegex.test(args[2])) {
                    const [hours, minutes] = args[2].split(':').map(Number);
                    const now = new Date();
                    const postTime = new Date();
                    postTime.setHours(hours, minutes, 0, 0);

                    if (postTime < now) postTime.setDate(postTime.getDate() + 1);

                    const delay = postTime - now;
                    setTimeout(async () => {
                        let sentMessage;
                        if (replyToMessage) {
                            sentMessage = await replyToMessage.reply({ content, files: attachments, embeds });
                        } else {
                            sentMessage = await targetChannel.send({ content, files: attachments, embeds });
                        }

                        if (createThread) {
                            await sentMessage.startThread({
                                name: threadName || `Discussion sur ${sentMessage.id}`,
                                autoArchiveDuration: ThreadAutoArchiveDuration.OneDay
                            });
                        }
                    }, delay);

                    return message.reply(`✅ Message programmé pour ${args[2]} dans ${targetChannel}.`);
                }
            }

            // Repost immédiat
            let sentMessage;
            if (replyToMessage) {
                sentMessage = await replyToMessage.reply({ content, files: attachments, embeds });
            } else {
                sentMessage = await targetChannel.send({ content, files: attachments, embeds });
            }

            if (createThread) {
                await sentMessage.startThread({
                    name: threadName || `Discussion sur ${sentMessage.id}`,
                    autoArchiveDuration: ThreadAutoArchiveDuration.OneDay
                });
            }

            await message.reply(`✅ Message reposté ${replyToMessage ? 'en réponse à un message' : 'immédiatement'} dans ${targetChannel}.`);
        } catch (error) {
            console.error('Erreur lors du repost :', error);
            await message.reply('❌ Une erreur est survenue lors du repost.');
        }
    }
});

// Gestion des interactions (modals, boutons)
client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton() && interaction.customId === 'open_embed_modal') {
        const modal = new ModalBuilder()
            .setCustomId('embed_modal')
            .setTitle('🌟 Créer un Embed 🌟');

        const textInput = new TextInputBuilder()
            .setCustomId('embed_text')
            .setLabel("Texte de l'embed")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const imageInput = new TextInputBuilder()
            .setCustomId('embed_image')
            .setLabel("URL de l'image (optionnel)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        const row1 = new ActionRowBuilder().addComponents(textInput);
        const row2 = new ActionRowBuilder().addComponents(imageInput);

        modal.addComponents(row1, row2);
        await interaction.showModal(modal);
    }

    if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'embed_modal') {
        const embedText = interaction.fields.getTextInputValue('embed_text');
        const embedImage = interaction.fields.getTextInputValue('embed_image');

        const embed = new EmbedBuilder().setColor(0x0099ff).setDescription(embedText);
        if (embedImage) embed.setImage(embedImage);

        await interaction.reply({ embeds: [embed] });
    }
});
// Commande !ticket pour tous les membres ayant le rôle
client.on('messageCreate', async (message) => {
    if (message.content === '!ticket') {
        const guild = message.guild;
        const roleId = '1339645241577439282'; // ID du rôle concerné

        try {
            await guild.members.fetch();
            const membersWithRole = guild.members.cache.filter(member => member.roles.cache.has(roleId));

            if (membersWithRole.size === 0) {
                return message.reply("❌ No members have this role.");
            }

            message.reply(`🎟️ Creating quiz channels for ${membersWithRole.size} users...`);

            for (const [memberId, member] of membersWithRole) {
                const existingTicketChannel = guild.channels.cache.find(channel => channel.name === `quiz-${member.user.username}`);
                if (existingTicketChannel) continue;

                const channel = await guild.channels.create({
                    name: `quiz-${member.user.username}`,
                    type: 0,
                    topic: `Quiz for ${member.user.username}`,
                    parent: '1335608245133377556',
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            deny: ['ViewChannel'],
                        },
                        {
                            id: member.id,
                            allow: ['ViewChannel', 'ReadMessageHistory'],
                        },
                        {
                            id: '1053399273921859764',
                            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages'],
                        }
                    ],
                });

                const ticketEmbed = new EmbedBuilder()
                    .setTitle("📝 Quiz Channel")
                    .setDescription(`Hey ${member.user.username},\n\nWelcome to this channel!\n\nThis is where you can take your individual quiz.`)
                    .setColor('#00FF00')
                    .setTimestamp();

                await channel.send({ embeds: [ticketEmbed] });
            }
        } catch (error) {
            console.error('Error fetching members:', error);
            message.reply("❌ An error occurred while creating tickets.");
        }
    }
});

// Commande !ticket @membre pour créer un ticket spécifique
client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!ticket ')) {
        const guild = message.guild;
        const member = message.mentions.members.first();

        if (!member) {
            return message.reply("❌ Please mention a valid member.");
        }

        const existingTicketChannel = guild.channels.cache.find(channel => channel.name === `quiz-${member.user.username}`);
        if (existingTicketChannel) {
            return message.reply("❌ This user already has an open quiz channel.");
        }

        try {
            const channel = await guild.channels.create({
                name: `quiz-${member.user.username}`,
                type: 0,
                topic: `Quiz for ${member.user.username}`,
                parent: '1335608245133377556',
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: ['ViewChannel'],
                    },
                    {
                        id: member.id,
                        allow: ['ViewChannel', 'ReadMessageHistory'],
                    },
                    {
                        id: '1053399273921859764',
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages'],
                    }
                ],
            });

            const ticketEmbed = new EmbedBuilder()
                .setTitle("📝 Quiz Channel")
                .setDescription(`Hey ${member.user.username},\n\nWelcome to this channel!\n\nThis is where you can take your individual quiz.`)
                .setColor('#00FF00')
                .setTimestamp();

            await channel.send({ embeds: [ticketEmbed] });
            message.reply(`✅ Ticket created for ${member.user.username}.`);
        } catch (error) {
            console.error('Error creating ticket:', error);
            message.reply("❌ An error occurred while creating the ticket.");
        }
    }
});



const CATEGORY_ID = '1335608245133377556'; // Catégorie cible

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith('!broadcast') || message.author.bot) return;

    const args = message.content.split(' ').slice(1); // Récupérer les arguments après !broadcast
    let scheduledTime = null;

    // Vérifier si une heure est donnée (format hh:mm)
    if (args.length > 0 && /^\d{2}:\d{2}$/.test(args[0])) {
        scheduledTime = args[0];
    }

    // Vérifier si l'utilisateur a répondu à un message
    if (!message.reference) {
        return message.reply("❌ Tu dois répondre à un message pour l'envoyer !");
    }

    // Récupérer le message auquel l'utilisateur a répondu
    const referencedMessage = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
    if (!referencedMessage) {
        return message.reply("❌ Impossible de récupérer le message référencé !");
    }

    // Récupérer tous les canaux texte de la catégorie
    const channels = message.guild.channels.cache.filter(c => c.parentId === CATEGORY_ID && c.isTextBased());
    if (channels.size === 0) {
        return message.reply("❌ Aucun canal texte trouvé dans cette catégorie !");
    }

    // Fonction d'envoi du message
    const sendMessage = () => {
        channels.forEach(channel => {
            channel.send(referencedMessage.content).catch(console.error);
        });
        message.reply("✅ Message envoyé dans tous les canaux de la catégorie !");
    };

    if (scheduledTime) {
        // Programmer l'envoi à l'heure donnée
        const [hour, minute] = scheduledTime.split(':').map(Number);
        const now = new Date();
        const sendDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);

        if (sendDate < now) {
            return message.reply("❌ L'heure doit être dans le futur !");
        }

        schedule.scheduleJob(sendDate, sendMessage);
        message.reply(`⏳ Message programmé pour **${scheduledTime}** !`);
    } else {
        // Envoi immédiat
        sendMessage();
    }
});
const scheduledLocks = new Map();

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const args = message.content.split(' ');
    const command = args[0].toLowerCase();

    if (command === '!lockrole' || command === '!unlockrole') {
        if (args.length < 4) {
            return message.reply('❌ Utilisation : `!lockrole @role #canal HH:MM`');
        }

        const roleMention = message.mentions.roles.first();
        const channelMention = message.mentions.channels.first();
        const time = args[3];

        if (!roleMention || !channelMention || !/^\d{2}:\d{2}$/.test(time)) {
            return message.reply('❌ Format invalide. Exemple : `!lockrole @Joueurs #général 23:00`');
        }

        const [hour, minute] = time.split(':').map(Number);
        const jobKey = `${channelMention.id}-${roleMention.id}-${command}`;

        // Supprime la tâche planifiée existante si elle existe
        if (scheduledLocks.has(jobKey)) {
            scheduledLocks.get(jobKey).stop();
            scheduledLocks.delete(jobKey);
        }

        const job = cron.schedule(`${minute} ${hour} * * *`, async () => {
            try {
                // Récupère le salon depuis le cache
                const guild = message.guild;
                const freshChannel = guild.channels.cache.get(channelMention.id);
                if (!freshChannel) {
                    console.error(`❌ Salon introuvable : ${channelMention.id}`);
                    return;
                }

                if (freshChannel.type === ChannelType.GuildText) {
                    await freshChannel.permissionOverwrites.edit(roleMention, {
                        SendMessages: command === '!lockrole' ? false : null,
                        SendMessagesInThreads: command === '!lockrole' ? false : null
                    });
                } else if (
                    freshChannel.type === ChannelType.PublicThread ||
                    freshChannel.type === ChannelType.PrivateThread
                ) {
                    await freshChannel.permissionOverwrites.edit(roleMention, {
                        SendMessagesInThreads: command === '!lockrole' ? false : null
                    });

                    await freshChannel.setLocked(command === '!lockrole');
                }

                message.channel.send(`✅ Le rôle ${roleMention} ${command === '!lockrole' ? 'ne peut plus' : 'peut à nouveau'} écrire dans ${freshChannel}.`);
            } catch (error) {
                console.error('❌ Erreur lors de la modification des permissions :', error);
                message.channel.send('❌ Une erreur est survenue lors de la modification des permissions.');
            }
        }, {
            timezone: 'Europe/Paris'
        });

        scheduledLocks.set(jobKey, job);
        message.reply(`🔒 Planifié : Le rôle ${roleMention} ${command === '!lockrole' ? 'ne pourra plus' : 'pourra à nouveau'} écrire dans ${channelMention} à ${time}.`);
    }
});
const activeGiveaways = new Map();
const defaultRoleId = '1339645241577439282'; // ID du rôle par défaut
const defaultChannelId = '1048940253534240775'; // ID du canal par défaut

client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!creategiveaway')) {
        const args = message.content.split(' ');
        if (args.length < 2) {
            return message.reply('Usage: !creategiveaway duration_in_hours');
        }

        const durationInHours = parseFloat(args[1]);
        if (isNaN(durationInHours) || durationInHours <= 0) {
            return message.reply('Durée invalide. Assurez-vous de spécifier une durée en heures valide.');
        }

        const channel = await client.channels.fetch(defaultChannelId);
        if (!channel) {
            return message.reply('Le canal par défaut est introuvable.');
        }

        const role = await message.guild.roles.fetch(defaultRoleId).catch(() => null);
        if (!role) {
            return message.reply('Le rôle par défaut est introuvable.');
        }

        const duration = durationInHours * 3600000;

        const embed = new EmbedBuilder()
            .setTitle('🎉 GIVEAWAY 🎉')
            .setDescription(`Celebrating **3 years** of **Krystal Power** 🎊!\n
            **🎁 Up to 50 points to win!**\n
            **🏆 1 Main Winner + 4 Others!**\n
            **⏳ Duration:** ${args[1]} hours\n
            **👥 Participants:** 0\n
            **🎟️ Click the button below to participate!**`)
            .setColor('#FFD700')
            .setImage('https://cdn-icons-png.flaticon.com/512/2464/2464317.png')
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('join_giveaway')
                    .setLabel('🎟️ Participate')
                    .setStyle(ButtonStyle.Success)
            );

        const giveawayMessage = await channel.send({ 
            content: `${role.toString()}`, 
            embeds: [embed], 
            components: [row] 
        });

        activeGiveaways.set(giveawayMessage.id, { 
            message: giveawayMessage, 
            channel: channel, 
            duration, 
            participants: new Set(),
            collector: null,  
            cancelled: false,
            startTime: Date.now() 
        });

        const collector = giveawayMessage.createMessageComponentCollector({
            componentType: 2,
            time: duration
        });

        activeGiveaways.get(giveawayMessage.id).collector = collector;

        collector.on('collect', async (interaction) => {
            if (interaction.customId === 'join_giveaway') {
                const giveawayData = activeGiveaways.get(giveawayMessage.id);
                giveawayData.participants.add(interaction.user.id);

                await interaction.reply({ content: '✅ You have entered the giveaway!', ephemeral: true });
                await updateEmbed(giveawayMessage, giveawayData); // Mise à jour après participation
            }
        });

        const updateEmbed = async (message, giveawayData) => {
            if (!giveawayData) return;
            
            const timeElapsed = Date.now() - giveawayData.startTime;
            const progress = Math.min((timeElapsed / giveawayData.duration) * 100, 100);
            const progressBar = '🟩'.repeat(Math.floor(progress / 10)) + '⬛'.repeat(10 - Math.floor(progress / 10));
            const participantsCount = giveawayData.participants.size;

            const updatedEmbed = new EmbedBuilder()
                .setTitle('🎉 GIVEAWAY 🎉')
                .setDescription(`Celebrating **3 years** of **Krystal Power** 🎊!\n
                **🎁 Up to 50 points to win!**\n
                **🏆 1 Main Winner + 4 Others!**\n
                **⏳ Duration:** ${args[1]} hours\n
                **⏳ Time elapsed:** ${Math.floor(progress)}%\n
                ${progressBar}\n
                **👥 Participants:** ${participantsCount}\n
                **🎟️ Click the button below to participate!**`)
                .setColor('#FFD700')
                .setImage('https://cdn-icons-png.flaticon.com/512/2464/2464317.png')
                .setTimestamp();
            
            await message.edit({ content: `${role}`, embeds: [updatedEmbed], components: [row] });
        };

        const progressInterval = setInterval(async () => {
            const giveawayData = activeGiveaways.get(giveawayMessage.id);
            if (!giveawayData || giveawayData.cancelled || Date.now() - giveawayData.startTime >= giveawayData.duration) {
                clearInterval(progressInterval);
                return;
            }
            await updateEmbed(giveawayMessage, giveawayData);
        }, 1000); // Mise à jour toutes les secondes

        setTimeout(async () => {
            const giveawayData = activeGiveaways.get(giveawayMessage.id);
            if (!giveawayData || giveawayData.cancelled) return;

            const participants = Array.from(giveawayData.participants);
            const totalParticipants = participants.length; // ✅ On stocke le nombre total AVANT modification

            if (totalParticipants === 0) {
                return channel.send('⛔ No participants, giveaway canceled.');
            }

            const shuffled = participants.sort(() => Math.random() - 0.5);
            const mainWinner = shuffled.shift();
            const otherWinners = shuffled.slice(0, 4);

            const finalEmbed = new EmbedBuilder()
                .setTitle('🎉 GIVEAWAY ENDED 🎉')
                .setDescription(`🎊 **Congratulations to our winners!** 🎊\n
                🏆 **Main Winner:** <@${mainWinner}>\n
                🎖️ **Others:** ${otherWinners.length > 0 ? otherWinners.map(id => `<@${id}>`).join(', ') : 'No other winners'}\n
                **👥 Participants:** ${totalParticipants}`) // ✅ Affichage du bon nombre de participants
                .setColor('#FFD700')
                .setImage('https://cdn-icons-png.flaticon.com/512/2464/2464317.png')
                .setTimestamp();

            await giveawayMessage.edit({ content: '🎉 Giveaway has ended!', embeds: [finalEmbed], components: [] });

            channel.send(`🎉 Congratulations to the winners: <@${mainWinner}> (Main Winner), ${otherWinners.length > 0 ? otherWinners.map(id => `<@${id}>`).join(', ') : 'No other winners'} 🎊`);

            activeGiveaways.delete(giveawayMessage.id);
        }, duration);
    }
});




client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!stopgiveaway')) {
        const args = message.content.split(' ');
        if (args.length < 2) {
            return message.reply('Usage: !stopgiveaway messageID');
        }

        const messageId = args[1];
        const giveaway = activeGiveaways.get(messageId);

        if (!giveaway) {
            return message.reply('⛔ No active giveaway found with this ID.');
        }

        giveaway.cancelled = true;
        giveaway.collector.stop();

        activeGiveaways.delete(messageId);
        return message.channel.send(`🛑 The giveaway has been canceled.`);
    }
});



// Character limit per user (20,000 characters every month, reset every 16th)
const MAX_CHARACTERS_PER_USER = 20000;
const translationsFile = './translations.json'; // File where the data will be saved

// Read the translation file, or initialize it if not found
let userTranslations = {};
if (fs.existsSync(translationsFile)) {
    try {
        const data = fs.readFileSync(translationsFile);
        userTranslations = JSON.parse(data);
    } catch (error) {
        console.error("Error parsing the translations file:", error);
        userTranslations = {};  // If error parsing, initialize an empty object
    }
} else {
    // If the file does not exist, create an empty object and save it
    userTranslations = {};
    fs.writeFileSync(translationsFile, JSON.stringify(userTranslations, null, 2));
}

// Translation emojis

const languageEmojis = {
    '🇫🇷': 'FR', // French
    '🇪🇸': 'ES', // Spanish
    '🇵🇹': 'PT', // Portuguese
    '🇩🇪': 'DE', // German
    '🇬🇧': 'EN', // English
    '🇷🇺': 'RU', // Russian
    '🇺🇦': 'UK', // Ukrainian
    '🇫🇮': 'FI', // Finnish
    '🇩🇰': 'DA', // Danish
    '🇵🇱': 'PL', // Polish
};


client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return; // Ignore bots
    if (!reaction.message || !reaction.emoji.name) return;

    console.log(`Emoji reacted: ${reaction.emoji.name}`); // Debug
    const targetLanguage = languageEmojis[reaction.emoji.name];
    if (!targetLanguage) return; // If it's not a translation emoji, ignore

    const originalMessage = reaction.message.content;
    if (!originalMessage) return; // If the message is empty, ignore

    // Check or initialize the user's translation data
    const userId = user.id;
    if (!userTranslations[userId]) {
        userTranslations[userId] = {
            totalCharacters: 0, // Character counter
            lastReset: Date.now(), // Date of the last reset
        };
    }

    // Check if the 16th of the month has passed since the last reset
    const currentDate = new Date();
    const currentDay = currentDate.getDate(); // Get the day of the month
    const lastResetDate = new Date(userTranslations[userId].lastReset);

    if (currentDay === 16 && currentDate.getMonth() !== lastResetDate.getMonth()) {
        // Reset the counter when it's the 16th of the month and it's a new month
        userTranslations[userId].totalCharacters = 0;
        userTranslations[userId].lastReset = Date.now();
        console.log(`✅ Counter reset for ${user.tag} on the 16th of the month.`);
    }

    // Calculate the length of the current message
    const currentTranslationLength = originalMessage.length;
    const totalLength = userTranslations[userId].totalCharacters + currentTranslationLength;

    // Check if the user has exceeded the 20,000 character limit
    if (totalLength > MAX_CHARACTERS_PER_USER) {
        return user.send(`Sorry, you've reached the 20,000 character translation limit for the month. Please try again next month.`);
    }

    try {
        // Translate with Deepl
        console.log(`🌐 Calling the Deepl API to translate to ${targetLanguage}`);
        const response = await axios.post('https://api-free.deepl.com/v2/translate', null, {
            params: {
                auth_key: process.env.DEEPL_API_KEY, // Deepl API key
                text: originalMessage,
                target_lang: targetLanguage,
            }
        });

        // Check if the response contains the translation
        const translatedText = response.data.translations[0].text;

        // Link to the original message
        const messageLink = `https://discord.com/channels/${reaction.message.guildId}/${reaction.message.channelId}/${reaction.message.id}`;

        // Calculate remaining characters
        const remainingCharacters = MAX_CHARACTERS_PER_USER - totalLength;

        // Embed for the translated message
        const embed = new EmbedBuilder()
            .setDescription(translatedText) // No title, just the translation
            .setColor("#0099ff")
            .setFooter({ 
                text: `Original message by ${reaction.message.author.username}`, 
                iconURL: reaction.message.author.displayAvatarURL() 
            });

        // Send DM with translation + message link + remaining characters
        await user.send({ 
            content: `🔗 [View the original message](${messageLink})\n\nRemaining: ${remainingCharacters} characters before reaching the 20,000 character limit.`, 
            embeds: [embed] 
        });

        console.log(`✅ Translation sent to ${user.tag} in ${targetLanguage}`);

        // 🔥 Remove the user's reaction after sending the DM
        await reaction.users.remove(user.id);
        console.log(`✅ Reaction removed for ${user.tag}`);

        // Update the translation counter for this user
        userTranslations[userId].totalCharacters += currentTranslationLength;

        // Save the updated data to the file
        fs.writeFileSync(translationsFile, JSON.stringify(userTranslations, null, 2));

    } catch (error) {
        console.error("❌ Error during translation:", error);
    }
});
// Mapping des mots-clés aux emojis
const emojiMap = {
    'wood': '<:wood:1337123346227265628>',
    'wires': '<:wires:1338807023868841994>',
    'windows': '<:windows:1338807117804601355>',
    'toys': '<:Toys:1338808838220156968>',
    'tools': '<:tools:1338805714990141521>',
    'hardware': '<:tools:1338805714990141521>',
    'toiletries': '<:Toiletries:1338808958491557898>',
    'thread': '<:thread:1338805681074995200>',
    'textiles': '<:textiles:1338805588032753685>',
    'steel beams': '<:SteelBeams:1338808507587104798>',
    'steel': '<:steel:1338806927412432907>',
    'stainless steel': '<:StainlessSteel:1338808181375107072>',
    'sport good': '<:SportsGood:1338808912375451709>',
    'silicone': '<:silicone:1338807222091644959>',
    'shoes': '<:shoes:1338806970844713043>',
    'sheet metals': '<:sheetsmetal:1338807151144996904>',
    'quartz': '<:quartz:1338806785821118567>',
    'pottery': '<:Pottery:1338808463756628029>',
    'plastics': '<:Plastics:1338808398258507796>',
    'pipes': '<:pipes:1338807051723341857>',
    'pharmaceuticals': '<:Pharmaceuticals:1338808999495335956>',
    'petrol': '<:Petrol:1338808623760936960>',
    'pastrie': '<:Pastrie:1338806045916790814>',
    'pax': '<:Passengers:1338809074946543629>',
    'packaging': '<:packaging:1338807080009859114>',
    'paper': '<:paper:1338805958016499753>',
    'meat': '<:meat:1338805653107511296>',
    'machinery': '<:Machinery:1338808338032365578>',
    'leather': '<:leather:1338805985875329078>',
    'lamps': '<:Lamps:1338808013963923456>',
    'krystal': '<:Krystal:1335679520401002617>',
    'iron ore': '<:Ironore:1338805424589373502>',
    'iron': '<:iron:1337122017220235264>',
    'household': '<:Household:1338808729151344702>',
    'grain': '<:grain:1337121795752460288>',
    'wheat': '<:grain:1337121795752460288>',
    'glass': '<:glass:1338806998279393340>',
    'food': '<:food:1338807652846800958>',
    'flour': '<:flour:1338806605273108521>',
    'electronic': '<:Electronic:1338808794821558323>',
    'crude oil': '<:Crudeoil:1338807681070403604>',
    'oil': '<:Crudeoil:1338807681070403604>',
    'cows': '<:cows:1338805624582176821>',
    'cattle': '<:cows:1338805624582176821>',
    'cotton': '<:cotton:1338805558618357832>',
    'copper ore': '<:copperore:1338806699045158953>',
    'copper bars': '<:copperbars:1338806831145025567>',
    'clothing': '<:Clothing:1338808112156770325>',
    'coal': '<:Coal:1337121696498319360>',
    'chemicals': '<:Chemicals:1338808086315401249>',
    'cars': '<:Cars:1338808680145227867>',
    'boards': '<:Boards:1338805375939641395>',
    'bauxite': '<:Bauxite:1338808311696326726>',
    'aluminium': '<:Aluminium:1338808428268617760>'
};

client.on('messageCreate', async (message) => {
    if (message.author.bot) return; // Ignorer les messages des bots

    const messageContent = message.content.toLowerCase();
    
    for (const [keyword, emoji] of Object.entries(emojiMap)) {
        if (messageContent.includes(keyword)) {
            try {
                await message.react(emoji);
            } catch (error) {
                console.error(`Erreur lors de la réaction avec ${emoji}:`, error);
            }
        }
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Filter prohibited words and apply a timeout
    const forbiddenWords = ["fuck", "shit", "bitch", "asshole", "bastard"];
    if (forbiddenWords.some(word => message.content.toLowerCase().includes(word))) {
        if (!message.member.moderatable) return;
        
        try {
            await message.member.timeout(600000, "Use of prohibited words");
            await message.reply(`🔇 ${message.author} has been muted and cannot write or react for 10 minutes.`);
        } catch (error) {
            console.error("Error during sanction:", error);
            await message.reply("❌ An error occurred while applying the sanction.");
        }
    }
});

const SUPPORT_CHANNEL_ID = '1342154427401895936'; // ID of the support channel
const messageMap = new Map();
const REACTION_MAP = {
    '✅': '✅', '❌': '❌', '🔥': '🔥', '💬': '💬', '🔄': '🔄',
    '🚀': '🚀', '👍': '👍', '🎉': '🎉', '🥳': '🥳'
};

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // --- Gestion des DMs entrants ---
    if (message.channel.type === 1) { // DM
        console.log(`📩 DM received from ${message.author.tag}: ${message.content}`);

        try {
            const supportChannel = await client.channels.fetch(SUPPORT_CHANNEL_ID);

            if (!supportChannel || !supportChannel.isTextBased()) {
                return console.error("❌ Support channel not found or invalid type.");
            }

            let content = message.content || "*No text*";

            // Ajouter les fichiers joints
            if (message.attachments.size > 0) {
                const attachments = message.attachments.map(att => att.url).join('\n');
                content += `\n📎 **Attachments:**\n${attachments}`;
            }

            const sentMessage = await supportChannel.send(`📩 **New DM from ${message.author.tag}:**\n${content}`);

            await message.react('✉️');
            messageMap.set(sentMessage.id, message);
            console.log(`🔗 DM message linked to the support channel message.`);
        } catch (error) {
            console.error(`❌ Error fetching support channel:`, error);
        }
    }

    // --- Commande !DM (utilisateur ou rôle) ---
    if (message.content.startsWith('!DM')) {
        if (!message.member.permissions.has('ManageMessages')) {
            return message.reply("🚫 You do not have permission to do this.");
        }

        const args = message.content.split(' ').slice(1);
        const mention = message.mentions.users.first() || message.mentions.roles.first();

        if (!mention) return message.reply("❌ You must mention a user **or** a role!");

        const replyMessage = args.slice(1).join(' ') || "*No text*";

        if (mention instanceof require('discord.js').User) {
            // Envoi à un utilisateur
            try {
                console.log(`📢 Sending a message to ${mention.tag}: ${replyMessage}`);
                await mention.send(replyMessage);
                message.reply(`📩 Message sent to ${mention.tag}`);

                const supportMessage = await message.channel.send(`📨 **Message sent to ${mention.tag}:**\n${replyMessage}`);
                messageMap.set(supportMessage.id, replyMessage);
                console.log(`🔗 DM response recorded in the support channel.`);
            } catch (error) {
                console.error(`❌ Error sending DM:`, error);
                message.reply("❌ Failed to send the message.");
            }
        } else if (mention instanceof require('discord.js').Role) {
    // Envoi à un rôle
    const role = mention;
    const members = role.members.filter(member => !member.user.bot); // Ignorer les bots

    if (members.size === 0) {
        return message.reply("⚠️ No human members found in that role.");
    }

    let sentCount = 0;
    message.reply(`📤 Sending messages to ${members.size} members in role **${role.name}**...`);

    members.forEach(async (member) => {
        try {
            // Personnalisation ici 👇
            const personalizedMessage = replyMessage
                .replace(/{{mention}}/g, `<@${member.id}>`)
                .replace(/{{username}}/g, member.user.username)
                .replace(/{{tag}}/g, member.user.tag);

            await member.send(personalizedMessage);
            sentCount++;
        } catch (err) {
            console.error(`❌ Couldn't DM ${member.user.tag}:`, err);
        }
    });

    message.channel.send(`✅ Message sent to ${sentCount}/${members.size} members of **${role.name}**.`);
}

    }
});






client.once('ready', async () => {
    console.log(`Connecté en tant que ${client.user.tag}`);
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) return;

    const paxCommand = new SlashCommandBuilder()
        .setName('pax')
        .setDescription('Calcule le temps estimé pour la livraison')
        .addNumberOption(option => option.setName('total').setDescription('Quantité totale').setRequired(true))
        .addNumberOption(option => option.setName('actuel').setDescription('Quantité actuelle').setRequired(true))
        .addNumberOption(option => option.setName('tendance').setDescription('Tendance en %').setRequired(true));
    
    await guild.commands.create(paxCommand);
    console.log("/pax command registered");
});

client.on('messageCreate', message => {
    if (message.author.bot) return;
    
    if (message.content.startsWith('!pax')) {
        const args = message.content.split(' ').slice(1);
        if (args.length < 3) {
            return message.reply('Usage : `!pax <quantité totale> <quantité actuelle> <tendance>`');
        }
        
        const total = parseFloat(args[0]);
        const actuel = parseFloat(args[1]);
        let tendance = args[2].replace('%', '');
        tendance = parseFloat(tendance) / 100; 

        if (isNaN(total) || isNaN(actuel) || isNaN(tendance) || total <= 0 || actuel < 0 || tendance <= 0) {
            return message.reply('Merci de fournir des nombres valides.');
        }

        const pourcentageLivré = actuel / total;
        const tempsRestantJours = ((1 - pourcentageLivré) / (tendance * 4)) / 24;
        const tempsRestantHeures = tempsRestantJours * 24;
        const heures = Math.floor(tempsRestantHeures);
        const minutes = Math.round((tempsRestantHeures - heures) * 60);

        // Calcul de la date de fin
        const now = Date.now(); // Temps actuel en millisecondes
        const tempsRestantMs = tempsRestantHeures * 3600000; // Conversion des heures en millisecondes
        const dateFin = now + tempsRestantMs; // Date de fin estimée

        // Convertir la date de fin en timestamp Unix
        const timestampFin = Math.floor(dateFin / 1000); // Conversion en secondes

        // Ajout du séparateur de milliers pour les valeurs numériques
        const totalFormatted = total.toLocaleString();
        const actuelFormatted = actuel.toLocaleString();
        const heuresFormatted = heures.toLocaleString();
        const minutesFormatted = minutes.toLocaleString();

        // Format du message
        message.reply(`
📊 **PAX Report** 

✈️ **Total Passengers**: ${totalFormatted}  
📦 **Current Quantity**: ${actuelFormatted} (${(pourcentageLivré * 100).toFixed(2)}% delivered)  
📈 **Trend**: ${(tendance * 100).toFixed(2)}%  
⏳ **Estimated Completion**: <t:${timestampFin}:R>
        `);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    if (interaction.commandName !== 'pax') return;

    const total = interaction.options.getNumber('total');
    const actuel = interaction.options.getNumber('actuel');
    const tendance = interaction.options.getNumber('tendance') / 100;

    if (total <= 0 || actuel < 0 || tendance <= 0) {
        return interaction.reply({ content: 'Merci de fournir des nombres valides.', ephemeral: true });
    }

    const pourcentageLivré = actuel / total;
    const tempsRestantJours = ((1 - pourcentageLivré) / (tendance * 4)) / 24;
    const tempsRestantHeures = tempsRestantJours * 24;
    const heures = Math.floor(tempsRestantHeures);
    const minutes = Math.round((tempsRestantHeures - heures) * 60);

    // Calcul de la date de fin
    const now = Date.now(); // Temps actuel en millisecondes
    const tempsRestantMs = tempsRestantHeures * 3600000; // Conversion des heures en millisecondes
    const dateFin = now + tempsRestantMs; // Date de fin estimée

    // Convertir la date de fin en timestamp Unix
    const timestampFin = Math.floor(dateFin / 1000); // Conversion en secondes

    // Ajout du séparateur de milliers pour les valeurs numériques
    const totalFormatted = total.toLocaleString();
    const actuelFormatted = actuel.toLocaleString();
    const heuresFormatted = heures.toLocaleString();
    const minutesFormatted = minutes.toLocaleString();

    // Format du message
    interaction.reply(`
📊 **PAX Report** 

✈️ **Total Passengers**: ${totalFormatted}  
📦 **Current Quantity**: ${actuelFormatted} (${(pourcentageLivré * 100).toFixed(2)}% delivered)  
📈 **Trend**: ${(tendance * 100).toFixed(2)}%  
⏳ **Estimated Completion**: <t:${timestampFin}:R>
    `);
});
client.on('messageCreate', (message) => {
    if (message.author.bot) return;
    
    if (message.content === '!hour') {
        const timezones = [
            { pays: "🇫🇷 France", capitale: "Paris", zone: "Europe/Paris" },
            { pays: "🇺🇸 United States", capitale: "New York", zone: "America/New_York" },
            { pays: "🇨🇳 China", capitale: "Beijing", zone: "Asia/Shanghai" },
            { pays: "🇯🇵 Japan", capitale: "Tokyo", zone: "Asia/Tokyo" },
            { pays: "🇦🇺 Australia", capitale: "Sydney", zone: "Australia/Sydney" },
            { pays: "🇧🇷 Brazil", capitale: "Brasília", zone: "America/Sao_Paulo" },
            { pays: "🇷🇺 Russia", capitale: "Moscow", zone: "Europe/Moscow" },
            { pays: "🇬🇧 United Kingdom", capitale: "London", zone: "Europe/London" },
            { pays: "🇮🇳 India", capitale: "New Delhi", zone: "Asia/Kolkata" },
            { pays: "🇨🇦 Canada", capitale: "Ottawa", zone: "America/Toronto" },
            { pays: "🇦🇷 Argentina", capitale: "Buenos Aires", zone: "America/Argentina/Buenos_Aires" },
            { pays: "🇿🇦 South Africa", capitale: "Pretoria", zone: "Africa/Johannesburg" },
            { pays: "🇩🇪 Germany", capitale: "Berlin", zone: "Europe/Berlin" },
            { pays: "🇹🇷 Turkey", capitale: "Ankara", zone: "Europe/Istanbul" },
            { pays: "🇲🇽 Mexico", capitale: "Mexico City", zone: "America/Mexico_City" }
        ];

        let messageContent = "**🕰️ Current time in 15 cities around the world:**\n";
        timezones.forEach(tz => {
            const heure = moment().tz(tz.zone).format("HH:mm");
            messageContent += `**${tz.pays} - ${tz.capitale}:** 🕒 ${heure}\n`;
        });

        message.channel.send(messageContent);
    }
});
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.startsWith('!whohas')) {
        const roleId = "1339645241577439282"; // ID du rôle à rechercher

        // Récupération du rôle par ID
        const role = message.guild.roles.cache.get(roleId);

        if (!role) {
            return message.reply("❌ Ce rôle n'existe pas ou n'est pas accessible !");
        }

        try {
            // S'assurer que tous les membres sont chargés
            await message.guild.members.fetch();

            // Filtrer les membres ayant le rôle
            const membersWithRole = message.guild.members.cache.filter(member => 
                member.roles.cache.has(role.id)
            );

            if (membersWithRole.size === 0) {
                return message.reply(`📭 Aucun membre ne possède le rôle **${role.name}**.`);
            }

            // Générer la liste des membres avec leur ID
            const memberList = membersWithRole.map(member => `- **${member.user.tag}** (${member.id})`).join("\n");

            // Vérifier la limite Discord de 2000 caractères
            if (memberList.length > 2000) {
                return message.reply("⚠ Trop de membres pour afficher la liste !");
            }

            return message.reply(`📜 Voici la liste des membres ayant le rôle **${role.name}** :\n${memberList}`);

        } catch (error) {
            console.error("Erreur lors de la récupération des membres :", error);
            return message.reply("❌ Une erreur est survenue lors de la récupération des membres.");
        }
    }
});
client.on('messageCreate', (message) => {
    if (message.author.bot) return;
    
    if (message.content === '!hour') {
        const timezones = [
            { pays: "🇫🇷 France", capitale: "Paris", zone: "Europe/Paris" },
            { pays: "🇺🇸 United States", capitale: "New York", zone: "America/New_York" },
            { pays: "🇨🇳 China", capitale: "Beijing", zone: "Asia/Shanghai" },
            { pays: "🇯🇵 Japan", capitale: "Tokyo", zone: "Asia/Tokyo" },
            { pays: "🇦🇺 Australia", capitale: "Sydney", zone: "Australia/Sydney" },
            { pays: "🇧🇷 Brazil", capitale: "Brasília", zone: "America/Sao_Paulo" },
            { pays: "🇷🇺 Russia", capitale: "Moscow", zone: "Europe/Moscow" },
            { pays: "🇬🇧 United Kingdom", capitale: "London", zone: "Europe/London" },
            { pays: "🇮🇳 India", capitale: "New Delhi", zone: "Asia/Kolkata" },
            { pays: "🇨🇦 Canada", capitale: "Ottawa", zone: "America/Toronto" },
            { pays: "🇦🇷 Argentina", capitale: "Buenos Aires", zone: "America/Argentina/Buenos_Aires" },
            { pays: "🇿🇦 South Africa", capitale: "Pretoria", zone: "Africa/Johannesburg" },
            { pays: "🇩🇪 Germany", capitale: "Berlin", zone: "Europe/Berlin" },
            { pays: "🇹🇷 Turkey", capitale: "Ankara", zone: "Europe/Istanbul" },
            { pays: "🇲🇽 Mexico", capitale: "Mexico City", zone: "America/Mexico_City" }
        ];

        let messageContent = "**🕰️ Current time in 15 cities around the world:**\n";
        timezones.forEach(tz => {
            const heure = moment().tz(tz.zone).format("HH:mm");
            messageContent += `**${tz.pays} - ${tz.capitale}:** 🕒 ${heure}\n`;
        });

        message.channel.send(messageContent);
    }
});
const thumbnailUrl = "https://cdn-icons-png.flaticon.com/512/2464/2464317.png";
const roleMention = "<@&1339645241577439282>"; // Mention du rôle
const megaquizChannelId = "1356272324059594852"; // ID du canal où les logs seront envoyés

const megaquizQuestion = [
    {
    question: `🇫🇷 Combien de bâtiments compte la gare ?\n
🇬🇧 How many buildings are there in the station?\n
🇩🇪 Wie viele Gebäude gibt es im Bahnhof?\n
🇪🇸 ¿Cuántos edificios hay en la estación?\n
🇵🇹 Quantos edifícios há na estação?\n
🇵🇱 Ile budynków jest na stacji?\n
🇷🇺 Сколько зданий на станции?\n
🇺🇦 Скільки будівель на станції?`,
    options: ["254", "264", "274", "284"],
    correct: 1
},

{
    question: `🇫🇷 Quel est le niveau maximum qu’une ville peut atteindre en époque 4 ?\n
🇬🇧 What is the maximum level a city can reach in era 4?\n
🇩🇪 Was ist das maximale Niveau, das eine Stadt in Epoche 4 erreichen kann?\n
🇪🇸 ¿Cuál es el nivel máximo que una ciudad puede alcanzar en la época 4?\n
🇵🇹 Qual é o nível máximo que uma cidade pode atingir na época 4?\n
🇵🇱 Jaki jest maksymalny poziom, jaki może osiągnąć miasto w epoce 4?\n
🇷🇺 Какой максимальный уровень может достичь город в эпохе 4?\n
🇺🇦 Який максимальний рівень може досягти місто в епосі 4?`,
    options: ["Level 24", "Level 28", "Level 30", "Level 32"],
    correct: 3
},

    
{
    question: `🇫🇷 Combien de points bonus reçoit la 7ème région sur la carte Europe ?\n
🇬🇧 How many bonus points does the 7th region receive on the Europe map?\n
🇩🇪 Wie viele Bonuspunkte erhält die 7. Region auf der Europa-Karte?\n
🇪🇸 ¿Cuántos puntos de bonificación recibe la 7ª región en el mapa de Europa?\n
🇵🇹 Quantos pontos de bônus a 7ª região recebe no mapa da Europa?\n
🇵🇱 Ile punktów bonusowych otrzymuje 7. region na mapie Europy?\n
🇷🇺 Сколько бонусных очков получает 7-й регион на карте Европы?\n
🇺🇦 Скільки бонусних балів отримує 7-й регіон на карті Європи?`,
    options: ["50000", "40000", "30000", "20000"],
    correct: 3  // L'index commence à 0, donc 20000 est à l'index 3
},

    
{
    question: `🇫🇷 À quelle époque l’inox fait-il son apparition ?\n
🇬🇧 At which era does stainless steel appear?\n
🇩🇪 In welcher Epoche erscheint Edelstahl?\n
🇪🇸 ¿En qué época aparece el acero inoxidable?\n
🇵🇹 Em que época aparece o aço inoxidável?\n
🇵🇱 W której epoce pojawia się stal nierdzewna?\n
🇷🇺 В какой эпохе появляется нержавеющая сталь?\n
🇺🇦 В якій епосі з'являється нержавіюча сталь?`,
    options: ["3", "4", "5", "6"],
    correct: 1  // L'index commence à 0, donc la bonne réponse est l'option 4 qui est à l'index 1
},

{
    question: `🇫🇷 Combien de routes spéciales existent sur les mondes du jeu Europe ?\n
🇬🇧 How many special routes exist on the Europe game worlds?\n
🇩🇪 Wie viele Sonderstrecken gibt es in den Welten des Spiels Europa?\n
🇪🇸 ¿Cuántas rutas especiales existen en los mundos del juego Europa?\n
🇵🇹 Quantas rotas especiais existem nos mundos do jogo Europa?\n
🇵🇱 Ile specjalnych tras istnieje w światach gry Europa?\n
🇷🇺 Сколько специальных маршрутов существует в мирах игры Europa?\n
🇺🇦 Скільки спеціальних маршрутів існує в світах гри Europa?`,
    options: ["22", "31", "39", "44"],
    correct: 2  // La bonne réponse est 39, qui est l'option à l'index 2
},

{
    question: `🇫🇷 Quelle a été la première animation de ces trois dernières semaines ?\n
🇬🇧 What was the first event in the past three weeks?\n
🇩🇪 Was war die erste Animation in den letzten drei Wochen?\n
🇪🇸 ¿Cuál fue la primera animación en estas tres últimas semanas?\n
🇵🇹 Qual foi a primeira animação dessas últimas três semanas?\n
🇵🇱 Jaką animację zrealizowano w pierwszej kolejności w ostatnich trzech tygodniach?\n
🇷🇺 Какая была первая анимация за последние три недели?\n
🇺🇦 Яка була перша анімація за останні три тижні?`,
    options: ["Puzzle", "Quiz", "In-game animation", "Word search"],
    correct: 0  // La bonne réponse est "Puzzle", qui est l'option à l'index 0
},

{
    question: `🇫🇷 Combien de ports sont présents sur les mondes du jeu Europe ?\n
🇬🇧 How many ports are there on the Europe game worlds?\n
🇩🇪 Wie viele Häfen gibt es in den Welten des Spiels Europa?\n
🇪🇸 ¿Cuántos puertos hay en los mundos del juego Europa?\n
🇵🇹 Quantos portos existem nos mundos do jogo Europa?\n
🇵🇱 Ile portów jest na światach gry Europa?\n
🇷🇺 Сколько портов на мирах игры Europa?\n
🇺🇦 Скільки портів на світах гри Europa?`,
    options: ["5", "7", "10", "11"],
    correct: 2  // La bonne réponse est "10", qui est l'option à l'index 2
},

{
    question: `🇫🇷 Quel est le dernier serveur d’événements qui a eu lieu en 2024 ?\n
🇬🇧 What was the last event server that took place in 2024?\n
🇩🇪 Was war der letzte Event-Server, der 2024 stattfand?\n
🇪🇸 ¿Cuál fue el último servidor de eventos que tuvo lugar en 2024?\n
🇵🇹 Qual foi o último servidor de eventos a ocorrer em 2024?\n
🇵🇱 Jaki był ostatni serwer wydarzeń, który miał miejsce w 2024 roku?\n
🇷🇺 Какой последний сервер событий был проведен в 2024 году?\n
🇺🇦 Який останній сервер подій відбувся в 2024 році?`,
    options: ["Perfect Paradise", "PlatformX", "Masters", "Destination Africa"],
    correct: 0  // La bonne réponse est "Perfect Paradise", qui est l'option à l'index 0
},

{
    question: `🇫🇷 Quel est le coût en or pour ouvrir une troisième carte et bénéficier du bonus de puissance ?\n
🇬🇧 How much gold does it cost to open a third card for the power bonus?\n
🇩🇪 Wie viel Gold kostet es, eine dritte Karte zu öffnen und den Bonus für die Macht zu erhalten?\n
🇪🇸 ¿Cuánto cuesta en oro abrir una tercera carta para el bono de poder?\n
🇵🇹 Quanto custa em ouro abrir um terceiro mapa para o bônus de potência?\n
🇵🇱 Ile kosztuje otwarcie trzeciej karty dla bonusu mocy w złocie?\n
🇷🇺 Сколько стоит открыть третью карту для бонуса мощности в золоте?\n
🇺🇦 Скільки коштує відкрити третю карту для бонусу потужності в золоті?`,
    options: ["5", "10", "15", "20"],
    correct: 3  // La bonne réponse est "20", qui est l'option à l'index 3
},

{
    question: `🇫🇷 Chaque serveur de Rail Nation possède une identification unique selon sa nationalité, son type de scénario et sa vitesse, comme US103.
    Si un nouveau serveur polonais, européen et en vitesse x2 est créé, quelle serait son identification ?\n
🇬🇧 Each Rail Nation server has a unique identifier based on its nationality, scenario type, and speed, like US103.
    If a new Polish, European server with x2 speed is created, what would its identifier be?\n
🇩🇪 Wenn ein neuer polnischer, europäischer Server mit x2 Geschwindigkeit erstellt wird, wie würde er sich identifizieren?\n
🇪🇸 Cada servidor de Rail Nation tiene un identificador único según su nacionalidad, tipo de escenario y velocidad, como US103.
    Si se crea un nuevo servidor polaco, europeo y con velocidad x2, ¿cuál sería su identificación?\n
🇵🇹 Cada servidor do Rail Nation tem uma identificação única com base na sua nacionalidade, tipo de cenário e velocidade, como US103.
    Se for criado um novo servidor polaco, europeu e com velocidade x2, qual seria a sua identificação?\n
🇵🇱 Każdy serwer w grze Rail Nation ma unikalny identyfikator w zależności od narodowości, typu scenariusza i prędkości, jak np. US103.
    Jeśli zostanie utworzony nowy polski, europejski serwer z prędkością x2, jaki będzie jego identyfikator?\n
🇷🇺 Каждый сервер Rail Nation имеет уникальный идентификатор, основанный на его национальности, типе сценария и скорости, как US103.
    Если будет создан новый польский, европейский сервер с x2 скоростью, какой будет его идентификатор?\n
🇺🇦 Кожен сервер Rail Nation має унікальний ідентифікатор на основі його національності, типу сценарію та швидкості, як US103.
    Якщо буде створено новий польський, європейський сервер з x2 швидкістю, який буде його ідентифікатор?`,
    options: ["PL3", "PL202", "PL203", "PL102"],
    correct: 1  // La bonne réponse est "PL202", qui est l'option à l'index 1
},

{
    question: `🇫🇷 Quel indicateur n’a aucun impact sur le classement régional (SOE) ?\n
🇬🇧 Which indicator does not affect the regional ranking (SOE)?\n
🇩🇪 Welcher Indikator hat keinen Einfluss auf das regionale Ranking (SOE)?\n
🇪🇸 ¿Qué indicador no afecta al ranking regional (SOE)?\n
🇵🇹 Qual indicador não impacta o ranking regional (SOE)?\n
🇵🇱 Jaki wskaźnik nie wpływa na ranking regionalny (SOE)?\n
🇷🇺 Какой индикатор не влияет на региональный рейтинг (SOE)?\n
🇺🇦 Який індикатор не впливає на регіональний рейтинг (SOE)?`,
    options: ["L’association", "le niveau de sa ville", "ses points de prestige", "le niveau de son monument"],
    correct: 0  // La bonne réponse est "L’association", qui est l'option à l'index 0
},

{
    question: `🇫🇷 Au niveau 12 d’un monument, quel est le nombre minimum de biens à livrer ?\n
🇬🇧 At level 12 of a monument, what is the minimum number of goods to deliver?\n
🇩🇪 Wie viele Güter müssen auf Stufe 12 eines Denkmals mindestens geliefert werden?\n
🇪🇸 En el nivel 12 de un monumento, ¿cuántos bienes como mínimo se deben entregar?\n
🇵🇹 No nível 12 de um monumento, qual é o número mínimo de bens a serem entregues?\n
🇵🇱 Na poziomie 12 pomnika, ile minimum towarów należy dostarczyć?\n
🇷🇺 На уровне 12 монумента, какое минимальное количество товаров нужно доставить?\n
🇺🇦 На рівні 12 монумента, яка мінімальна кількість товарів повинна бути доставлена?`,
    options: ["11", "13", "15", "17"],
    correct: 2  // La bonne réponse est "15", l'option à l'index 2
},

{
    question: `🇫🇷 Quel travailleur est disponible à l’achat dans American Dream ?\n
🇬🇧 Which worker is available for purchase in American Dream?\n
🇩🇪 Welcher Arbeiter ist im American Dream zum Kauf verfügbar?\n
🇪🇸 ¿Qué trabajador está disponible para comprar en American Dream?\n
🇵🇹 Qual trabalhador está disponível para compra no American Dream?\n
🇵🇱 Który pracownik jest dostępny do zakupu w American Dream?\n
🇷🇺 Какой работник доступен для покупки в American Dream?\n
🇺🇦 Який працівник доступний для покупки в American Dream?`,
    options: ["Richard Arkwright", "Pullman", "Agatha Christie", "Franz Sacher"],
    correct: 0  // La bonne réponse est "Richard Arkwright", l'option à l'index 0
},

{
    question: `🇫🇷 Combien de points de prestige bonus sont attribués en cas de victoire lors du duel Est-Ouest ?\n
🇬🇧 How many bonus prestige points are awarded for winning the East-West duel?\n
🇩🇪 Wie viele Bonusprestigepunkte werden für den Sieg im Ost-West-Duell vergeben?\n
🇪🇸 ¿Cuántos puntos de prestigio adicional se otorgan por ganar el duelo Este-Oeste?\n
🇵🇹 Quantos pontos de prestígio bônus são atribuídos quando se vence o duelo Leste-Oeste?\n
🇵🇱 Ile punktów prestiżu bonusowych otrzymuje się za zwycięstwo w pojedynku Wschód-Zachód?\n
🇷🇺 Сколько бонусных очков престижа присваивается за победу в дуэле Восток-Запад?\n
🇺🇦 Скільки бонусних балів престижу надається за перемогу в дуелі Схід-Захід?`,
    options: ["10000", "20000", "50000", "70000"],
    correct: 1  // La bonne réponse est "20000", l'option à l'index 1
},

{
    question: `🇫🇷 Quel est le nombre total de biens disponibles dans American Dream ?\n
🇬🇧 What is the total number of goods available in American Dream?\n
🇩🇪 Wie viele Güter sind im American Dream insgesamt verfügbar?\n
🇪🇸 ¿Cuántos bienes están disponibles en total en American Dream?\n
🇵🇹 Qual é o número total de bens disponíveis no American Dream?\n
🇵🇱 Jaka jest łączna liczba towarów dostępnych w American Dream?\n
🇷🇺 Сколько всего товаров доступно в American Dream?\n
🇺🇦 Скільки всього товарів доступно в American Dream?`,
    options: ["45", "46", "47", "48"],
    correct: 2  // La bonne réponse est "47", l'option à l'index 2
},

{
    question: `🇫🇷 À partir de quelle époque peut-on débloquer les emballages ?\n
🇬🇧 At which era can packaging be unlocked?\n
🇩🇪 Ab welcher Epoche können Verpackungen freigeschaltet werden?\n
🇪🇸 ¿En qué época se pueden desbloquear los empaques?\n
🇵🇹 A partir de que época os pacotes podem ser desbloqueados?\n
🇵🇱 Od której epoki można odblokować opakowania?\n
🇷🇺 С какой эпохи можно разблокировать упаковку?\n
🇺🇦 З якої епохи можна розблокувати упаковку?`,
    options: ["2", "3", "4", "5"],
    correct: 1  // La bonne réponse est "3", l'option à l'index 1
},

{
    question: `🇫🇷 Quel est le nombre maximal de joueurs pouvant rejoindre une association ?\n
🇬🇧 What is the maximum number of players who can join an association?\n
🇩🇪 Wie viele Spieler können maximal einer Vereinigung beitreten?\n
🇪🇸 ¿Cuál es el número máximo de jugadores que pueden unirse a una asociación?\n
🇵🇹 Qual é o número máximo de jogadores que podem se juntar a uma associação?\n
🇵🇱 Jaka jest maksymalna liczba graczy, którzy mogą dołączyć do stowarzyszenia?\n
🇷🇺 Сколько игроков могут присоединиться к ассоциации?\n
🇺🇦 Скільки гравців можуть приєднатися до асоціації?`,
    options: ["24", "25", "26", "27"],
    correct: 2  // La bonne réponse est "26", l'option à l'index 2
},

{
    question: `🇫🇷 Quel joueur de l’association possède le meilleur classement carrière ?\n
🇬🇧 Which player in the association has the best career ranking?\n
🇩🇪 Welcher Spieler in der Vereinigung hat das beste Karriereranking?\n
🇪🇸 ¿Qué jugador en la asociación tiene el mejor ranking de carrera?\n
🇵🇹 Qual jogador na associação possui o melhor ranking de carreira?\n
🇵🇱 Który gracz w stowarzyszeniu ma najlepszy ranking kariery?\n
🇷🇺 Какой игрок в ассоциации имеет лучший карьерный рейтинг?\n
🇺🇦 Який гравець в асоціації має найкращий рейтинг кар'єри?`,
    options: ["Bonnie and Clyde", "Jomaro", "TAnderson", "Robsi"],
    correct: 0  // La bonne réponse est "Bonnie and Clyde", l'option à l'index 0
},

{
    question: `🇫🇷 Combien de nouvelles marchandises ont été ajoutées dans Viva Italia ?\n
🇬🇧 How many new goods were added in Viva Italia?\n
🇩🇪 Wie viele neue Waren wurden in Viva Italia hinzugefügt?\n
🇪🇸 ¿Cuántas nuevas mercancías se añadieron en Viva Italia?\n
🇵🇹 Quantos novos bens foram adicionados em Viva Italia?\n
🇵🇱 Ile nowych towarów dodano w Viva Italia?\n
🇷🇺 Сколько новых товаров было добавлено в Viva Italia?\n
🇺🇦 Скільки нових товарів було додано в Viva Italia?`,
    options: ["14", "16", "18", "22"],
    correct: 1  // La bonne réponse est "16", l'option à l'index 1
},

{
    question: `🇫🇷 Combien de villes sont présentes dans Viva Italia ?\n
🇬🇧 How many cities are there in Viva Italia?\n
🇩🇪 Wie viele Städte gibt es in Viva Italia?\n
🇪🇸 ¿Cuántas ciudades hay en Viva Italia?\n
🇵🇹 Quantas cidades existem em Viva Italia?\n
🇵🇱 Ile miast jest w Viva Italia?\n
🇷🇺 Сколько городов в Viva Italia?\n
🇺🇦 Скільки міст у Viva Italia?`,
    options: ["20", "25", "30", "40"],
    correct: 0  // La bonne réponse est "20", l'option à l'index 0
}

                                       
];

const quizData = new Map();
const correctAnswers = new Map();
const totalAnswers = new Map();
let quizInProgress = false;
let currentQuestionIndex = -1;
let currentQuestionTimeout;
let quizTimeout = null; // Stocke l'ID du timeout
let quizCollector = null; // Stocke le collecteur de réponses

client.on('messageCreate', async (message) => {
    const args = message.content.split(' ');

    if (args[0].toLowerCase() === '!megaquiz' && !quizInProgress) {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply("🚫 Seuls les administrateurs peuvent lancer le MegaQuiz.");
        }
    
        quizInProgress = true;
        
        let startTime;
        if (args[1]) {
            const now = new Date();
            const [hours, minutes] = args[1].split(':').map(Number);
            const startDate = new Date(now);
            startDate.setHours(hours, minutes, 0, 0);
            if (startDate < now) startDate.setDate(startDate.getDate() + 1); // Si l'heure est passée, prend le jour suivant
            startTime = Math.floor(startDate.getTime() / 1000);
        } else {
            startTime = Math.floor((Date.now() + 30000) / 1000); // 30 secondes par défaut
        }
        
        const timeRemainingFormatted = `<t:${startTime}:t>`; // Format HH:MM pour Discord

        const announcementEmbed = {
            color: 0x0099ff,
            title: '🚆 The mega-quiz is scheduled! 🚆',
            description: `
📜 **Rules:**
- ✅ Correct answer: +30pts  
- ❌ Wrong answer: -10pts  
- ⏳ No answer: 0pts  
- 🏆 Bonus: +50pts for the first 3 correct answers!  

📝 **Quiz Details:**  
- There will be **20 questions**, all related to **Rail Nation**.  
- Some questions are past **QOTDs** where the average score was too low.  
- You will have **45 seconds** to answer each question.  

⏳ The quiz will start at: ${timeRemainingFormatted}`,
            thumbnail: { url: thumbnailUrl },
        };

        await message.channel.send({
            content: roleMention + " The quiz will start soon! ⏳",
            embeds: [announcementEmbed]
        });

        const delay = startTime * 1000 - Date.now(); // Temps jusqu'à l'heure de début

        quizTimeout = setTimeout(() => {
            startQuiz(message.channel);
            quizTimeout = null; // Réinitialiser après démarrage
        }, delay);

    } else if (message.content.toLowerCase() === '!stopmegaquiz' && quizInProgress) {
        quizInProgress = false;
        
        // Annule le démarrage du quiz si le timer est actif
        if (quizTimeout) {
            clearTimeout(quizTimeout);
            quizTimeout = null;
        }

        // Arrête le collecteur si une question est en cours
        if (quizCollector) {
            quizCollector.stop(); // Arrête immédiatement la collecte des réponses
            quizCollector = null;
        }

        message.channel.send("🛑 **MegaQuiz has been stopped!**");
    }
});





// Fonction pour démarrer le quiz
async function startQuiz(channel) {
    currentQuestionIndex = 0;
    await askQuestion(channel, currentQuestionIndex);
}

async function askQuestion(channel, index) {
    if (index >= megaquizQuestion.length) return;

    const q = megaquizQuestion[index];
    const endTime = Date.now() + 45000;  // 45 secondes pour la question

    // Fonction pour générer l'embed
    function generateEmbed(timeRemaining) {
        const isRed = timeRemaining <= 10;  // Vérifie si le temps restant est <= 10 secondes
        const color = isRed ? 0xFF0000 : 0x0099ff;  // Rouge si <= 10 sec, bleu sinon
        const timeRemainingFormatted = `<t:${Math.floor(endTime / 1000)}:R>`;  // Format du timer Discord
    
        // Génère le leaderboard à afficher
        const sortedScores = Array.from(quizData.entries()).sort((a, b) => b[1] - a[1]);
        const leaderboard = sortedScores.map(([user, score], index) => `**${index + 1}.** <@${user}> - **${score}pts**`).join("\n");
    
        return {
            color: color,
            title: `Question ${index + 1}/${megaquizQuestion.length}`,
            description: `❓ **${q.question}**\n${q.options.map((option, i) => `${i + 1}. ${option}`).join('\n')}\n\n` +
                `⏳ **Time remaining:** ${timeRemainingFormatted}\n\n` +
                `🏅 **Current leaderboard:**\n${leaderboard}`,
            thumbnail: { url: thumbnailUrl },
        };
    }
    

    const embed = generateEmbed(45);  // Embed avec 45 secondes au départ
    const buttons = q.options.map((option, i) =>
        new ButtonBuilder()
            .setCustomId(`quiz_${i}`)
            .setLabel(option)
            .setStyle(ButtonStyle.Primary)
    );

    const row = new ActionRowBuilder().addComponents(...buttons);
    const quizMessage = await channel.send({ embeds: [embed], components: [row] });

    const collector = quizMessage.createMessageComponentCollector({ time: 45000 });  // Collecte pendant 45 secondes

    const answeredUsers = new Map();
    const answers = { correct: 0, incorrect: 0 };
    let correctAnswerCount = 0;

    collector.on('collect', async (interaction) => {
        if (answeredUsers.has(interaction.user.id)) {
            return interaction.reply({ content: "❌ You have already answered!", ephemeral: true });
        }

        answeredUsers.set(interaction.user.id, interaction.customId.split('_')[1]);

        let score = quizData.get(interaction.user.id) || 0;
        const choice = parseInt(interaction.customId.split('_')[1]);

        if (choice === q.correct) {
            correctAnswerCount++;
            if (correctAnswerCount <= 3) {
                score += 80;
                await interaction.reply({ content: `✅ Correct! +80pts (bonus)`, ephemeral: true });
            } else {
                score += 30;
                await interaction.reply({ content: `✅ Correct! +30pts`, ephemeral: true });
            }
            quizData.set(interaction.user.id, score);
            correctAnswers.set(interaction.user.id, true);
            answers.correct++;
        } else {
            score -= 10;
            quizData.set(interaction.user.id, score);
            correctAnswers.set(interaction.user.id, false);
            answers.incorrect++;
            await interaction.reply({ content: "❌ Wrong answer, -10pts", ephemeral: true });
        }

        totalAnswers.set(interaction.user.id, true);

        // Logs dans le canal
const logChannel = client.channels.cache.get(megaquizChannelId);
if (logChannel) {
    const username = interaction.user.username;  // Récupère le pseudo de l'utilisateur
    const userAnswer = q.options[choice];  // Récupère la réponse choisie
    const points = (choice === q.correct) ? (correctAnswerCount <= 3 ? '+80pts (bonus)' : '+30pts') : '-10pts';  // Points attribués

    // Envoie du message dans le canal de logs
    logChannel.send(`${username} a répondu "${userAnswer}". ${points}`);
}


        // Récupère et affiche le classement après une réponse
        const sortedScoresAfterAnswer = Array.from(quizData.entries()).sort((a, b) => b[1] - a[1]);
        const updatedLeaderboard = sortedScoresAfterAnswer.map(([user, score], index) => `**${index + 1}.** <@${user}> - **${score}pts**`).join("\n");

        const timeRemaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));  // Calcule le temps restant

const updatedEmbedAfterAnswer = generateEmbed(timeRemaining);  // Utilisation du temps restant dynamique

await quizMessage.edit({ embeds: [updatedEmbedAfterAnswer], components: [row] });

    });

    collector.on('end', async () => {
        const correctAnswer = q.options[q.correct];

        const sortedScores = Array.from(quizData.entries()).sort((a, b) => b[1] - a[1]);
        const leaderboard = sortedScores.map(([user, score], index) => `**${index + 1}.** <@${user}> - **${score}pts**`).join("\n");

        const finalEmbed = {
            color: 0x0099ff,
            title: `Question ${index + 1}/${megaquizQuestion.length}`,
            description: `❓ **${q.question}**\n✅ **Correct answer:** ${correctAnswer}\n` +
                `✅ **Correct answers:** ${answers.correct}\n❌ **Wrong answers:** ${answers.incorrect}\n\n` +
                `🏅 **Current leaderboard:**\n${leaderboard}\n\n` +
                `⏳ **Question finished!**`,
            thumbnail: { url: thumbnailUrl },
        };

        await quizMessage.edit({ embeds: [finalEmbed], components: [] });

        currentQuestionIndex++;
        if (currentQuestionIndex < megaquizQuestion.length) {
            setTimeout(() => askQuestion(channel, currentQuestionIndex), 3000);
        } else {
            quizInProgress = false;
            const finalLeaderboardEmbed = {
                color: 0x0099ff,
                title: "🏆 Final results of the MegaQuiz! 🏆",
                description: `Here is the final ranking:\n\n` + leaderboard + `\n\n🎉 Congratulations to the winners and thank you all for participating!`,
                thumbnail: { url: thumbnailUrl },
            };

            channel.send({ embeds: [finalLeaderboardEmbed] });
            channel.send(roleMention + " 🎉Thank you all for your participation! 🎊\nhttps://tenor.com/view/aplausos-minions-gif-gif-11504262469594004830");
        }
    });
}
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!role') {
        const roleToAddId = '1364963851615076394';
        const excludedRoleId = '1106576327022231722';

        const guild = message.guild;
        if (!guild) return message.reply("❌ Cette commande ne peut être utilisée que sur un serveur.");

        const roleToAdd = guild.roles.cache.get(roleToAddId);
        if (!roleToAdd) return message.reply("❌ Le rôle à ajouter n'existe pas.");

        const excludedRole = guild.roles.cache.get(excludedRoleId);
        if (!excludedRole) return message.reply("❌ Le rôle d'exclusion n'existe pas.");

        let membersUpdated = 0;

        await guild.members.fetch(); // Assure-toi que tous les membres sont bien chargés

        guild.members.cache.forEach(member => {
            if (!member.roles.cache.has(excludedRoleId) && !member.roles.cache.has(roleToAddId)) {
                member.roles.add(roleToAddId).catch(console.error);
                membersUpdated++;
            }
        });

        message.channel.send(`✅ Rôle ajouté à ${membersUpdated} membre(s) qui ne possédaient pas le rôle d'exclusion.`);
    }
});
