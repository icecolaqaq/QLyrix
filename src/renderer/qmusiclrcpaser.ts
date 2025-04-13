interface RawLyricFile {
    lyric: string;
    trans: string;
    roma: string;
}

export interface LyricLine {
    words: Array<{
        word: string;
        startTime: number;
        endTime: number;
        obscene: boolean;
    }>;
    startTime: number;
    endTime: number;
    translatedLyric: string;
    romanLyric: string;
    isBG: boolean;
    isDuet: boolean;
}

export function parseQrcLyric(rawData: RawLyricFile): LyricLine[] {
    const result: LyricLine[] = [];
// 该错误通常是因为 rawData.lyric、rawData.trans 或 rawData.roma 为 undefined 导致的。
// 为了避免此错误，我们可以在调用 split 方法之前添加空值检查。
    const [mainLines, transLines, romaLines] = [
        rawData.lyric || '',
        rawData.trans || '',
        rawData.roma || ''
    ].map(content => content.split('\n').filter(l => l.trim()));

    const lineRegex = /^\[(\d+),(\d+)\](.*)/;
    const wordRegex = /(.*?)\((\d+),(\d+)\)/g;
    let isDuet = false;

    const transEntries = transLines.map(line => {
        const timeMatch = line.match(/\[(\d+):(\d+)\.(\d+)\]/);
        const text = line.replace(/\[\d{2}:\d{2}\.\d{2}\]/g, '')
            .replace(/\/\//g, '')
            .trim();
        return {
            time: timeMatch ? 
                parseInt(timeMatch[1]) * 60000 + 
                parseInt(timeMatch[2]) * 1000 + 
                parseInt(timeMatch[3]) * 10 : -1,
            text
        };
    });

    const romaEntries = romaLines.map(line => {
        const timeMatch = line.match(/^\[(\d+),(\d+)\]/);
        const text = line.replace(/^\[\d+,\d+\]\s*/, '')
            .replace(/\([\d,]+\)/g, '')
            .trim();
        return {
            time: timeMatch ? parseInt(timeMatch[1]) : -1,
            text
        };
    });

    mainLines.forEach((line, index) => {
        const lineMatch = line.match(lineRegex);
        if (!lineMatch) return;
        // 解析行基本信息
        const lineStart = parseInt(lineMatch[1]);
        const lineDuration = parseInt(lineMatch[2]);
        // 修改行处理逻辑
        const rawLineContent = lineMatch[3];
        // 对唱判断
        const isFemaleLineRole1 = /^女\(\d+,\d+\)：\(\d+,\d+\)$/.test(rawLineContent);
        const isFemaleLineRole2 = rawLineContent.includes('女：')
        if(isFemaleLineRole1 || isFemaleLineRole2){
            isDuet = true 
        }
        const isManLineRole1 = /^男\(\d+,\d+\)：\(\d+,\d+\)$/.test(rawLineContent);
        const isManLineRole2 = rawLineContent.includes('男：')
        if(isManLineRole1 || isManLineRole2){
            isDuet = false
        }
        const isCommonLineRole1 = /^合\(\d+,\d+\)：\(\d+,\d+\)$/.test(rawLineContent);
        const isCommonLineRole2 = rawLineContent.includes('合：')
        if(isCommonLineRole1 || isCommonLineRole2){
            isDuet = false
        }
        let isBG = false;
        //背景判断 规则 判断歌词第一个字符是否为（
        const firstChar = rawLineContent[0];
        if (firstChar === '（') {
            isBG = true;
        }

        const words: LyricLine['words'] = [];
        let wordMatch;
        while ((wordMatch = wordRegex.exec(rawLineContent)) !== null) {
            const text = wordMatch[1];
            const start = parseInt(wordMatch[2]);
            const duration = parseInt(wordMatch[3]);
            if (text) {
                words.push({
                    word: text,
                    startTime: start,
                    endTime: start + duration,
                    obscene: false
                });
            }
        }

        const translated = transEntries.reduce((closest, entry) => {
            if (entry.time === -1) return closest;
            const diff = Math.abs(entry.time - lineStart);
            return diff < closest.diff ? 
                { text: entry.text, diff } : closest;
        }, { text: '', diff: Infinity }).text;

        const roman = romaEntries.reduce((closest, entry) => {
            if (entry.time === -1) return closest;
            const diff = Math.abs(entry.time - lineStart);
            return diff < closest.diff ? 
                { text: entry.text, diff } : closest;
        }, { text: '', diff: Infinity }).text;

        if (words.length > 0) {
            result.push({
                words,
                startTime: lineStart,
                endTime: lineStart + lineDuration,
                translatedLyric: translated,
                romanLyric: roman,
                isBG,
                isDuet
            });
        }
    });
    return result;
}
