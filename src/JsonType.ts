import {nul, bool, num, str, literal, opt, arr, tuple, obj, union, TsType, validatingParse} from 'ts-json-validator';

// https://github.com/nwtgck/ts-json-validator
// https://qiita.com/nwtgck/items/1cc44b6d445ae1d48957

const userCommand = obj({
    cmd        : arr(str),
    desc       : str,
});
export type UserCommandType = TsType<typeof userCommand>;

export const LangTypeFormat = obj({
    sys
    :obj({
        cmd_connect_voice   : arr(str),
        cmd_disconnect_voice : arr(str),

        Connect_Voice : str,
        Connect_Voice_Err : str,
        Unconnect_Voice_Err : str,
        Disconnect_Voice   : str,
    }),
});
export type LangType = TsType<typeof LangTypeFormat>;

export const ServerSettingsFormat = obj({

    system_lang     : str,
    token1          : str,
    token2          : str,
    auto_voice_link : bool,
    environment_heroku : str,
    
    http
    :obj({
        addr         : str,
        ip           : str,
        http_port    : str,
    }),
});
export type ServerSettingsType = TsType<typeof ServerSettingsFormat>;
