import http, {IncomingMessage, ServerResponse} from 'http'
import * as fs from 'fs'
import * as path from 'path'
import {LangType, ServerSettingsType} from "./JsonType";
const Log4js = require("log4js");
Log4js.configure("log-config.json");
const logger = Log4js.getLogger("system");

function dummyHttpRequestReceiver(obj : HttpServer, request: IncomingMessage, response: ServerResponse){
    obj.httpRequest(request, response);
}

const sid_length = 8;

export class HttpServer {
    server : http.Server;
    config : ServerSettingsType;
    langTxt     : LangType;

    constructor(config : ServerSettingsType, srvLangTxt : LangType) {
        this.config  = config;
        this.langTxt = srvLangTxt;
        this.server = http.createServer();
        this.server.on('request', (request, response) => {
            dummyHttpRequestReceiver(this, request, response);
        });
        
        this.server.listen(config.http.http_port, parseInt(config.http.ip), function () {});
        
        logger.info(`A web server has been started : http://${config.http.ip}:${config.http.http_port}/`);
    }
    getHttpURL(){
        return `http://${this.config.http.addr}:${this.config.http.http_port}/`;
    }
    httpRequest(request: IncomingMessage, response: ServerResponse){
        const file = 'public/index.html';
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
}
