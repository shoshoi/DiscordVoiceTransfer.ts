import * as Discord from "discord.js";
import * as fs from "fs"
import {validate, JsonRuntimeType} from 'ts-json-validator';
var JSON5 = require('json5');

export function isThisCommand(content : string, list:string[]){
    if ( content.indexOf(' ') != -1) {
        const command = content.split(' ');
        return list.findIndex(cmd => command[1].startsWith(cmd));
    }else{
        return -1;
    }
}
