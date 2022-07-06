
Discordのボイスチャットの音声を、別のボイスチャットに転送するBOTです。  

このBOTは、TumoiYorozu様のDiscordWerewolf.ts（Discord 上で人狼ゲームを行うための GM bot）を改造して制作しています。  
https://github.com/TumoiYorozu/DiscordWerewolf.ts

# インストール方法
## Discord Bot のアクセストークンの準備
以下のページから Bot の作成とトークンを入手してください．Bot は 2体必要なので2つ作成してください．  
(ボイスチャットとボイスチャットをつなぐ時，1BOT 1ボイチャしか入れないので2つ必要) https://discordapp.com/developers/applications/me  

詳しいやり方↓  
https://liginc.co.jp/370260

## CentOSでのインストール
### 確認した環境
CentOS 7.9

準備中

## Ubuntuでのインストール
### 確認した環境
Ubuntu 20.04.1

### 必要パッケージのインストール．node 12 を使うために n 経由でインストール．apt で入れた node は削除
```
sudo apt update
sudo apt install -y nodejs npm git wget
sudo npm install n -g
sudo n 12.16.2 
sudo apt purge -y nodejs npm
exec $SHELL -l
```

### TypeScript のインストール．Git clone．コンパイル
```
sudo npm install -g typescript@4.1.3
git clone https://github.com/jirno7pr/DiscordVoiceTransfer.ts.git
cd DiscordVoiceTransfer.ts/
npm install
tsc
```

### 環境変数の設定（例）
.bashrc ファイルを編集して環境変数を設定します．  
Ubuntu のターミナルから nano ~/.bashrc と打つと，ファイルの編集ができるので，一番下に  
```
export DISCORD_VOICE_TRANSFER_BOT_TOKEN_1="BOT1のトークン"
export DISCORD_VOICE_TRANSFER_BOT_TOKEN_2="BOT2のトークン"
export DISCORD_VOICE_TRANSFER_ENVIRONMENT_HEROKU="デプロイ先がherokuか 例 herokuの場合:true herokuでない場合:false"
export DISCORD_VOICE_TRANSFER_HTTP_IP="BotをインストールしたPCのIPアドレス．例 192.168.1.2"
export DISCORD_VOICE_TRANSFER_HTTP_ADDR="外部から接続するために表示するアドレス．例A 123.45.67.89, 例B hogehoge.com"
export DISCORD_VOICE_TRANSFER_HTTP_PORT="1080"
```
を追記します．  
「デプロイ先がherokuか」は、通常falseで良いです．herokuにデプロイする場合のみtrueを指定してください。  
「外部から接続するために表示するアドレス」はグローバルIP などを持っていればそれを設定すれば良いです．外部から接続できるアドレスを持っていない場合は DISCORD_VOICE_TRANSFER_HTTP_IP と同じや 127.0.0.1 (ローカル・ループバック・アドレス：自分自身にアクセスするアドレス)を設定しておけば良いです．  
  
ファイルを編集する際，nano の場合， Ctrl+O で保存の確認されるので Enter で保存されます．保存完了後，Ctrl+X で nano を終了できます．  
ターミナルを再起動するか，source ~/.bashrc と打つことで環境変数の設定が反映されます．  
変数がちゃんと反映されているか確認するには，例えば  
echo $DISCORD_VOICE_TRANSFER_BOT_TOKEN_1  
と打ち，設定したトークンが表示されれば完了です．  

### 実行
`node build/index.js -s server_settings/default.json5`

### 使い方
 - 任意のボイスチャンネルに接続します
 - 任意のテキストチャンネルで「@bot1 connect」と発言します（@bot1はbotの名前）
 - 接続しているボイスチャンネルにbot1およびbot2が接続されます
 - bot1をボイス転送元、bot2をボイス転送先にドラッグ＆ドロップで移動します。（「メンバーを移動」の権限が必要）
 - bot1からbot2に対してボイスが転送されます
 - 切断するときは「@bot1 disconnect」と発言します