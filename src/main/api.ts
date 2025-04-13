import axios from "axios";
import { v4 as uuidv4 } from 'uuid';
import { createHash,randomBytes ,createPublicKey, publicEncrypt, createCipheriv} from 'crypto';
import qrc_decrypt from "./qrc_decrypt";

interface OSVersion {
    release: string;
    sdk: number;
}
interface LyricData {
    lyric?: string;
    trans?: string;
    roma?: string;
}
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDEIxgwoutfwoJxcGQeedgP7FG9qaIuS0qzfR8gWkrkTZKM2iWHn2ajQpBRZjMSoSf6+KJGvar2ORhBfpDXyVtZCKpqLQ+FLkpncClKVIrBwv6PHyUvuCb0rIarmgDnzkfQAqVufEtR64iazGDKatvJ9y6B9NMbHddGSAUmRTCrHQIDAQAB
-----END PUBLIC KEY-----`;
const SECRET = "ZdJqM15EeO2zWc08";
const APP_KEY = "0AND0HD6FE4HY80F";
const version = '13.2.5.8'
const QRC_PATTERN = /<Lyric_.* LyricType=".*" LyricContent="(?<content>.*?)"\/>/s;

let qimei36 = "";




function calcMd5(...items: (string | Buffer)[]): string {
    const hash = createHash('md5');
    for (const item of items) {
        if (Buffer.isBuffer(item)) {
            hash.update(item);
        } else {
            hash.update(item, 'utf-8');
        }
    }
    return hash.digest('hex');
}

function rsaEncrypt(content: Buffer): Buffer {
    const key = createPublicKey(PUBLIC_KEY);
    return publicEncrypt({ key, padding: 1 }, content);
}
function aesEncrypt(key: Buffer, content: Buffer): Buffer {
    const cipher = createCipheriv('aes-128-cbc', key, key);
    const padded = Buffer.concat([content, Buffer.alloc(16 - (content.length % 16), 16 - (content.length % 16))]);
    return Buffer.concat([cipher.update(padded), cipher.final()]);
}


function randomBeaconId(): string {
    let beaconId = "";
    const timeMonth = new Date().toISOString().slice(0, 7) + "-01";
    const rand1 = Math.floor(100000 + Math.random() * 900000);
    const rand2 = Math.floor(100000000 + Math.random() * 900000000);

    for (let i = 1; i <= 40; i++) {
        if ([1, 2, 13, 14, 17, 18, 21, 22, 25, 26, 29, 30, 33, 34, 37, 38].includes(i)) {
            beaconId += `k${i}:${timeMonth}${rand1}.${rand2}`;
        } else if (i === 3) {
            beaconId += "k3:0000000000000000";
        } else if (i === 4) {
            beaconId += `k4:${Array.from({length:16}, () => '123456789abcdef'[Math.floor(Math.random()*15)]).join('')}`;
        } else {
            beaconId += `k${i}:${Math.floor(Math.random() * 10000)}`;
        }
        beaconId += ";";
    }
    return beaconId;
}

class Device {
    display: string;
    product = "iarim";
    device = "sagit";
    board = "eomam";
    model = "MI 6";
    fingerprint: string;
    boot_id: string;
    proc_version: string;
    imei: string;
    brand = "Xiaomi";
    bootloader = "U-boot";
    base_band = "";
    version: OSVersion;
    sim_info = "T-Mobile";
    os_type = "android";
    mac_address = "00:50:56:C0:00:08";
    static ip_address = [10, 0, 1, 3];
    wifi_bssid = "00:50:56:C0:00:08";
    wifi_ssid = "<unknown ssid>";
    imsi_md5: number[];
    android_id: string;
    apn = "wifi";
    vendor_name = "MIUI";
    vendor_os_name = "qmapi";

    constructor() {
        this.display = `QMAPI.${Math.floor(100000 + Math.random() * 900000)}.001`;
        this.fingerprint = `xiaomi/iarim/sagit:10/eomam.200122.001/${Math.floor(1000000 + Math.random() * 9000000)}:user/release-keys`;
        this.boot_id = uuidv4();
        this.proc_version = `Linux 5.4.0-54-generic-${randomBytes(8).toString('hex')} (android-build@google.com)`;
        this.imei = this.randomImei();
        this.version = { release: "10", sdk: 29 }; // 示例值
        this.imsi_md5 = Array.from(randomBytes(16));
        this.android_id = randomBytes(8).toString('hex');
    }

    private randomImei(): string {
        const tac = Math.floor(10000000 + Math.random() * 90000000);
        const sn = Math.floor(100000 + Math.random() * 900000);
        return `${tac}${sn}`.slice(0, 15);
    }
}


export function randomPayloadByDevice(device: Device, version: string): object {
    const fixedRand = Math.floor(Math.random() * 14400);
    const reserved = {
        "harmony": "0",
        "clone": "0",
        "containe": "",
        "oz": "UhYmelwouA+V2nPWbOvLTgN2/m8jwGB+yUB5v9tysQg=",
        "oo": "Xecjt+9S1+f8Pz2VLSxgpw==",
        "kelong": "0",
        "uptimes": new Date(Date.now() - fixedRand * 1000).toISOString().replace('T', ' ').slice(0, 19),
        "multiUser": "0",
        "bod": device.brand,
        "dv": device.device,
        "firstLevel": "",
        "manufact": device.brand,
        "name": device.model,
        "host": "se.infra",
        "kernel": device.proc_version,
    };

    return {
        "androidId": device.android_id,
        "platformId": 1,
        "appKey": APP_KEY,
        "appVersion": version,
        "beaconIdSrc": randomBeaconId(),
        "brand": device.brand,
        "channelId": "10003505",
        "cid": "",
        "imei": device.imei,
        "imsi": "",
        "mac": "",
        "model": device.model,
        "networkType": "unknown",
        "oaid": "",
        "osVersion": `Android ${device.version.release},level ${device.version.sdk}`,
        "qimei": null,
        "sdkVersion": "1.2.13.6",
        "targetSdkVersion": "33",
        "audit": "",
        "userId": "{}",
        "packageId": "com.tencent.qqmusic",
        "deviceType": "Phone",
        "sdkName": "",
        "reserved": JSON.stringify(reserved)
    };
}
  
  async function getQimei(version: string){
    const device = new Device();
    try {
      const payload = randomPayloadByDevice(device, version);
      const cryptKey = Array.from({length: 16}, () => "adbcdef1234567890"[Math.floor(Math.random() * 16)]).join("");
      const nonce = Array.from({length: 16}, () => "adbcdef1234567890"[Math.floor(Math.random() * 16)]).join("");
      const ts = Math.floor(Date.now() / 1000);
      
      const key = rsaEncrypt(Buffer.from(cryptKey, 'utf-8')).toString('base64');
      const params = Buffer.from(aesEncrypt(Buffer.from(cryptKey, 'utf-8'), Buffer.from(JSON.stringify(payload), 'utf-8'))).toString('base64');

      const extra = `{"appKey":"${APP_KEY}"}`;
      const sign = calcMd5(key, params, (ts * 1000).toString(), nonce, SECRET, extra);

      const response = await fetch("https://api.tencentmusic.com/tme/trpc/proxy", {
        method: "POST",
        headers: {
          "Host": "api.tencentmusic.com",
          "method": "GetQimei",
          "service": "trpc.tme_datasvr.qimeiproxy.QimeiProxy",
          "appid": "qimei_qq_android",
          "sign": calcMd5("qimei_qq_androidpzAuCmaFAaFaHrdakPjLIEqKrGnSOOvH", ts.toString()),
          "user-agent": "QQMusic",
          "timestamp": ts.toString()
        },
        body: JSON.stringify({
          app: 0,
          os: 1,
          qimeiParams: {
            key: key,
            params: params,
            time: ts.toString(),
            nonce: nonce,
            sign: sign,
            extra: extra
          }
        })
      });
     
      const data = await response.json();
      if (data.code != 0) {
        console.error("获取 QIMEI 失败:", data); 
      }else{
        const qdata = JSON.parse(data.data);
        if (qdata.data.q36) {
            qimei36 = qdata.data.q36;
        }
        console.log("获取 QIMEI 成功:", qdata.data.q16, qdata.data.q36);
      }
    } catch (error) {
      console.error("获取 QIMEI 失败:", error);
    }
  }

  function processor(lyric?: string | null, trans?: string | null, roma?: string | null ): LyricData {
    lyric = lyric ?? "";
    trans = trans ?? "";
    roma = roma ?? "";
    const decryptedLyric = qrc_decrypt(lyric);
    const decryptedTrans = qrc_decrypt(trans);
    const decryptedRoma = qrc_decrypt(roma);

    if (lyric != "") {
        const mQrc = QRC_PATTERN.exec(decryptedLyric);
        if (mQrc?.groups?.content) {
          lyric = mQrc.groups.content;
        }
      }
    
      if (roma != "") {
        const mRoma = QRC_PATTERN.exec(decryptedRoma);
        if (mRoma?.groups?.content) {
          roma = mRoma.groups.content;
        }
      }
      if (trans != "") {
          trans = decryptedTrans
      }

    return {
        lyric: lyric,
        trans: trans,
        roma: roma,
    };
}


export default async function getqmusiclrc(songid: number) {
    try {
        const url = "https://u.y.qq.com/cgi-bin/musicu.fcg"; 
        if(qimei36 === ""){
            await getQimei(version);
        }
        if(qimei36 === ""){
          qimei36 = "35f21e7473442374591e560510001c71730b"; 
        }
        const payload = { 
            comm: {
                cv: 13020508,
                v: 13020508,
                QIMEI36: qimei36, 
                ct: '11',
                tmeAppID: 'qqmusic',
                format: 'json',
                inCharset: 'utf-8',
                outCharset: 'utf-8',
                uid: '3931641530' 
            },
            'music.musichallSong.PlayLyricInfo.GetPlayLyricInfo': {
                module: 'music.musichallSong.PlayLyricInfo',
                method: 'GetPlayLyricInfo',
                param: {
                    crypt: 1,
                    ct: 11,
                    cv: 13020508,
                    lrc_t: 0,
                    qrc: 1,
                    qrc_t: 0,
                    roma: 1,
                    roma_t: 0,
                    trans: 1,
                    trans_t: 0,
                    type: 1,
                    songId: songid // 使用传入的 songid
                }
            }
        };
        const response = await axios.post(url, payload, {
            timeout: 5000, // 保持超时设置
            headers: { // 添加请求头
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://y.qq.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 Edg/116.0.1938.54'
            }
        });
        const responseData = response.data['music.musichallSong.PlayLyricInfo.GetPlayLyricInfo'].data;
        const processed = processor(
            responseData.lyric,
            responseData.trans,
            responseData.roma
        );
        return processed;
    } catch (err) {
        console.log(err);
        return null;
    }
}