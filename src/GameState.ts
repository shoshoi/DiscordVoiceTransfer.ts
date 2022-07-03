import * as dt from "date-utils";
import * as Discord from "discord.js";
import LiveStream     from "./LiveStream"
import {isThisCommand} from "./GameUtils"
import {LangType, ServerSettingsType} from "./JsonType";
import {HttpServer, HttpGameState} from "./HttpServer"

function stringToEnum<T extends string>(o: T[]): {[K in T]: K} {
    return o.reduce((accumulator, currentValue) => {
      accumulator[currentValue] = currentValue;
      return accumulator;
    }, Object.create(null));
}


function getUserMentionStrFromId(uid: string){
    return "<@!" + uid + ">"
}
function getUserMentionStr(user: Discord.User){
    return "<@!" + user.id + ">"
}

// Binary string to ASCII (base64)
function btoa(bin : string) {
    return Buffer.from(bin, 'binary').toString('base64');
  }
function bnToB64(bn : BigInt) {
    var hex = BigInt(bn).toString(16);
    if (hex.length % 2) { hex = '0' + hex; }
    var bin = [];
    var i = 0;
    var d;
    var b;
    while (i < hex.length) {
      d = parseInt(hex.slice(i, i + 2), 16);
      b = String.fromCharCode(d);
      bin.push(b);
      i += 2;
    }
    return btoa(bin.join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

const enum Perm {NoAccess, ReadOnly, ViewOnly, RW, Admin}

export default class GameState {
    clients      : Discord.Client[];
    guild        : Discord.Guild;
    guild2       : Discord.Guild;
    srvSetting   : ServerSettingsType;
    langTxt      : LangType;
    upperGames   : { [key: string]: GameState | null};
    parentID     : string;
    textChannel  : Discord.TextChannel | Discord.DMChannel | Discord.NewsChannel;
    channels     : Discord.VoiceChannel;
    channels2    : Discord.VoiceChannel;
    streams      : LiveStream;
    gameId       : number;
    httpServer   : HttpServer;
    gameSessionID : string;
    prevDate     : Date;

    httpGameState   : HttpGameState;

    constructor(clients : Discord.Client[], upperGames : {[key: string]: GameState | null}, guild : Discord.Guild, guild2 : Discord.Guild, tch : Discord.TextChannel | Discord.DMChannel | Discord.NewsChannel, ch : Discord.VoiceChannel, ch2 : Discord.VoiceChannel, parentID : string, httpServer : HttpServer, srvLangTxt : LangType, srvSetting : ServerSettingsType) {
        this.clients     = clients;
        this.upperGames  = upperGames;
        this.guild       = guild;
        this.guild2      = guild2;
        this.loadLang(srvLangTxt);
        this.langTxt     = srvLangTxt;
        this.srvSetting  = srvSetting;
        this.textChannel = tch;
        this.channels    = ch;
        this.channels2   = ch2;
        this.parentID    = parentID;
        this.gameId      = -1;
        this.httpServer    = httpServer;
        this.gameSessionID = this.resetServerSession();
        this.httpGameState = this.httpServer.games[this.gameSessionID];
        this.prevDate = new Date();

        this.reset()
        this.streams     = new LiveStream(ch, ch2, this.httpGameState, srvLangTxt);
    }
    loadLang(srvLangTxt : LangType){
        this.langTxt     = srvLangTxt;
    }
    reset(){
        this.gameId = Math.floor(Math.random() * 0x40000000);
    }
    destroy(){
        this.streams.destroy();
        this.httpServer.destroySession(this.httpGameState.sid);
    }

    resetServerSession(){
        let b :bigint = 0n;
        b += BigInt(Math.floor(Math.random()*65536)) * 0x1n;
        b += BigInt(Math.floor(Math.random()*65536)) * 0x1_0000n;
        b += BigInt(Math.floor(Math.random()*65536)) * 0x1_0000_0000n;
        const sid = bnToB64(b);
        console.log("Session ID : ", sid);
        const httpURL = this.httpServer.registerSession(sid, this);
        console.log("HTTP URL : ", httpURL);
        /*this.channels.Living.send({embed: {
            title: this.langTxt.sys.sys_start_browser,
            description : httpURL,
            color: this.langTxt.sys.system_color,
        }});*/

        return sid;
    }
    err(){
        console.error("An error has occurred.");
        console.trace();
        this.textChannel.send("An error has occurred...");
    }

    
    getCategory64(){
        return bnToB64(BigInt(this.parentID));
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
        const member = this.channels.members.array.length + this.channels2.members.array.length
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
            await this.voiceChannelsLink();
            this.voiceChannelsUnlink();
            return;
        }
    }
}
