export function isThisCommand(content : string, list:string[]){
    if ( content.indexOf(' ') != -1) {
        const command = content.split(' ');
        return list.findIndex(cmd => command[1].startsWith(cmd));
    }else{
        return -1;
    }
}
