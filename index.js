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

client.once('clientReady', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // CHECK POINTS COMMAND
    if (message.content.startsWith('!points')) {
        const mentionedUser = message.mentions.users.first();
        const targetUser = mentionedUser || message.author;

        if (!points[targetUser.id]) points[targetUser.id] = 0;

        const embed = new EmbedBuilder()
            .setColor('Blue')
            .setTitle('💎 Points Balance')
            .setDescription(`${targetUser} has **${points[targetUser.id]}** points.`);

        return message.reply({ embeds: [embed] });
    }

    // ONLY PNL CHANNEL
    if (message.channel.name !== PNL_CHANNEL) return;

    // VIP ROLE CHECK
    const isVIP = message.member.roles.cache.some(role => role.name === VIP_ROLE_NAME);
    if (!isVIP) return;

    // IMAGE CHECK
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
        .setTitle('💰 PNL Confirmed!')
        .setDescription(
            '+1 Point awarded to ' + message.author.toString() +
            '\n\n📈 Current Points\n' + points[message.author.id] + ' points' +
            '\n\n🔥 Lifetime Earned\n' + totalEarned[message.author.id] + ' points'
        );

    message.reply({ embeds: [embed] });
});

client.login(process.env.TOKEN);


