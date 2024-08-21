const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    EmbedBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    InteractionType 
} = require('discord.js');
const sqlite3 = require('sqlite3').verbose(); 
const path = require('path');

// Veritabanı bağlantısını oluşturuyoruz
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Veritabanı bağlantısı sağlanamadı.', err);
    } else {
        console.log('Veritabanı bağlantısı başarılı.');
        initializeDatabase(); // Veritabanı tablolarını oluşturuyoruz
    }
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages
    ]
});
client.on('messageCreate', async message => {
    // Other existing commands...

    // !rolver Command with delay
    if (message.content.startsWith('!rolver')) {
        if (!message.member.permissions.has('MANAGE_ROLES')) {
            return message.reply('Bu komutu kullanmak için `Rolleri Yönet` iznine sahip olmalısınız.');
        }

        const args = message.content.split(' ');
        const roleMention = args[1];

        if (!roleMention || !roleMention.startsWith('<@&') || !roleMention.endsWith('>')) {
            return message.reply('Lütfen geçerli bir rol etiketleyin. Örnek: `!rolver @RolAdı`');
        }

        const roleId = roleMention.slice(3, -1);
        const role = message.guild.roles.cache.get(roleId);

        if (!role) {
            return message.reply('Belirtilen rol bulunamadı.');
        }

        const members = await message.guild.members.fetch();
        let count = 0;

        for (const member of members.values()) {
            if (!member.roles.cache.has(role.id)) {
                await member.roles.add(role).catch(console.error);
                count++;

                // Delay to prevent hitting rate limits
                await new Promise(resolve => setTimeout(resolve, -10000)); // 1 second delay
            }
        }

        message.channel.send(`Toplam ${count} kullanıcıya \`${role.name}\` rolü verildi.`);
    }

    // !emojiekle Command
    if (message.content.startsWith('!emojiekle')) {
        if (!message.member.permissions.has('MANAGE_EMOJIS_AND_STICKERS')) {
            return message.reply('Bu komutu kullanmak için `Emojileri Yönet` iznine sahip olmalısınız.');
        }

        const args = message.content.split(' ');
        if (args.length < 3) {
            return message.reply('Lütfen geçerli bir emoji bağlantısı ve isim sağlayın. Örnek: `!emojiekle https://emojiurl.png EmojiAdı`');
        }

        const emojiUrl = args[1];
        const emojiName = args.slice(2).join(' ');

        try {
            const emoji = await message.guild.emojis.create({ attachment: emojiUrl, name: emojiName });
            message.channel.send(`Emoji başarıyla eklendi: ${emoji}`);
        } catch (error) {
            console.error(error);
            message.channel.send('Emoji eklenirken bir hata oluştu.');
        }
    }

    // Other existing command handling...
});

client.once('ready', () => {
    console.log(`Bot ${client.user.tag} olarak giriş yaptı!`);
});

client.on('guildMemberAdd', async member => {
    sendWelcomeMessage(member);
});

