import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits,
  ActivityType,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';

const dataPath = path.resolve('data.json');
const configPath = path.resolve('config.json');

const defaultConfig = {
  token: '',
  prefix: '!',
};

let config = defaultConfig;
let data = {};

async function loadConfig() {
  dotenv.config();

 const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`HTTP server listening on port ${PORT}`);
});
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    config = { ...defaultConfig, ...JSON.parse(raw), ...envConfig };
  } catch (error) {
    config = { ...defaultConfig, ...envConfig };
  }

  if (!config.token) {
    console.error('Discord bot token is required via DISCORD_TOKEN in .env or config.json.');
    process.exit(1);
  }
}

async function loadData() {
  try {
    const raw = await fs.readFile(dataPath, 'utf8');
    data = JSON.parse(raw || '{}');
  } catch (error) {
    data = {};
  }
}

async function saveData() {
  try {
    await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save data.json:', error.message);
  }
}

function ensureGuildData(guildId) {
  if (!data[guildId]) {
    data[guildId] = {
      analytics: {
        joins: 0,
        leaves: 0,
        messages: 0,
        channelMessages: {},
        userMessages: {},
        userReactions: {},
        joinHistory: [],
        leaveHistory: [],
      },
      memory: {},
    };
  } else {
    // Ensure all properties exist in existing data
    if (!data[guildId].analytics) {
      data[guildId].analytics = {};
    }
    data[guildId].analytics.joins ??= 0;
    data[guildId].analytics.leaves ??= 0;
    data[guildId].analytics.messages ??= 0;
    data[guildId].analytics.channelMessages ??= {};
    data[guildId].analytics.userMessages ??= {};
    data[guildId].analytics.userReactions ??= {};
    data[guildId].analytics.joinHistory ??= [];
    data[guildId].analytics.leaveHistory ??= [];
    data[guildId].memory ??= {};
  }
  return data[guildId];
}

function recordMessage(guildId, channelId, userId) {
  const guildData = ensureGuildData(guildId);
  guildData.analytics.messages += 1;
  guildData.analytics.channelMessages[channelId] ??= 0;
  guildData.analytics.channelMessages[channelId] += 1;
  guildData.analytics.userMessages[userId] ??= 0;
  guildData.analytics.userMessages[userId] += 1;
}

function recordJoin(guildId, userId) {
  const guildData = ensureGuildData(guildId);
  guildData.analytics.joins += 1;
  guildData.analytics.joinHistory.push({ userId, timestamp: Date.now() });
  // Keep only last 100 join records
  if (guildData.analytics.joinHistory.length > 100) {
    guildData.analytics.joinHistory.shift();
  }
}

function recordLeave(guildId, userId) {
  const guildData = ensureGuildData(guildId);
  guildData.analytics.leaves += 1;
  guildData.analytics.leaveHistory.push({ userId, timestamp: Date.now() });
  // Keep only last 100 leave records
  if (guildData.analytics.leaveHistory.length > 100) {
    guildData.analytics.leaveHistory.shift();
  }
}

function buildAnalyticsOverview(guild, guildData) {
  const totalMembers = guild.memberCount ?? 'Unknown';
  const joinCount = guildData.analytics.joins;
  const leaveCount = guildData.analytics.leaves;
  const totalMessages = guildData.analytics.messages;

  const channelStats = Object.entries(guildData.analytics.channelMessages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([channelId, count]) => {
      const channel = guild.channels.cache.get(channelId);
      return channel ? `${channel.name}: ${count}` : `${channelId}: ${count}`;
    });

  return [
    `Server: **${guild.name}**`,
    `Members: **${totalMembers}**`,
    `Joins tracked: **${joinCount}**`,
    `Leaves tracked: **${leaveCount}**`,
    `Messages tracked: **${totalMessages}**`,
    '',
    `Top channels:`,
    channelStats.length ? channelStats.join('\n') : 'No channel data yet.',
  ].join('\n');
}

