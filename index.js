 require('dotenv').config();

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const Database = require('better-sqlite3');

const db = new Database(process.env.DATABASE_PATH || './bot.db');

db.prepare(`
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    points INTEGER DEFAULT 0,
    lifetime_earned INTEGER DEFAULT 0,
    vip_expires INTEGER DEFAULT 0
)
`).run();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const VIP_ROLE_NAME = 'VIP';
const LIFETIME_ROLE_NAME = 'VIP GODS (LIFETIME ACCESS)';
const PNL_CHANNEL = '🏆-vip-wins';
const REDEEM_CHANNEL = '🎁-redeem-vip';

const POINTS_PER_DAY = 5;
const ONE_DAY = 24 * 60 * 60 * 1000;

function getUser(userId) {
    let user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);

    if (!user) {
        db.prepare(`
            INSERT INTO users (user_id, points, lifetime_earned, vip_expires)
            VALUES (?, 0, 0, 0)
        `).run(userId);

        user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
    }

    return user;
}

function addPoints(userId, amount) {
    getUser(userId);
    db.prepare(`
        UPDATE users
        SET points = points + ?, lifetime_earned = lifetime_earned + ?
        WHERE user_id = ?
    `).run(amount, amount, userId);
}

function removePoints(userId, amount) {
    getUser(userId);
    db.prepare(`
        UPDATE users
        SET points = points - ?
        WHERE user_id = ?
    `).run(amount, userId);
}

function addVipDays(userId, days) {
    const user = getUser(userId);
    const now = Date.now();

    const currentExpiry = user.vip_expires && user.vip_expires > now
        ? user.vip_expires
        : now;

    const newExpiry = currentExpiry + days * ONE_DAY;

    db.prepare(`
        UPDATE users
        SET vip_expires = ?
        WHERE user_id = ?
    `).run(newExpiry, userId);

    return newExpiry;
}

function formatTime(ms) {
    if (!ms || ms <= Date.now()) return 'Expired';

    const diff = ms - Date.now();
    const days = Math.floor(diff / ONE_DAY);
    const hours = Math.floor((diff % ONE_DAY) / (60 * 60 * 1000));

    return `${days} days, ${hours} hours`;
}

client.once('clientReady', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const member = message.member;

    // POINTS CHECK
    if (message.content.startsWith('!points')) {
        const targetUser = message.mentions.users.first() || message.author;
        const user = getUser(targetUser.id);

        const embed = new EmbedBuilder()
            .setColor('Blue')
            .setTitle('💎 Points Balance')
            .setDescription(`${targetUser} has **${user.points}** points.`);

        return message.reply({ embeds: [embed] });
    }

    // VIP TIME CHECK
    if (message.content === '!viptime') {
        const user = getUser(message.author.id);

        const hasLifetime = member.roles.cache.some(role => role.name === LIFETIME_ROLE_NAME);

        if (hasLifetime) {
            return message.reply('👑 You have **Lifetime VIP Access**.');
        }

        return message.reply(`⏳ Your extra VIP time: **${formatTime(user.vip_expires)}**`);
    }

    // REDEEM COMMAND
    if (message.content.startsWith('!redeem')) {
        if (message.channel.name !== REDEEM_CHANNEL) {
            return message.reply(`❌ Use this command in #${REDEEM_CHANNEL}`);
        }

        const hasLifetime = member.roles.cache.some(role => role.name === LIFETIME_ROLE_NAME);

        if (hasLifetime) {
            return message.reply('👑 You already have **Lifetime VIP Access**. No need to redeem.');
        }

        const amount = parseInt(message.content.split(' ')[1]);

        if (!amount || amount < POINTS_PER_DAY) {
            return message.reply(`❌ Use: **!redeem 5**\n5 points = 1 extra VIP day.`);
        }

        if (amount % POINTS_PER_DAY !== 0) {
            return message.reply('❌ You can only redeem multiples of 5 points. Example: **!redeem 5**, **!redeem 10**, **!redeem 25**');
        }

        const user = getUser(message.author.id);

        if (user.points < amount) {
            return message.reply(`❌ You only have **${user.points}** points.`);
        }

        const days = amount / POINTS_PER_DAY;
        removePoints(message.author.id, amount);

        const vipRole = message.guild.roles.cache.find(role => role.name === VIP_ROLE_NAME);

        if (vipRole && !member.roles.cache.has(vipRole.id)) {
            await member.roles.add(vipRole);
        }

        const newExpiry = addVipDays(message.author.id, days);

        const embed = new EmbedBuilder()
            .setColor('Gold')
            .setTitle('🔥 VIP Time Redeemed')
            .setDescription(
                `${message.author} spent **${amount} points**\n\n` +
                `💎 Reward\n+${days} extra VIP day(s)\n\n` +
                `⏳ Extra VIP Time Remaining\n${formatTime(newExpiry)}`
            );

        return message.reply({ embeds: [embed] });
    }

    // PNL IMAGE SYSTEM
    if (message.channel.name !== PNL_CHANNEL) return;

    const isVIP = member.roles.cache.some(role => role.name === VIP_ROLE_NAME);
    const isLifetime = member.roles.cache.some(role => role.name === LIFETIME_ROLE_NAME);

    if (!isVIP && !isLifetime) return;

    const hasImage = message.attachments.some(attachment =>
        attachment.contentType && attachment.contentType.startsWith('image/')
    );

    if (!hasImage) return;

    addPoints(message.author.id, 1);

    const user = getUser(message.author.id);

    const embed = new EmbedBuilder()
        .setColor('Green')
        .setTitle('💰 PNL Confirmed')
        .setDescription(
            `+1 Point awarded to ${message.author}\n\n` +
            `💎 Current Balance\n${user.points} points\n\n` +
            `📈 Total Earned\n${user.lifetime_earned} points`
        );

    message.reply({ embeds: [embed] });
});

// AUTO REMOVE EXPIRED VIP EVERY 10 MINUTES
setInterval(async () => {
    const expiredUsers = db.prepare(`
        SELECT * FROM users
        WHERE vip_expires > 0 AND vip_expires <= ?
    `).all(Date.now());

    for (const user of expiredUsers) {
        for (const guild of client.guilds.cache.values()) {
            const member = await guild.members.fetch(user.user_id).catch(() => null);
            if (!member) continue;

            const hasLifetime = member.roles.cache.some(role => role.name === LIFETIME_ROLE_NAME);
            if (hasLifetime) continue;

            const vipRole = guild.roles.cache.find(role => role.name === VIP_ROLE_NAME);

            if (vipRole && member.roles.cache.has(vipRole.id)) {
                await member.roles.remove(vipRole).catch(() => null);
            }
        }

        db.prepare('UPDATE users SET vip_expires = 0 WHERE user_id = ?').run(user.user_id);
    }
}, 10 * 60 * 1000);

client.login(process.env.TOKEN);
