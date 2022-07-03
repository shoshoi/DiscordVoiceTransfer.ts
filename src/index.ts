import * as Discord from "discord.js";
import * as fs from "fs"
import * as argv from "argv"
import {isValid, JsonRuntimeType, validate} from 'ts-json-validator';
import {LangTypeFormat, LangType,  ServerSettingsFormat} from "./JsonType";
import GameState from "./GameState"
import {HttpServer} from "./HttpServer"
const JSON5 = require('json5');
const util = require('util');


argv.option([
    {
        name:  'server_setting',
        short: 's',
        type: 'list,path',
        description :'Specify the location of your own server configuration file.',
        example: "'-s local_private/my_server_settings.json5'"
    }
]);
const arg = argv.run();


const ServerSetting = loadAndSetServerSetting('./server_settings/default.json5', arg.options["server_setting"]);
// console.log("ServerSetting", ServerSetting)

const SysLangTxt = loadAndSetSysLangTxt("./lang/" + ServerSetting.system_lang + ".json5");

if (SysLangTxt    == null) { throw new Error('SysLangTxt is Wrong! lang:' + ServerSetting.system_lang);}

const clients = [new Discord.Client(), new Discord.Client()];
const Games: { [key: string]: GameState | null; } = {};

clients[0].on("ready", () => {console.log("Login! ", clients[0].user ? clients[0].user.username : "");});
clients[1].on("ready", () => {console.log("Login! ", clients[1].user ? clients[1].user.username : "");});

const httpServer : HttpServer = new HttpServer(ServerSetting, SysLangTxt);

function loadAndSetSysLangTxt(path : string, LangTxt ?: LangType){
    const data = fs.readFileSync(path, 'utf-8');
    const json5 = JSON5.parse(data);
    try {
        const ret = validate(LangTypeFormat, json5);
        if(ret != null) LangTxt = ret;
        return ret;
    } catch (e) {
        console.log(e);
    }
}


function get_env(str : string){
    let res = "";
    if(str.startsWith('$')){
        str = str.substring(1);
        if(!(str in process.env)) throw new Error("Env " + str + " doesn't exist!");
        const e = process.env[str];
        if(e == null) throw new Error("Env " + str + "doesn't exist!");
        res = e;
    } else {
        res = str.substring(1)
    }
    return res;
}

function isValidJsonRuntimeType(runtimeType: JsonRuntimeType, obj: any): boolean {
    switch (runtimeType) {
    case 'null':
        if(obj === null) return true;
        break;
    case 'boolean':
    case 'number':
    case 'string':
        if(typeof obj === runtimeType) return true;
        break;
    default:
        switch (runtimeType.base) {
        case 'literal':
            if(obj === runtimeType.value) return true;
            break;
        case 'optional':
            if(obj === undefined) return true;
            if(isValid(runtimeType.element, obj)) return true;
            break;
        case "union":
            if(runtimeType.elements.some((t) => isValid(t, obj))) return true;
            break;
        case "array":
            if(obj instanceof Array && obj.every((e) => isValid(runtimeType.element, e))) return true;
            break;
        case "tuple":
            const res = obj instanceof Array &&
                runtimeType.elements.length === obj.length &&
                runtimeType.elements.every((typ, i) => isValid(typ, obj[i]));
            if(res) return true;
            break;
        case "object":
            if (obj === null || typeof obj !== 'object') {
            } else if(Object.entries(runtimeType.keyValues).every(([key, typ]) => isValidJsonRuntimeType(typ, obj[key]))){
                return true;
            }
            break;
        }
    }
    console.error("runtimeType :", runtimeType);
    console.error("obj type    :", typeof obj);
    console.error("obj         :", obj);
    throw new Error("Json Type parse error!!");
}


