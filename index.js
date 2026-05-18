require('dotenv').config();

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const VIP_ROLE_NAME = 'VIP';
const PNL_CHANNEL = '🏆-vip-wins';

const points = {};
const totalEarned = {};

client.once('ready', () => {
    console.log('Bot is online');
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.channel.name !== PNL_CHANNEL) return;

    const isVIP = message.member.roles.cache.some(role => role.name === VIP_ROLE_NAME);
    if (!isVIP) return;

    const hasImage = message.attachments.some(attachment => {
        return attachment.contentType && attachment.contentType.startsWith('image/');
    });

    if (!hasImage) return;

    if (!points[message.author.id]) points[message.author.id] = 0;
    if (!totalEarned[message.author.id]) totalEarned[message.author.id] = 0;

    points[message.author.id]++;
    totalEarned[message.author.id]++;

    const embed = new EmbedBuilder()
        .setColor('Green')
        .setTitle('PNL Detected!')
        .setDescription(
            '+1 Point awarded to ' + message.author.toString() +
            '\n\nCurrent Points\n' + points[message.author.id] + ' points' +
            '\n\nTotal Earned\n' + totalEarned[message.author.id] + ' points'
        );

    message.reply({ embeds: [embed] });
});

client.login(process.env.TOKEN);