client.on('messageCreate', async message => {
    if (message.content === '!test') {
        const member = message.member;
        sendWelcomeMessage(member);
    }

    if (message.content === '!rolalma') {
        const embed = new EmbedBuilder()
            .setColor('#660099')
            .setTitle('Rol Alma')
            .setDescription('Kendinize ait platformumuzu tanıtmak için aşağıdaki menüden size uygun olan rolü seçin. Rolü seçtikten sonra bir form doldurmanız gerekecek.');

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select-role')
                    .setPlaceholder('Almak istediğiniz rolü seçin.')
                    .addOptions([
                        {
                            label: 'Sunucu Sahibi',
                            value: 'sunucu_sahibi',
                            emoji: '🛠️',
                        },
                        {
                            label: 'Takım Sahibi',
                            value: 'takim_sahibi',
                            emoji: '🏆',
                        },
                        {
                            label: 'Dijital Hizmetler',
                            value: 'dijital_hizmetler',
                            emoji: '💻',
                        },
                        {
                            label: 'Klan Sahibi',
                            value: 'klan_sahibi',
                            emoji: '⚔️',
                        },
                        {
                            label: 'İçerik Üreticisi',
                            value: 'icerik_ureticisi',
                            emoji: '🎥',
                        },
                    ])
            );

        await message.channel.send({ embeds: [embed], components: [row] });
    }

    if (message.content.startsWith('!çekiliş')) {
        const args = message.content.slice(9).trim().split(';');
        if (args.length < 3) {
            return message.channel.send('Lütfen geçerli bir formatta ödül, süre ve kazanan sayısı belirtin. Örnek: `!çekiliş Ödül; 10; 2`');
        }
    
        const ödül = args[0].trim();
        const süre = parseInt(args[1].trim(), 10);
        const kaçKişi = parseInt(args[2].trim(), 10);
        const kanal = message.channel;
    
        // Veritabanına çekilişi kaydediyoruz
        const çekilişId = await insertGiveaway(ödül, süre, kaçKişi, kanal.id, message.author.id);
    
        const endTime = Date.now() + süre * 60000;
        const endTimestamp = Math.floor(endTime / 1000); // Convert to Unix timestamp
    
        const embed = new EmbedBuilder()
        .setAuthor({ name: `${ödül} Çekilişi`, iconURL: 'https://cdn.discordapp.com/emojis/686634349172490337.webp?size=44&quality=lossless' })
        .setColor('#660099')
        .setThumbnail('https://media.discordapp.net/attachments/724615919363555422/828246421172912198/chest5.png')
        .setFooter({ text: `Kazanan Sayısı: ${kaçKişi}`, iconURL: 'https://cdn.discordapp.com/emojis/527428274515869698.png' })
        .addFields(
            { name: '<:cekilisduyuru:1275499968282624041> Çekilişi Başlatan:', value: `<@!${message.author.id}>`, inline: true },
            { name: '<a:a_saat:1275498840434278441> Çekiliş Süresi:', value: `<t:${endTimestamp}:R>`, inline: true },
            { name: '<:date:1275499598009602180> Çekiliş Biteceği Tarih:', value: `<t:${endTimestamp}:f>`, inline: false },
        );
    
        const sendMessage = await kanal.send({ embeds: [embed] });
        await sendMessage.react('🎉');
    
        const interval = setInterval(async () => {
            const remainingTime = Math.max(0, endTime - Date.now());
    
            if (remainingTime <= 0) {
                clearInterval(interval);
    
                const fetchedMessage = await kanal.messages.fetch(sendMessage.id);
                const reactions = fetchedMessage.reactions.cache.get('🎉');
                const users = await reactions.users.fetch();
                const participants = users.filter(user => !user.bot).map(user => user.id);
    
                if (participants.length === 0) {
                    await kanal.send('Çekilişe kimse katılmadı.');
                } else {
                    const winners = [];
                    for (let i = 0; i < kaçKişi && participants.length > 0; i++) {
                        const randomIndex = Math.floor(Math.random() * participants.length);
                        winners.push(participants.splice(randomIndex, 1)[0]);
                    }
    
                    await kanal.send(`<:kral:1275503094670561331> Kazananlar: ${winners.map(winner => `<@${winner}>`).join(', ')}\n**(${ödül}**)`);
                }
    
                await deleteGiveaway(çekilişId);
    
                await fetchedMessage.delete();
            }
        }, 1000); // Every second
    }
});
// Hoş geldin mesajı fonksiyonu
async function sendWelcomeMessage(member) {
    const totalMembers = member.guild.memberCount; // Sunucudaki toplam üye sayısı

    // Kullanıcının Discord'a katılma tarihini biçimlendirin
    const joinedDiscordAt = `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`;
    const joinedDiscordDate = `<t:${Math.floor(member.user.createdTimestamp / 1000)}:f>`;

    // Embed mesajı oluşturun
    const embed = new EmbedBuilder()
        .setColor('#660099')
        .setAuthor({ name: 'MTSP', iconURL: 'https://cdn.discordapp.com/attachments/1275432290184331405/1275540868828237884/MTSP-20-08-2024_1.gif?ex=66c64381&is=66c4f201&hm=9e5a9cf78255eba6a05f4d7e7de49ad6a94c4a1d5eb999c6b87d905ddd643df7&' })
        .setDescription(`${member} Sunucumuza hoş geldin, seninle beraber MTSP halkı **${totalMembers}** kişi oldu.`)
        .addFields(
            { name: 'Discord\'a katılma tarihi:', value: `${joinedDiscordAt} \n${joinedDiscordDate}` }
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'MTSP' });

    // Mesajı göndermek için lobi kanalını bulun
    const channel = member.guild.channels.cache.find(ch => ch.name === '👥・lobi');
    if (!channel) return;

    await channel.send({ content: `<@${member.id}>`, embeds: [embed] });
}


// Veritabanı tablolarını oluşturma
function initializeDatabase() {
    db.run(`
        CREATE TABLE IF NOT EXISTS giveaways (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ödül TEXT,
            süre INTEGER,
            kazanan_sayısı INTEGER,
            kanal_id TEXT,
            oluşturucu_id TEXT,
            oluşturulma_zamanı INTEGER
        )
    `);
}

