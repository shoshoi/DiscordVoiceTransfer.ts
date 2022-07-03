import http, {IncomingMessage, ServerResponse} from 'http'
import * as fs from 'fs'
import * as path from 'path'
import {LangType, ServerSettingsType} from "./JsonType";
import * as WebSocket from 'ws'
import GameState from "./GameState"

function dummyHttpRequestReceiver(obj : HttpServer, request: IncomingMessage, response: ServerResponse){
    obj.httpRequest(request, response);
}

const sid_length = 8;

export class HttpServer {
    server : http.Server;
    wsServer : WebSocket.Server;
    config : ServerSettingsType;
    games : {[key : string] : HttpGameState} ;
    langTxt     : LangType;

    constructor(config : ServerSettingsType, srvLangTxt : LangType) {
        this.config  = config;
        this.langTxt = srvLangTxt;
        this.games = Object.create(null);
        this.server = http.createServer();
        this.server.on('request', (request, response) => {
            dummyHttpRequestReceiver(this, request, response);
        });
        
        this.server.listen(config.http.http_port, parseInt(config.http.ip), function () {});
        this.wsServer = new WebSocket.Server({ server: this.server }, () => console.log(`WS server is listening at ws://${config.http.ip}:${config.http.http_port}`));

        this.wsServer.on('connection', (ws : WebSocket, req) => {
            const url = req.url;
            console.log("new ws connection", url);
            if(url == null) {
                ws.send("x");
                ws.close();
                return;
            }
            const urls = url.split('?');
            if(urls[0].length == sid_length + 1 && url.startsWith('/')){
                const sid = urls[0].substring(1);
                if(sid in this.games){
                    this.games[sid].addSubscribers(ws, urls[1]);
                    console.log("game", sid, "new connect", urls[1], " #", this.games[sid].subscribers.length);
                    return;
                }
            }
            ws.send("x");
            ws.close();
        });
        console.log(`A web server has been started : http://${config.http.ip}:${config.http.http_port}/`);
    }
    getHttpURL(){
        return `http://${this.config.http.addr}:${this.config.http.http_port}/`;
    }
    httpRequest(request: IncomingMessage, response: ServerResponse){
        const url = (request.url == null ? "" : request.url);

        const urls = decodeURI(url).split('?');
        const basename = path.basename(urls[0]) || 'index.html';
        
        if(!(this.config.http.white_list.includes(basename))){
            response.statusCode = 404;
            response.end();
            return;
        }
        const file = this.config.http.template_dir + '/' + basename;
        fs.exists(file, (exists) => {
            let headers : http.OutgoingHttpHeaders = { "Content-Type" : path.extname(file) };
            let output : string = "";
            if (exists) {
                output = fs.readFileSync(file, "utf-8");
                response.writeHead(200, headers);
                response.end(output);
            } else {
                response.statusCode = 404;
                response.end();
            }
        });
    }
    registerSession(sid : string, state : GameState){
        this.games[sid] = new HttpGameState(sid, state, this.langTxt);
        return this.getHttpURL() + this.config.http.game_html + '?room=' + sid;
    }
    destroySession(sid : string){
        if(this.games[sid] != null){
            this.games[sid].destroy();
            delete this.games[sid];
        }
    }
}

class Session{
    ws : WebSocket;
    id : string | null;
    constructor(ws : WebSocket, id : string | null) {
        this.ws = ws;
        this.id = id;
    }
}


class UserState{
    isSpeaking : string = "n"; // n/s/x
    isLiving   : string = "l"; // l/d/k
    constructor(){}
}

export class HttpGameState {
    subscribers : Session[];
    sid         : string;
    game        : GameState;
    uid2bid     : { [key: string]: string; }
    bid2uid     : { [key: string]: string; }
    nextBid     : number;
    userState   : { [key: string]: UserState; } // n/s/d 
    phaseName   : string = "";
    langTxt     : LangType;
    constructor(sid : string, game : GameState, srvLangTxt : LangType) {
        this.sid  = sid;
        this.game = game;
        this.subscribers = [];
        this.uid2bid    = Object.create(null);
        this.bid2uid    = Object.create(null);
        this.userState  = Object.create(null);
        this.nextBid = 1;
        this.langTxt = srvLangTxt;
    }
    destroy(){
        for(const idx in this.subscribers){
            this.subscribers[idx].ws.close();
        }
    }
    addSubscribers(ws : WebSocket, id : string | null){
        this.subscribers.push(new Session(ws, id));
    }
    wsSend(message : string){
        // console.log("wsSend", message);
        this.subscribers.forEach((session, i) => {
            if (session.ws.readyState === session.ws.OPEN) { // check if it is still connected
                session.ws.send(message); // send
            }
        })
        this.subscribers.forEach((session, i) => {
            if (session.ws.readyState != session.ws.OPEN) {
                this.subscribers.splice(i, 1);
            }
        })
    }
    
    updateMemberSpeaking(uid : string){
        if(!(uid in this.uid2bid)) return;
        const bid = this.uid2bid[uid];
        this.userState[bid].isSpeaking = "s";
        this.wsSend('s' + bid);
    }
    updateMemberNospeaking(uid : string){
        if(!(uid in this.uid2bid)) return;
        const bid = this.uid2bid[uid];
        this.userState[bid].isSpeaking = "n";
        this.wsSend('n' + bid);
    }
    updateMemberDead(uid : string){
        const bid = this.uid2bid[uid];
        this.userState[bid].isLiving = "d";
        this.wsSend('d' + bid);
    }
    updateMemberKill(uid : string){
        const bid = this.uid2bid[uid];
        this.userState[bid].isLiving = "k";
        this.wsSend('k' + bid);
    }
    updatePhase(p : string){
        this.phaseName = p;
        this.wsSend('p' + p);
    }
}