function loadAndSetServerSetting(default_path : string, server_setting_files : any){
    var files : string[] = [default_path];
    if(server_setting_files instanceof Array){
        for(const f of server_setting_files){
            if(typeof f !== 'string') continue;
            files.push(f);
        }
    }
    let resTmp : any = new Object();
    for(const path of files){
        const rawFile = fs.readFileSync(path, 'utf-8');
        const jsonObj = JSON5.parse(rawFile);
        Object.assign(resTmp, jsonObj);
        resTmp = validate(ServerSettingsFormat, resTmp);
        if (resTmp == null) { 
            isValidJsonRuntimeType(ServerSettingsFormat.runtimeType, resTmp);
            throw new Error('ServerSetting is Wrong! File : ' + path);
        }
    }
    let res = validate(ServerSettingsFormat, resTmp);
    if (res == null) throw new Error('ServerSetting is Wrong!');
    res.token1 = get_env(res.token1);
    res.token2 = get_env(res.token2);
    res.http.addr = get_env(res.http.addr);
    res.http.ip        = get_env(res.http.ip);
    res.http.http_port = get_env(res.http.http_port);
    let GMs : string[] = [];
    for(const s of res.system_GM){
        const t = get_env(s).split(' ');
        GMs = GMs.concat(t);
    }
    res.system_GM = GMs;
    return res;
}

async function on_message(bid : number, message : Discord.Message){
    if (clients[0].user == null || message.author.id == clients[0].user.id) return;
    if (clients[1].user == null || message.author.id == clients[1].user.id) return;
    if (message.content.startsWith('^ping1')) {
        if(bid == 0) message.channel.send("pong 1!");
        return;
    }
    if (message.content.startsWith('^ping2')) {
        if(bid == 1) message.channel.send("pong 2!");
        return;
    }
    if (message.content.startsWith('^ping')) {
        message.channel.send("pong!"); return;
    }
    if(bid == 1) return;
    // console.log("text > ", message.content);
    
    const message_channel = message.channel;

    if(SysLangTxt != null && ('parentID' in message_channel)){
        const SrvLangTxt : LangType = SysLangTxt;
        const paID = message_channel.parentID;

        if(paID != null){
            const u = clients[0].user;
            
            if(message.guild == null){
                return;
            }

            var rolecheck = false;

            for(var key of message.mentions.roles.keys()){
                var role = message.mentions.roles.get(key);
                if(role != null){
                    rolecheck = rolecheck || role.name == clients[0].user.username;
                }
            }

            if(message.guild && (message.mentions.users.find(mu => mu.id == u.id) || rolecheck)){
                const guild1 = message.guild;
                const member1 = await guild1.members.fetch(message.author.id);
                if(member1.voice.channel == null){
                    message.channel.send(SrvLangTxt.sys.Unconnect_Voice_Err);
                    return;
                }
                if(Object.keys(Games).find((v : string ) => v == paID) != null){
                    if(Games[paID] != null){
                        await Games[paID]!.command(message);
                        return;
                    }else{
                        // nullのとき
                    }
                }
                if(guild1 != null){
                    let guild2 = clients[1].guilds.cache.find(g => g.id == guild1.id);
                    if(guild2 != null){
                        const member1 = await guild1.members.fetch(message.author.id);
                        const member2 = await guild2.members.fetch(message.author.id);
                        const cmember1 = await guild1.members.fetch(clients[0].user.id);
                        const cmember2 = await guild2.members.fetch(clients[1].user.id);
                        const voice_channel = member1.voice.channel;
                        const voice_channel2 = member2.voice.channel;
                        const text_channel = message.channel;
                        if(voice_channel != null && voice_channel2 != null && text_channel != null){
                            Games[paID] = new GameState(clients, cmember1, cmember2, Games, message.guild, guild2, text_channel, voice_channel, voice_channel2, paID, httpServer, SrvLangTxt, ServerSetting);
                            await Games[paID]!.command(message);
                        }else{
                            message.channel.send(SrvLangTxt.sys.Connect_Voice_Err);
                        }

                        return
                    }
                }
            }
        }
    }
}

async function release_games(){
    setInterval(() => {
        let keys = new Array();
        for (let key in Games) {
            if(Games[key] != null){
                const result = Games[key]!.checkIdle();
                if(result == 1) Games[key] = null;
            }else{
                //nullのとき
            }
        }
        /*
        console.log(Object.keys(Games));
        console.log(keys);
        for (let key in keys){
            console.log(Games[key].remove());
            
        }*/
    }, 1000 * 10);
}


clients[0].on("message", async message => await on_message(0, message));
clients[1].on("message", async message => await on_message(1, message));
clients[0].on("ready",   async () => await release_games());


const token1 = ServerSetting.token1;
const token2 = ServerSetting.token2;

clients[0].login(token1)
clients[1].login(token2)