// Çekilişi veritabanına ekleme fonksiyonu
function insertGiveaway(ödül, süre, kazananSayısı, kanalId, oluşturucuId) {
    return new Promise((resolve, reject) => {
        const query = `INSERT INTO giveaways (ödül, süre, kazanan_sayısı, kanal_id, oluşturucu_id, oluşturulma_zamanı) VALUES (?, ?, ?, ?, ?, ?)`;
        const params = [ödül, süre, kazananSayısı, kanalId, oluşturucuId, Date.now()];

        db.run(query, params, function (err) {
            if (err) {
                return reject(err);
            }
            resolve(this.lastID); 
        });
    });
}

// Çekilişi veritabanından silme fonksiyonu
function deleteGiveaway(id) {
    return new Promise((resolve, reject) => {
        const query = `DELETE FROM giveaways WHERE id = ?`;
        db.run(query, [id], function (err) {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
}

// Rol ve form sistemini devam ettiriyoruz...
client.on('interactionCreate', async interaction => {
    if (interaction.isStringSelectMenu()) {
        const roleMap = {
            'sunucu_sahibi': '1275432010877505698',
            'takim_sahibi': '1275432012068552757',
            'dijital_hizmetler': '1275432013528174664',
            'klan_sahibi': '1275432016313323655',
            'icerik_ureticisi': '1275432019245010974',
        };

        const selectedRole = roleMap[interaction.values[0]];
        const role = interaction.guild.roles.cache.get(selectedRole);

        if (role) {
            await interaction.member.roles.add(role);

            // Create and show the modal
            const modal = new ModalBuilder()
                .setCustomId('roleApplicationModal')
                .setTitle('Rol Alma Başvurusu')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('isim')
                            .setLabel('İsminiz')
                            .setPlaceholder('Ör: Serhat')
                            .setStyle(TextInputStyle.Short)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('sunucuAdi')
                            .setLabel('Sunucunuzun Adı')
                            .setPlaceholder('Ör: MTSP')
                            .setStyle(TextInputStyle.Short)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('discordLink')
                            .setLabel('Discord Sunucunuzun Linki')
                            .setPlaceholder('Ör: discord.gg/mtsp')
                            .setStyle(TextInputStyle.Short)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('mcServerIp')
                            .setLabel('Minecraft Sunucusunun IPsi')
                            .setPlaceholder('Ör: play.mtsp.net')
                            .setStyle(TextInputStyle.Short)
                    )
                );

            await interaction.showModal(modal);
        } else {
            await interaction.reply({ content: 'Rol bulunamadı, lütfen yöneticinize başvurun.', ephemeral: true });
        }
    }

    if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'roleApplicationModal') {
        const isim = interaction.fields.getTextInputValue('isim');
        const sunucuAdi = interaction.fields.getTextInputValue('sunucuAdi');
        const discordLink = interaction.fields.getTextInputValue('discordLink');
        const mcServerIp = interaction.fields.getTextInputValue('mcServerIp');

        const submissionChannel = interaction.guild.channels.cache.find(ch => ch.name === 'başvuru-log');

        if (submissionChannel) {
            const embed = new EmbedBuilder()
                .setTitle('Yeni Rol Alma Başvurusu')
                .addFields(
                    { name: 'İsim', value: isim },
                    { name: 'Sunucu Adı', value: sunucuAdi },
                    { name: 'Discord Sunucu Linki', value: discordLink },
                    { name: 'Minecraft Sunucu IPsi', value: mcServerIp }
                )
                .setColor('#660099')
                .setFooter({ text: `Başvuran: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('approve')
                        .setLabel('Onayla')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('reject')
                        .setLabel('Reddet')
                        .setStyle(ButtonStyle.Danger)
                );

            await submissionChannel.send({ embeds: [embed], components: [actionRow] });
            await interaction.reply({ content: 'Başvurunuz alındı, lütfen bir yanıt bekleyin.', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Başvuru log kanalı bulunamadı.', ephemeral: true });
        }
    }

    if (interaction.isButton()) {
        const applicantId = interaction.message.embeds[0]?.footer?.text?.split(' ')[1];
        const applicant = interaction.guild.members.cache.get(applicantId);

        if (interaction.customId === 'approve') {
            await interaction.reply({ content: 'Başvuru onaylandı.', ephemeral: true });

            if (applicant) {
                await applicant.send('Başvurunuz onaylandı!');
            }
        }

        if (interaction.customId === 'reject') {
            await interaction.reply({ content: 'Başvuru reddedildi.', ephemeral: true });

            if (applicant) {
                await applicant.send('Başvurunuz ne yazık ki reddedildi.');
            }
        }
    }
});
client.login('MTI3NTQzMzM3NTM3Njc0MDM3Mw.Gp1lPY.xGcui89Oa46ugGtAKPm368hANlLHYhu4uJjNRs');