function hasManageServer(member) {
  return member.permissions.has(PermissionFlagsBits.ManageGuild);
}

async function main() {
  await loadConfig();
  await loadData();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });

  // Define slash commands
  const commands = [
    // Help Command
    new SlashCommandBuilder()
      .setName('help')
      .setDescription('Show all available commands'),
    // Analytics Commands
    new SlashCommandBuilder()
      .setName('server-analytics')
      .setDescription('Full server statistics dashboard'),
    new SlashCommandBuilder()
      .setName('server-growth')
      .setDescription('Member growth over time'),
    new SlashCommandBuilder()
      .setName('activity')
      .setDescription('Most active channels and users'),
    new SlashCommandBuilder()
      .setName('engagement')
      .setDescription('Messages, reactions, and participation rates'),
    new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('Top chatters, voice users, etc.'),
    new SlashCommandBuilder()
      .setName('retention')
      .setDescription('New members vs. members leaving'),
    // Members Commands
    new SlashCommandBuilder()
      .setName('userinfo')
      .setDescription('Get information about a user')
      .addUserOption(option => option.setName('user').setDescription('Target user').setRequired(false)),
    new SlashCommandBuilder()
      .setName('member-count')
      .setDescription('Get the total member count'),
    new SlashCommandBuilder()
      .setName('joined-recently')
      .setDescription('Show recently joined members'),
    new SlashCommandBuilder()
      .setName('inactive-members')
      .setDescription('Show inactive members'),
    new SlashCommandBuilder()
      .setName('roles')
      .setDescription('List all server roles'),
    new SlashCommandBuilder()
      .setName('roleinfo')
      .setDescription('Get information about a role')
      .addRoleOption(option => option.setName('role').setDescription('Target role').setRequired(false)),
    // Memory/AI Commands
    new SlashCommandBuilder()
      .setName('memory-view')
      .setDescription('View all server memories'),
    new SlashCommandBuilder()
      .setName('memory-add')
      .setDescription('Add a memory entry')
      .addStringOption(option => option.setName('key').setDescription('Memory key').setRequired(true))
      .addStringOption(option => option.setName('value').setDescription('Memory value').setRequired(true)),
    new SlashCommandBuilder()
      .setName('memory-delete')
      .setDescription('Delete a memory entry')
      .addStringOption(option => option.setName('key').setDescription('Memory key').setRequired(true)),
    new SlashCommandBuilder()
      .setName('memory-search')
      .setDescription('Search memory entries')
      .addStringOption(option => option.setName('query').setDescription('Search query').setRequired(true)),
    new SlashCommandBuilder()
      .setName('server-summary')
      .setDescription('Get a summary of server statistics'),
    new SlashCommandBuilder()
      .setName('server-history')
      .setDescription('View server activity history'),
    new SlashCommandBuilder()
      .setName('remember')
      .setDescription('Add a server memory note')
      .addStringOption(option => option.setName('content').setDescription('What to remember').setRequired(true)),
    new SlashCommandBuilder()
      .setName('forget')
      .setDescription('Remove a server memory note')
      .addStringOption(option => option.setName('id').setDescription('Memory ID to forget').setRequired(true)),
  ];

  // Register slash commands
  const rest = new REST({ version: '10' }).setToken(config.token);
  
  client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    
    try {
      console.log('Registering slash commands...');
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands.map(cmd => cmd.toJSON()) }
      );
      console.log('Slash commands registered successfully!');
    } catch (error) {
      console.error('Failed to register commands:', error);
    }

    client.user.setPresence({
      activities: [{ name: `${config.prefix}help | /server-analytics`, type: ActivityType.Listening }],
      status: 'online',
    });
  });

  client.on('guildMemberAdd', (member) => {
    recordJoin(member.guild.id, member.id);
    saveData();
  });

  client.on('guildMemberRemove', (member) => {
    recordLeave(member.guild.id, member.id);
    saveData();
  });

  client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;
    
    recordMessage(message.guild.id, message.channel.id, message.author.id);
    saveData();

    if (!message.content.startsWith(config.prefix)) return;

    const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    if (command === 'help') {
      return message.channel.send(`**Server Analytics & Memory Bot**\n
Commands:
• \`${config.prefix}analytics overview\` — Show analytics totals.
• \`${config.prefix}analytics channels\` — Show top channels by message count.
• \`${config.prefix}analytics reset\` — Reset analytics data (Manage Server required).
• \`${config.prefix}memory set <key> <value>\` — Save a server memory note.
• \`${config.prefix}memory get <key>\` — Retrieve a memory note.
• \`${config.prefix}memory delete <key>\` — Delete a memory note.
• \`${config.prefix}memory list\` — List saved memory notes.

**Slash Commands:**
• \`/server-analytics\` — Full server statistics dashboard.
• \`/userinfo\` — Get information about a user.
• \`/memory-add\` — Add a memory entry.
• \`/server-summary\` — Get a summary of server statistics.`);
    }

    if (command === 'analytics') {
      const subcommand = args.shift()?.toLowerCase();
      const guildData = ensureGuildData(message.guild.id);

      if (!subcommand || subcommand === 'overview') {
        return message.channel.send(buildAnalyticsOverview(message.guild, guildData));
      }

      if (subcommand === 'channels') {
        const channelStats = Object.entries(guildData.analytics.channelMessages)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([channelId, count], idx) => {
            const channel = message.guild.channels.cache.get(channelId);
            return `${idx + 1}. ${channel ? channel.name : channelId}: ${count}`;
          });

        return message.channel.send(`**Top Channels by Messages**\n${channelStats.length ? channelStats.join('\n') : 'No channel data yet.'}`);
      }

      if (subcommand === 'reset') {
        if (!hasManageServer(message.member)) {
          return message.reply('You need Manage Server permission to reset analytics.');
        }
        data[message.guild.id] = {
          analytics: { joins: 0, leaves: 0, messages: 0, channelMessages: {}, userMessages: {}, userReactions: {}, joinHistory: [], leaveHistory: [] },
          memory: data[message.guild.id]?.memory ?? {},
        };
        await saveData();
        return message.reply('Analytics data reset for this server.');
      }

      return message.reply('Usage: `analytics overview`, `analytics channels`, or `analytics reset`.');
    }

    if (command === 'memory') {
      const action = args.shift()?.toLowerCase();
      const guildData = ensureGuildData(message.guild.id);

      if (action === 'set') {
        const key = args.shift();
        const value = args.join(' ').trim();
        if (!key || !value) {
          return message.reply('Usage: `memory set <key> <value>`.');
        }
        guildData.memory[key] = value;
        await saveData();
        return message.reply(`Memory saved: **${key}**`);
      }

      if (action === 'get') {
        const key = args.shift();
        if (!key) {
          return message.reply('Usage: `memory get <key>`.');
        }
        const value = guildData.memory[key];
        return message.reply(value ? `**${key}**: ${value}` : `No memory found for **${key}**.`);
      }

      if (action === 'delete') {
        const key = args.shift();
        if (!key) {
          return message.reply('Usage: `memory delete <key>`.');
        }
        if (!(key in guildData.memory)) {
          return message.reply(`No memory found for **${key}**.`);
        }
        delete guildData.memory[key];
        await saveData();
        return message.reply(`Deleted memory **${key}**.`);
      }

      if (action === 'list') {
        const keys = Object.keys(guildData.memory);
        return message.channel.send(`**Saved Memory Keys**\n${keys.length ? keys.join('\n') : 'No saved memory yet.'}`);
      }

      return message.reply('Usage: `memory set|get|delete|list ...`.');
    }
  });

  // Handle slash command interactions
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guild) return;

    const guildData = ensureGuildData(interaction.guild.id);
    const commandName = interaction.commandName;

    try {
      // Help Command
      if (commandName === 'help') {
        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle('📚 Bot Commands Help')
          .addFields(
            {
              name: '📊 Analytics Commands',
              value: '`/server-analytics` — Full server statistics\n`/server-growth` — Member growth over time\n`/activity` — Most active channels and users\n`/engagement` — Messages and participation rates\n`/leaderboard` — Top chatters\n`/retention` — Member retention stats',
              inline: false
            },
            {
              name: '👥 Members Commands',
              value: '`/userinfo` — Get user information\n`/member-count` — Total member count\n`/joined-recently` — Recently joined members\n`/inactive-members` — Inactive members\n`/roles` — List all roles\n`/roleinfo` — Role information',
              inline: false
            },
            {
              name: '💾 Memory/AI Commands',
              value: '`/memory-view` — View all memories\n`/memory-add` — Add a memory\n`/memory-delete` — Delete a memory\n`/memory-search` — Search memories\n`/server-summary` — Server overview\n`/server-history` — Activity history\n`/remember` — Quick note\n`/forget` — Remove note',
              inline: false
            }
          )
          .setFooter({ text: 'Use / to see all commands' })
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }

      // Analytics Commands
      if (commandName === 'server-analytics') {
        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle('📊 Server Analytics Dashboard')
          .addFields(
            { name: 'Total Members', value: `${interaction.guild.memberCount}`, inline: true },
            { name: 'Members Joined', value: `${guildData.analytics.joins}`, inline: true },
            { name: 'Members Left', value: `${guildData.analytics.leaves}`, inline: true },
            { name: 'Total Messages', value: `${guildData.analytics.messages}`, inline: true },
            { name: 'Channels', value: `${Object.keys(guildData.analytics.channelMessages).length}`, inline: true },
            { name: 'Active Users', value: `${Object.keys(guildData.analytics.userMessages).length}`, inline: true }
          )
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'server-growth') {
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const recentJoins = guildData.analytics.joinHistory.filter(j => j.timestamp > sevenDaysAgo).length;
        const recentLeaves = guildData.analytics.leaveHistory.filter(l => l.timestamp > sevenDaysAgo).length;
        const netGrowth = recentJoins - recentLeaves;

        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('📈 Member Growth')
          .addFields(
            { name: 'This Week Joins', value: `${recentJoins}`, inline: true },
            { name: 'This Week Leaves', value: `${recentLeaves}`, inline: true },
            { name: 'Net Growth', value: `${netGrowth > 0 ? '+' : ''}${netGrowth}`, inline: true }
          )
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'activity') {
        const topChannels = Object.entries(guildData.analytics.channelMessages)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([channelId, count], idx) => {
            const channel = interaction.guild.channels.cache.get(channelId);
            return `${idx + 1}. ${channel?.name || 'Unknown'}: ${count}`;
          })
          .join('\n') || 'No data yet';

        const topUsers = Object.entries(guildData.analytics.userMessages)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([userId, count], idx) => `${idx + 1}. <@${userId}>: ${count}`)
          .join('\n') || 'No data yet';

        const embed = new EmbedBuilder()
          .setColor('#ffff00')
          .setTitle('🔥 Most Active')
          .addFields(
            { name: 'Top Channels', value: topChannels, inline: true },
            { name: 'Top Users', value: topUsers, inline: true }
          )
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'engagement') {
        const avgMsgsPerMember = guildData.analytics.messages / Math.max(interaction.guild.memberCount, 1);
        const embed = new EmbedBuilder()
          .setColor('#ff00ff')
          .setTitle('💬 Engagement Metrics')
          .addFields(
            { name: 'Total Messages', value: `${guildData.analytics.messages}`, inline: true },
            { name: 'Avg Messages/Member', value: `${avgMsgsPerMember.toFixed(2)}`, inline: true },
            { name: 'Active Users', value: `${Object.keys(guildData.analytics.userMessages).length}`, inline: true },
            { name: 'Participation Rate', value: `${((Object.keys(guildData.analytics.userMessages).length / interaction.guild.memberCount) * 100).toFixed(1)}%`, inline: true }
          )
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'leaderboard') {
        const topChatters = Object.entries(guildData.analytics.userMessages)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([userId, count], idx) => `${idx + 1}. <@${userId}>: ${count} messages`)
          .join('\n') || 'No data yet';

        const embed = new EmbedBuilder()
          .setColor('#ffa500')
          .setTitle('🏆 Leaderboard')
          .addFields(
            { name: 'Top Chatters', value: topChatters }
          )
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'retention') {
        const totalJoins = guildData.analytics.joins;
        const totalLeaves = guildData.analytics.leaves;
        const retentionRate = totalJoins > 0 ? (((totalJoins - totalLeaves) / totalJoins) * 100).toFixed(1) : 'N/A';

        const embed = new EmbedBuilder()
          .setColor('#00aa00')
          .setTitle('👥 Member Retention')
          .addFields(
            { name: 'New Members', value: `${totalJoins}`, inline: true },
            { name: 'Members Left', value: `${totalLeaves}`, inline: true },
            { name: 'Retention Rate', value: `${retentionRate}%`, inline: true }
          )
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }

      // Members Commands
      if (commandName === 'userinfo') {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle(`User Info: ${targetUser.username}`)
          .setThumbnail(targetUser.displayAvatarURL())
          .addFields(
            { name: 'User ID', value: targetUser.id, inline: true },
            { name: 'Account Created', value: targetUser.createdAt.toDateString(), inline: true },
            { name: 'Joined Server', value: member?.joinedAt?.toDateString() || 'Unknown', inline: true },
            { name: 'Messages', value: `${guildData.analytics.userMessages[targetUser.id] || 0}`, inline: true },
            { name: 'Roles', value: member?.roles?.cache?.map(r => r.name).join(', ') || 'No roles', inline: false }
          )
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'member-count') {
        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('👥 Member Count')
          .addFields(
            { name: 'Total Members', value: `${interaction.guild.memberCount}`, inline: true },
            { name: 'Active Users (30 days)', value: `${Object.keys(guildData.analytics.userMessages).length}`, inline: true }
          )
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'joined-recently') {
        const recentMembers = await interaction.guild.members.fetch({ limit: 50 }).catch(() => []);
        const sortedMembers = Array.from(recentMembers.values())
          .sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0))
          .slice(0, 10);

        const list = sortedMembers
          .map((m, idx) => `${idx + 1}. ${m.user.username} - ${m.joinedAt?.toDateString()}`)
          .join('\n') || 'No recent members';

        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('🆕 Recently Joined')
          .setDescription(list)
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'inactive-members') {
        const allMembers = await interaction.guild.members.fetch().catch(() => []);
        const activeUserIds = new Set(Object.keys(guildData.analytics.userMessages));
        const inactiveMembers = Array.from(allMembers.values())
          .filter(m => !m.user.bot && !activeUserIds.has(m.id))
          .slice(0, 10);

        const list = inactiveMembers
          .map((m, idx) => `${idx + 1}. ${m.user.username}`)
          .join('\n') || 'No inactive members';

        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('💤 Inactive Members')
          .setDescription(list)
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'roles') {
        const roles = interaction.guild.roles.cache
          .filter(r => r.id !== interaction.guild.id)
          .map((r, idx) => `${idx + 1}. ${r.name} (${r.members.size})`)
          .join('\n') || 'No roles';

        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle('📋 Server Roles')
          .setDescription(roles)
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'roleinfo') {
        const role = interaction.options.getRole('role');
        if (!role) {
          return interaction.reply('Please specify a role.');
        }

        const embed = new EmbedBuilder()
          .setColor(role.color || '#0099ff')
          .setTitle(`Role Info: ${role.name}`)
          .addFields(
            { name: 'Role ID', value: role.id, inline: true },
            { name: 'Members', value: `${role.members.size}`, inline: true },
            { name: 'Color', value: role.color ? `#${role.color.toString(16).toUpperCase()}` : 'No color', inline: true },
            { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
            { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true }
          )
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }

      // Memory/AI Commands
      if (commandName === 'memory-view') {
        const keys = Object.keys(guildData.memory);
        const memoryList = keys.slice(0, 20)
          .map(k => `**${k}**: ${guildData.memory[k].substring(0, 50)}${guildData.memory[k].length > 50 ? '...' : ''}`)
          .join('\n') || 'No memories saved';

        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle('💾 Server Memories')
          .setDescription(memoryList)
          .setFooter({ text: `Total: ${keys.length}` })
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'memory-add') {
        const key = interaction.options.getString('key');
        const value = interaction.options.getString('value');
        guildData.memory[key] = value;
        await saveData();

        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('✅ Memory Saved')
          .addFields(
            { name: 'Key', value: key },
            { name: 'Value', value: value.substring(0, 1024) }
          )
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'memory-delete') {
        const key = interaction.options.getString('key');
        if (!(key in guildData.memory)) {
          return interaction.reply(`❌ No memory found with key **${key}**.`);
        }
        delete guildData.memory[key];
        await saveData();

        return interaction.reply(`✅ Deleted memory **${key}**.`);
      }

      if (commandName === 'memory-search') {
        const query = interaction.options.getString('query').toLowerCase();
        const matches = Object.entries(guildData.memory)
          .filter(([k, v]) => k.toLowerCase().includes(query) || v.toLowerCase().includes(query))
          .slice(0, 10)
          .map(([k, v]) => `**${k}**: ${v.substring(0, 50)}${v.length > 50 ? '...' : ''}`)
          .join('\n') || 'No memories found';

        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle(`🔍 Memory Search: "${query}"`)
          .setDescription(matches)
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'server-summary') {
        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle(`📋 Server Summary: ${interaction.guild.name}`)
          .setThumbnail(interaction.guild.iconURL())
          .addFields(
            { name: 'Members', value: `${interaction.guild.memberCount}`, inline: true },
            { name: 'Channels', value: `${interaction.guild.channels.cache.size}`, inline: true },
            { name: 'Roles', value: `${interaction.guild.roles.cache.size}`, inline: true },
            { name: 'Total Messages Tracked', value: `${guildData.analytics.messages}`, inline: true },
            { name: 'Members Joined', value: `${guildData.analytics.joins}`, inline: true },
            { name: 'Members Left', value: `${guildData.analytics.leaves}`, inline: true },
            { name: 'Saved Memories', value: `${Object.keys(guildData.memory).length}`, inline: true }
          )
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'server-history') {
        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle('📜 Server Activity History')
          .addFields(
            { name: 'Total Messages', value: `${guildData.analytics.messages}`, inline: true },
            { name: 'Total Joins', value: `${guildData.analytics.joins}`, inline: true },
            { name: 'Total Leaves', value: `${guildData.analytics.leaves}`, inline: true },
            { name: 'Active Channels', value: `${Object.keys(guildData.analytics.channelMessages).length}`, inline: true },
            { name: 'Active Users', value: `${Object.keys(guildData.analytics.userMessages).length}`, inline: true }
          )
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'remember') {
        const content = interaction.options.getString('content');
        const memoryId = `memory_${Date.now()}`;
        guildData.memory[memoryId] = content;
        await saveData();

        return interaction.reply(`✅ Remembered: "${content}"\n**ID**: ${memoryId}`);
      }

      if (commandName === 'forget') {
        const id = interaction.options.getString('id');
        if (!(id in guildData.memory)) {
          return interaction.reply(`❌ Memory **${id}** not found.`);
        }
        delete guildData.memory[id];
        await saveData();

        return interaction.reply(`✅ Forgot: **${id}**.`);
      }
    } catch (error) {
      console.error(`Command error [${commandName}]:`, error);
      const errorMsg = 'An error occurred while executing this command.';
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMsg);
      } else {
        await interaction.reply(errorMsg);
      }
    }
  });

  client.login(config.token).catch((error) => {
    console.error('Failed to login:', error.message);
    process.exit(1);
  });
}

main();
