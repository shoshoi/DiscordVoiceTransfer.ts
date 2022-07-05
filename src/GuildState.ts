import * as dt from "date-utils";
import * as Discord from "discord.js";
import LiveStream     from "./LiveStream"
import {isThisCommand} from "./Utils"
import {LangType, ServerSettingsType} from "./JsonType";
const Log4js = require("log4js");
Log4js.configure("log-config.json");
const logger = Log4js.getLogger("system");

export default class GuildState {
    clients      : Discord.Client[];
    cmember        : Discord.GuildMember;
    cmember2        : Discord.GuildMember;
    guild        : Discord.Guild;
    guild2       : Discord.Guild;
    srvSetting   : ServerSettingsType;
    langTxt      : LangType;
    upperGames   : { [key: string]: GuildState | null};
    textChannel  : Discord.TextChannel | Discord.DMChannel | Discord.NewsChannel;
    channels     : Discord.VoiceChannel;
    channels2    : Discord.VoiceChannel;
    streams      : LiveStream;
    prevDate     : Date;


    constructor(clients : Discord.Client[], cmember: Discord.GuildMember, cmember2: Discord.GuildMember, upperGames : {[key: string]: GuildState | null}, guild : Discord.Guild, guild2 : Discord.Guild, tch : Discord.TextChannel | Discord.DMChannel | Discord.NewsChannel, ch : Discord.VoiceChannel, ch2 : Discord.VoiceChannel, srvLangTxt : LangType, srvSetting : ServerSettingsType) {
        this.clients     = clients;
        this.cmember      = cmember;
        this.cmember2      = cmember2;
        this.upperGames  = upperGames;
        this.guild       = guild;
        this.guild2      = guild2;
        this.loadLang(srvLangTxt);
        this.langTxt     = srvLangTxt;
        this.srvSetting  = srvSetting;
        this.textChannel = tch;
        this.channels    = ch;
        this.channels2   = ch2;
        this.prevDate = new Date();
        this.streams     = new LiveStream(ch, ch2, srvLangTxt);
    }
    loadLang(srvLangTxt : LangType){
        this.langTxt     = srvLangTxt;
    }
    destroy(){
        this.streams.destroy();
    }

    err(){
        logger.error("An error has occurred.");
        console.trace();
        this.textChannel.send("An error has occurred...");
    }

    async voiceChannelsLink(){
        const ret = await this.streams.connectVoice();
        if(ret) {
            this.textChannel.send(this.langTxt.sys.Connect_Voice);
        }else{
            this.textChannel.send(this.langTxt.sys.Connect_Voice_Err);
        }
    }
    voiceChannelsUnlink(){
        this.streams.unconnectVoice();
        this.textChannel.send(this.langTxt.sys.Disconnect_Voice);
        this.destroy();
    }
    checkIdle(){
        var member = 0;
        
        if (this.cmember.voice.channel != null){
            for(var key of this.cmember.voice.channel.members.keys()){
                member += 1;
            }
        }else{
            this.voiceChannelsUnlink();
            return 1;
        }
        if (this.cmember2.voice.channel != null ){
            if(this.cmember.voice.channel.id != this.cmember2.voice.channel.id){
                for(var key of this.cmember2.voice.channel.members.keys()){
                    member += 1;
                }
            }
        }else{
            this.voiceChannelsUnlink();
            return 1;
        }
        
        if(member > 2){
            this.prevDate = new Date();
        }else{
            if(new Date().getTime() - this.prevDate.getTime() > 1000 * 20){
                this.voiceChannelsUnlink();
                return 1;
            }
        }
        return 0;
    }
    async command(message : Discord.Message){
        if(isThisCommand(message.content, this.langTxt.sys.cmd_connect_voice) >= 0){
            await this.voiceChannelsLink();
            return;
        }
        if(isThisCommand(message.content, this.langTxt.sys.cmd_disconnect_voice) >= 0){
            this.voiceChannelsUnlink();
            return;
        }
    }
}
