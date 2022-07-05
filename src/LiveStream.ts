import * as Discord from "discord.js";
import {LangType} from "./JsonType";
import {Readable} from "stream";
import * as AudioMixer from "audio-mixer";
const Log4js = require("log4js");
Log4js.configure("log-config.json");
const logger = Log4js.getLogger("system");


class RealtimeWaveStream extends Readable{
    freq       : number = 375;
    amp        : number = 1024;
    bitDepth   : number = 16;
    channels   : number = 2;
    sampleRate : number = 48000;
    buf        : Buffer = Buffer.alloc(0);
    base_numSamples  : number = 0;
    interval_ms      : number = 0;
    samplesGenerated : number = 0;
    next_time        : number = 0;

    constructor(amp : number) {
        super({objectMode: true});
        this.amp = amp;
        this.makeBuf(16384);
        this.reset();
    }
    reset(){
        this.next_time = Date.now() + this.interval_ms;
    }
    makeBuf(base_n : number){
        let sampleSize = this.bitDepth / 8;
		let blockAlign = sampleSize * this.channels;
		let numSamples = base_n / blockAlign | 0;
        this.buf = Buffer.alloc(numSamples * blockAlign);

        this.base_numSamples = numSamples;
        this.interval_ms = 1000 * numSamples / this.sampleRate;

        let t = (Math.PI * 2 * this.freq) / this.sampleRate;

		for (let i = 0; i < numSamples; i++) {
			// fill with a simple sine wave at max amplitude
			for (let channel = 0; channel < this.channels; channel++) {
				let s = this.samplesGenerated + i;
				let val = Math.round(this.amp * Math.sin(t * s)); // sine wave
                let offset = (i * sampleSize * this.channels) + (channel * sampleSize);
                if(this.bitDepth == 16){
                    this.buf.writeInt16LE(val, offset);
                }else if(this.bitDepth == 8){
                    this.buf.writeInt8(val, offset);
                }else if(this.bitDepth == 32){
                    this.buf.writeInt32LE(val, offset);
                }
			}
        }
    }
    _read(size : number) {
        const buf = this.buf;
        const dif = this.next_time - Date.now();
        setTimeout(() => {
            this.next_time += this.interval_ms;
            this.push(buf);

        }, dif);
    }
}

export default class LiveStream {
    channels  : Discord.VoiceChannel;
    channels2 : Discord.VoiceChannel;
    liveMixer   : AudioMixer.Mixer | null = null;
    audioMixer  : AudioMixer.Mixer | null = null;
    dummyInput1  : AudioMixer.Input | null = null;
    conn1        : Discord.VoiceConnection  | null = null;
    conn2        : Discord.VoiceConnection  | null = null;
    constructor(ch : Discord.VoiceChannel, ch2 : Discord.VoiceChannel, SrvLangTxt : LangType,) {
        this.channels = ch
        this.channels2 = ch2
    }
    reset(){}
    destroy(){
        if(this.liveMixer  ) this.liveMixer.destroy();
        if(this.audioMixer ) this.audioMixer.destroy();
        if(this.dummyInput1) this.dummyInput1.destroy();
        if(this.conn1      ) this.conn1.disconnect();
        if(this.conn2      ) this.conn2.disconnect();
        this.liveMixer = null  
        this.audioMixer = null 
        this.dummyInput1 = null
        this.conn1 = null      
        this.conn2 = null      
    }
    async connectVoice() {
        if(this.dummyInput1 != null) return false;
        if(this.liveMixer != null) return false;
        if(this.audioMixer != null) return false;
        if(this.conn1 != null) return false;
        if(this.conn2 != null) return false;

        const conn2 = await this.channels2.join().catch((e)=>{
            logger.error(e);
            console.trace();
            logger.error("Error Catch!");
        });
        if(conn2 == null) return false;
        logger.info("voice channel join.");
        const mixer =  new AudioMixer.Mixer({
            channels: 2,
            bitDepth: 16,
            sampleRate: 48000
        });
        this.conn2 = conn2;
        conn2.play(mixer, {type:'converted'});
        this.audioMixer =  mixer;
        
        /////////////////////////////////////////////////////////////////////////
        const conn1 = await this.channels.join().catch((e)=>{
            logger.error(e);
            console.trace();
            logger.error("Error Catch!");
        });
        if(conn1 == null) return false;
        this.conn1 = conn1;

        this.liveMixer =  new AudioMixer.Mixer({
            channels: 2, bitDepth: 16, sampleRate: 48000
        });

         
        const dummyInput1 = new AudioMixer.Input({
            channels: 2, bitDepth: 16, sampleRate: 48000, volume : 100
        });
        this.dummyInput1 = dummyInput1;
        this.liveMixer.addInput(dummyInput1);
        const dummyStream1 = new RealtimeWaveStream(0);
        dummyStream1.pipe(dummyInput1);
        
        conn1.play(this.liveMixer, {type:'converted'});

        conn1.on('speaking', (user, speaking) => {
                    if(user == null){
                        logger.error("user is null...", user, speaking);
                        return;
                    }
                    if (user.bot) return
                    if (speaking) {
                        if (this.audioMixer == null){
                            logger.error("audioMixer is null");
                        } else {
                            const audioStream = conn1.receiver.createStream(user, {mode : "pcm"});
                            
                            const standaloneInput = new AudioMixer.Input({
                                channels: 2,
                                bitDepth: 16,
                                sampleRate: 48000,
                                volume    : 80
                            });
                            this.audioMixer.addInput(standaloneInput);
                            const p = audioStream.pipe(standaloneInput);
                            audioStream.on('end', () => {
                                if (this.audioMixer != null){
                                    this.audioMixer.removeInput(standaloneInput);
                                    standaloneInput.destroy();
                                    audioStream.destroy();
                                    p.destroy()
                                }
                            });
                        }
                    }else{
                    }
        })
        return true;
    }
    unconnectVoice(){
        if(this.dummyInput1  != null) {
            this.dummyInput1.end();
            this.dummyInput1.destroy();
            this.dummyInput1 = null;
        }
        if(this.audioMixer != null){
            this.audioMixer.close();
            this.audioMixer = null;
        } 
        if(this.liveMixer != null){
            this.liveMixer.close();
            this.liveMixer = null;
        } 
        if(this.conn1 != null) {
            this.conn1.on('closing', () => {
                this.conn1 = null;
            });
            this.conn1.disconnect();
        }
        if(this.conn2 != null){
            this.conn2.on('closing', () => {
                this.conn2 = null;
            });
            this.conn2.disconnect();
        }
    }
}
